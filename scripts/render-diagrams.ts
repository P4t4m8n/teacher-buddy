// Draws every diagram of docs/*.md as an image: docs/diagrams/NAME.png and NAME.svg.
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const ROOT: string = process.cwd();
const DOCS: string = join(ROOT, "docs");
const OUT: string = join(DOCS, "diagrams");
const MERMAID_HOME: string = join(tmpdir(), "teacher-buddy-mermaid");
const MERMAID_BUNDLE: string = join(MERMAID_HOME, "node_modules", "mermaid", "dist", "mermaid.min.js");

type TDiagram = { name: string; code: string };

const DIAGRAM_PATTERN = /\]\(\.\/diagrams\/([\w-]+)\.svg\)\r?\n\r?\n<details>\r?\n<summary>[^\r\n]*<\/summary>\r?\n\r?\n```mermaid\r?\n([\s\S]*?)```/g;

const readDiagrams = (): TDiagram[] =>
  readdirSync(DOCS)
    .filter((file: string) => file.endsWith(".md"))
    .flatMap((file: string): TDiagram[] =>
      [...readFileSync(join(DOCS, file), "utf8").matchAll(DIAGRAM_PATTERN)].map((match) => ({ name: match[1], code: match[2] })),
    );

const ensureMermaid = (): void => {
  if (existsSync(MERMAID_BUNDLE)) return;
  console.log(`Installing mermaid into ${MERMAID_HOME} (once)...`);
  mkdirSync(MERMAID_HOME, { recursive: true });
  execSync("npm install mermaid --no-audit --no-fund", { cwd: MERMAID_HOME, stdio: "inherit" });
};

const main = async (): Promise<void> => {
  const diagrams: TDiagram[] = readDiagrams();
  if (diagrams.length === 0) throw new Error("No diagram found in docs/*.md");
  ensureMermaid();
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  await page.setContent('<!doctype html><html><body style="margin:0;background:#fff"><div id="holder" style="display:inline-block;padding:16px"></div></body></html>');
  await page.addScriptTag({ path: MERMAID_BUNDLE });
  await page.evaluate(() => {
    // htmlLabels off: the text is SVG text, so the .svg also shows correctly outside a browser.
    (window as unknown as { mermaid: { initialize: (config: object) => void } }).mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
      maxTextSize: 1_000_000,
      flowchart: { htmlLabels: false, useMaxWidth: false, nodeSpacing: 40, rankSpacing: 60 },
      sequence: { useMaxWidth: false, wrap: false },
      er: { useMaxWidth: false },
      state: { useMaxWidth: false },
    });
  });

  for (const [index, { name, code }] of diagrams.entries()) {
    const svg: string = await page.evaluate(
      async ([id, source]) => {
        const { svg: drawn } = await (window as unknown as { mermaid: { render: (id: string, code: string) => Promise<{ svg: string }> } }).mermaid.render(id, source);
        (document.getElementById("holder") as HTMLElement).innerHTML = drawn;
        return drawn;
      },
      [`diagram${index}`, code],
    );
    writeFileSync(join(OUT, `${name}.svg`), svg);
    await page.locator("#holder").screenshot({ path: join(OUT, `${name}.png`) });
    console.log(`drew ${name}`);
  }
  await browser.close();
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
