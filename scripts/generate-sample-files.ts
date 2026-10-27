// Makes the sample files that can be uploaded by hand when trying the submission: docs/samples/sample-submission.pdf and docs/samples/sample-submission.png.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const OUT: string = join(process.cwd(), "docs", "samples");

const HTML = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 0; }
  body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; background: #fff; }
  .page { box-sizing: border-box; width: 794px; height: 1123px; padding: 72px 64px; }
  h1 { margin: 0 0 8px; font-size: 34px; color: #4338ca; }
  .meta { margin: 0 0 36px; font-size: 16px; color: #475569; }
  h2 { margin: 28px 0 8px; font-size: 22px; }
  p, li { font-size: 18px; line-height: 1.7; }
  .box { margin-top: 36px; padding: 16px 20px; border: 2px dashed #94a3b8; border-radius: 12px; font-size: 15px; color: #475569; }
</style>
</head>
<body>
<div class="page">
  <h1>סיכום הספר</h1>
  <p class="meta">הגשה לדוגמה &middot; נועה לוי &middot; כיתה ח'1</p>

  <h2>הדמות המרכזית</h2>
  <p>הדמות המרכזית בספר היא ילדה סקרנית שיוצאת למסע כדי למצוא את מקורו של נהר שנעלם. לאורך הדרך היא לומדת להקשיב ולסמוך על אחרים.</p>

  <h2>המסר של הסופר</h2>
  <ul>
    <li>סקרנות היא הצעד הראשון לכל גילוי.</li>
    <li>שיתוף פעולה מביא תוצאות שאי אפשר להשיג לבד.</li>
    <li>גם טעויות הן חלק מהדרך ללמידה.</li>
  </ul>

  <div class="box">זהו קובץ לדוגמה לבדיקת העלאת מטלה במערכת Teacher Buddy. אין בו תוכן אמיתי.</div>
</div>
</body>
</html>`;

const main = async (): Promise<void> => {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1 });
  await page.setContent(HTML);

  await page.pdf({ path: join(OUT, "sample-submission.pdf"), format: "A4", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
  await page.screenshot({ path: join(OUT, "sample-submission.png"), clip: { x: 0, y: 0, width: 794, height: 640 } });

  await browser.close();
  console.log(`Wrote ${join(OUT, "sample-submission.pdf")} and ${join(OUT, "sample-submission.png")}`);
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
