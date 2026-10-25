import { describe, expect, it, vi } from "vitest";
import { SAMPLE_STUDENT_ASSIGNMENTS } from "@/constants/assignment.constant";

vi.mock("server-only", () => ({}));

import { sanitizeRichText } from "./richText";

const ALLOWED_TAGS = new Set(["p", "h2", "h3", "strong", "em", "ul", "ol", "li", "br"]);

// Every tag that is left in the result.
const tagsIn = (html: string): string[] => [...html.matchAll(/<\/?([a-z0-9]+)/gi)].map((match) => match[1].toLowerCase());

describe("sanitizeRichText: what the editor makes is kept", () => {
  it.each([
    ["a paragraph", "<p>שלום כיתה</p>"],
    ["two paragraphs", "<p>אחת</p><p>שתיים</p>"],
    ["a heading of level 2", "<h2>הנחיות</h2>"],
    ["a heading of level 3", "<h3>כותרת קטנה</h3>"],
    ["bold", "<p><strong>חשוב</strong> רגיל</p>"],
    ["italic", "<p><em>נטוי</em></p>"],
    ["bold inside italic", "<p><em><strong>שניהם</strong></em></p>"],
    ["a bullet list", "<ul><li><p>אחד</p></li><li><p>שניים</p></li></ul>"],
    ["a numbered list", "<ol><li><p>ראשון</p></li><li><p>שני</p></li></ol>"],
    ["a line break", "<p>שורה<br>שורה</p>"],
    ["a list inside a list", "<ul><li><p>א</p><ul><li><p>ב</p></li></ul></li></ul>"],
    ["English and numbers", "<p>Chapter 4: 12 + 30 = 42</p>"],
  ])("keeps %s exactly as it is", (_label, html) => {
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("keeps every description of the sample data, which was written like the editor writes", () => {
    for (const { description } of SAMPLE_STUDENT_ASSIGNMENTS) {
      expect(sanitizeRichText(description)).toBe(description);
    }
  });

  it("writes a line break the way the editor does, as <br>", () => {
    expect(sanitizeRichText("<p>א<br/>ב<br />ג</p>")).toBe("<p>א<br>ב<br>ג</p>");
  });

  it("keeps characters of the text that have a meaning in HTML, written safely", () => {
    expect(sanitizeRichText("<p>5 &lt; 6 &amp; 7 &gt; 3</p>")).toBe("<p>5 &lt; 6 &amp; 7 &gt; 3</p>");
  });

  it("does not change what it already cleaned", () => {
    const messy = '<p onclick="x()">שלום <a href="https://x.co">קישור</a><script>bad()</script></p>';

    const once = sanitizeRichText(messy);

    expect(sanitizeRichText(once)).toBe(once);
  });
});

describe("sanitizeRichText: what is not allowed is removed", () => {
  it("removes a script, with everything inside it", () => {
    expect(sanitizeRichText("<p>לפני</p><script>alert(1)</script><p>אחרי</p>")).toBe("<p>לפני</p><p>אחרי</p>");
  });

  it("removes a style tag, with everything inside it", () => {
    expect(sanitizeRichText("<style>body{display:none}</style><p>טקסט</p>")).toBe("<p>טקסט</p>");
  });

  it("removes every attribute, from a tag that is allowed", () => {
    expect(sanitizeRichText('<p class="x" style="color:red" onclick="bad()" id="a" data-x="1">טקסט</p>')).toBe(
      "<p>טקסט</p>",
    );
  });

  it("removes a link, and keeps the words of the link", () => {
    expect(sanitizeRichText('<p>ראו <a href="https://example.com">כאן</a></p>')).toBe("<p>ראו כאן</p>");
  });

  it("removes an image, even with an event on it", () => {
    expect(sanitizeRichText('<p>א<img src=x onerror="alert(1)">ב</p>')).toBe("<p>אב</p>");
  });

  it.each([
    ["a quote", "<blockquote>ציטוט</blockquote>", "ציטוט"],
    ["code", "<p><code>x = 1</code></p>", "<p>x = 1</p>"],
    ["a table", "<table><tr><td>תא</td></tr></table>", "תא"],
    ["a heading of level 1", "<h1>גדול</h1>", "גדול"],
    ["a heading of level 4", "<h4>קטן</h4>", "קטן"],
    ["underline", "<p><u>קו</u></p>", "<p>קו</p>"],
    ["strike", "<p><s>חצוי</s></p>", "<p>חצוי</p>"],
    ["a div", "<div>בלוק</div>", "בלוק"],
    ["a span", "<p><span>ספאן</span></p>", "<p>ספאן</p>"],
  ])("takes out %s, and keeps its text", (_label, html, expected) => {
    expect(sanitizeRichText(html)).toBe(expected);
  });

  it("removes an iframe, an object, an embed, a form and an input", () => {
    const html =
      '<iframe src="https://evil.example"></iframe><object data="x"></object><embed src="x"><form action="x"><input name="a"></form><p>נשאר</p>';

    expect(tagsIn(sanitizeRichText(html))).toEqual(["p", "p"]);
  });

  it("removes comments", () => {
    expect(sanitizeRichText("<p>א</p><!-- הערה <script>x</script> --><p>ב</p>")).toBe("<p>א</p><p>ב</p>");
  });

  describe("known attack strings", () => {
    const ATTACKS: [string, string][] = [
      ["a script tag", "<script>alert(document.cookie)</script>"],
      ["a script in capital letters", "<SCRIPT SRC=//evil.example/x.js></SCRIPT>"],
      ["a script that is half closed", "<script>alert(1)//"],
      ["a script tag split by a tag", "<scr<script>ipt>alert(1)</scr</script>ipt>"],
      ["an image with onerror", '<img src="x" onerror="alert(1)">'],
      ["an image with onerror and no quotes", "<img src=x onerror=alert(1)>"],
      ["an svg with onload", '<svg onload="alert(1)"></svg>'],
      ["an svg with a script inside", "<svg><script>alert(1)</script></svg>"],
      ["a link with javascript:", '<a href="javascript:alert(1)">לחצו</a>'],
      ["a link with a data: address", '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>'],
      ["an iframe with srcdoc", '<iframe srcdoc="<script>alert(1)</script>"></iframe>'],
      ["a body with onload", '<body onload="alert(1)">'],
      ["a paragraph with onmouseover", '<p onmouseover="alert(1)">עברו עליי</p>'],
      ["a meta refresh", '<meta http-equiv="refresh" content="0;url=https://evil.example">'],
      ["a base tag", '<base href="https://evil.example/">'],
      ["a link tag to a stylesheet", '<link rel="stylesheet" href="https://evil.example/x.css">'],
      ["math with an event", '<math><mtext onclick="alert(1)">x</mtext></math>'],
      ["a tag with a broken quote", '<p title="x" onclick="alert(1)">y</p>'],
      ["an entity-encoded script", "&lt;script&gt;alert(1)&lt;/script&gt;"],
      ["a null byte inside a tag", "<scr\u0000ipt>alert(1)</scr\u0000ipt>"],
    ];

    it.each(ATTACKS)("%s leaves nothing that can run", (_label, attack) => {
      const result = sanitizeRichText(attack);

      expect(result).not.toMatch(/<script/i);
      expect(result).not.toMatch(/\son[a-z]+\s*=/i);
      expect(result).not.toMatch(/javascript:/i);
      expect(result).not.toMatch(/<(img|svg|iframe|object|embed|a|body|meta|base|link|math|form|input)\b/i);
      expect(tagsIn(result).every((tag) => ALLOWED_TAGS.has(tag))).toBe(true);
    });

    it("every result only has tags of the editor, when the attacks are mixed with good text", () => {
      const mixed = ATTACKS.map(([, attack]) => `<p>טקסט</p>${attack}`).join("");

      expect(tagsIn(sanitizeRichText(mixed)).every((tag) => ALLOWED_TAGS.has(tag))).toBe(true);
    });
  });
});

describe("sanitizeRichText: an empty description", () => {
  it.each([
    ["nothing", ""],
    ["only spaces", "   "],
    ["an empty paragraph", "<p></p>"],
    ["a paragraph of spaces", "<p>   </p>"],
    ["a paragraph with a line break only", "<p><br></p>"],
    ["an empty list", "<ul><li><p></p></li></ul>"],
    ["only a script", "<script>alert(1)</script>"],
    ["only a non-breaking space", "<p>&nbsp;</p>"],
    ["only an invisible space", "<p>\u200b</p>"],
    ["only a tag that is not allowed", '<img src="x">'],
  ])("%s becomes an empty text", (_label, html) => {
    expect(sanitizeRichText(html)).toBe("");
  });

  it("does not make a description with a word in it empty", () => {
    expect(sanitizeRichText("<p>א</p>")).toBe("<p>א</p>");
  });
});
