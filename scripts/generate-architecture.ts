// Reads the real imports of the project and writes the component hierarchy per page and the "who uses what" table to docs/.
// Run it again after the code changes:  npx tsx scripts/generate-architecture.ts
// Type-only imports (`import type`) and the types/ folder are left out: they do not run, and they would hide the structure.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const ROOT: string = process.cwd();
const SOURCE_FOLDERS: string[] = ["app", "components", "hooks", "services", "schemas", "lib", "helpers", "constants", "types"];
const EXTENSIONS: string[] = [".ts", ".tsx"];

type TLayer = "proxy" | "page" | "route" | "component" | "ui" | "hook" | "clientService" | "serverService" | "schema" | "utility";

const LAYER_TITLES: Record<TLayer, string> = {
  proxy: "Proxy",
  page: "Pages and layouts (server)",
  route: "Route handlers (API)",
  component: "Components (feature)",
  ui: "UI components (shared)",
  hook: "Hooks (client)",
  clientService: "Client services (call the API)",
  serverService: "Server services (database)",
  schema: "Schemas (zod)",
  utility: "Utilities (lib, helpers, constants)",
};

const LAYER_COLORS: Record<TLayer, string> = {
  proxy: "#fde68a",
  page: "#bfdbfe",
  route: "#fecaca",
  component: "#c7d2fe",
  ui: "#e0e7ff",
  hook: "#ddd6fe",
  clientService: "#fbcfe8",
  serverService: "#bbf7d0",
  schema: "#fed7aa",
  utility: "#e5e7eb",
};

const toPosix = (path: string): string => path.split(sep).join("/");

const listFiles = (folder: string): string[] => {
  const absolute: string = join(ROOT, folder);
  if (!existsSync(absolute)) return [];

  return readdirSync(absolute).flatMap((name: string): string[] => {
    const child: string = join(folder, name);
    if (statSync(join(ROOT, child)).isDirectory()) return listFiles(child);
    return EXTENSIONS.some((extension: string) => name.endsWith(extension)) && !/\.test\.tsx?$/.test(name) ? [toPosix(child)] : [];
  });
};

const files: string[] = [...SOURCE_FOLDERS.flatMap(listFiles), ...(existsSync(join(ROOT, "proxy.ts")) ? ["proxy.ts"] : [])].filter(
  (file: string) => !file.startsWith("types/"),
);
const fileSet = new Set<string>(files);

const resolveImport = (fromFile: string, specifier: string): string | null => {
  const base: string | null = specifier.startsWith("@/")
    ? specifier.slice(2)
    : specifier.startsWith(".")
      ? toPosix(relative(ROOT, resolve(dirname(join(ROOT, fromFile)), specifier)))
      : null;
  if (!base) return null;

  const candidates: string[] = [base, ...EXTENSIONS.map((extension: string) => base + extension), ...EXTENSIONS.map((extension: string) => `${base}/index${extension}`)];
  return candidates.find((candidate: string) => fileSet.has(candidate)) ?? null;
};

const IMPORT_PATTERN = /(?:^|\n)\s*(import|export)\s+(type\s+)?([^;'"]*?)\s*from\s*["']([^"']+)["']/g;
const SIDE_EFFECT_PATTERN = /(?:^|\n)\s*import\s*["']([^"']+)["']/g;

const importsOf = (file: string): string[] => {
  const source: string = readFileSync(join(ROOT, file), "utf8");
  const found = new Set<string>();
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    if (match[2]) continue;
    const resolved: string | null = resolveImport(file, match[4]);
    if (resolved) found.add(resolved);
  }
  for (const match of source.matchAll(SIDE_EFFECT_PATTERN)) {
    const resolved: string | null = resolveImport(file, match[1]);
    if (resolved) found.add(resolved);
  }
  found.delete(file);
  return [...found].sort();
};

const uses = new Map<string, string[]>(files.map((file: string) => [file, importsOf(file)]));
const usedBy = new Map<string, string[]>(files.map((file: string) => [file, []]));
for (const [file, imported] of uses) for (const target of imported) usedBy.get(target)?.push(file);

const layerOf = (file: string): TLayer => {
  if (file === "proxy.ts") return "proxy";
  if (file.startsWith("app/api/")) return "route";
  if (file.startsWith("app/")) return "page";
  if (file.startsWith("components/ui/")) return "ui";
  if (file.startsWith("components/")) return "component";
  if (file.startsWith("hooks/")) return "hook";
  if (file.startsWith("schemas/")) return "schema";
  if (file.startsWith("services/")) return /(\.client\.service|ApiError\.client|\.client)\.tsx?$/.test(file) ? "clientService" : "serverService";
  return "utility";
};

const labelOf = (file: string): string => {
  const parts: string[] = file.split("/");
  return layerOf(file) === "page" || layerOf(file) === "route" ? parts.slice(-3).join("/") : parts[parts.length - 1];
};

const LAYER_ORDER: TLayer[] = ["proxy", "page", "route", "component", "ui", "hook", "clientService", "serverService", "schema", "utility"];

const isClientFile = (file: string): boolean => /^\s*["']use client["']/.test(readFileSync(join(ROOT, file), "utf8"));

// The client services call these endpoints with fetch, which is not an import, so the link is written here.
const CLIENT_SERVICE_ROUTES: Record<string, string[]> = {
  "services/auth.client.service.ts": ["app/api/auth/login/route.ts", "app/api/auth/logout/route.ts"],
  "services/student.client.service.ts": ["app/api/students/route.ts", "app/api/students/[id]/route.ts"],
  "services/assignment.client.service.ts": ["app/api/assignments/route.ts", "app/api/assignments/[id]/route.ts"],
  "services/submission.client.service.ts": [
    "app/api/assignments/[id]/students/[studentId]/file/route.ts",
    "app/api/assignments/[id]/students/[studentId]/grade/route.ts",
  ],
};

// Shown on every page and called by every client service: leaving them out keeps the diagrams readable.
const HIDDEN_FILES = new Set<string>(["services/api.client.service.ts", "services/ApiError.client.ts"]);

const PAGE_TITLES: Record<string, string> = {
  "app/(root)/auth/page.tsx": "Sign-in page: /auth",
  "app/(root)/dashboard/page.tsx": "Students list: /dashboard",
  "app/(root)/dashboard/students/new/page.tsx": "Add a student: /dashboard/students/new",
  "app/(root)/dashboard/students/[id]/page.tsx": "Student page, with the student's assignments and the file and grade modal: /dashboard/students/[id]",
  "app/(root)/dashboard/students/[id]/edit/page.tsx": "Edit a student: /dashboard/students/[id]/edit",
  "app/(root)/dashboard/assignments/page.tsx": "Assignments list: /dashboard/assignments",
  "app/(root)/dashboard/assignments/new/page.tsx": "Add an assignment: /dashboard/assignments/new",
  "app/(root)/dashboard/assignments/[id]/page.tsx": "Assignment page, with its students and the file and grade modal: /dashboard/assignments/[id]",
  "app/(root)/dashboard/assignments/[id]/edit/page.tsx": "Edit an assignment, with the removal confirmation: /dashboard/assignments/[id]/edit",
};

const TREE_LAYERS = new Set<TLayer>(["page", "component", "ui", "hook", "clientService", "serverService", "route"]);

// From a page: down through the components it shows, their hooks, the client service, (fetch) the route handler,
// and the server services. Only the code that runs on the way: schemas, lib, helpers and constants are in file-usage.md.
const treeOf = (page: string): { nodes: Set<string>; edges: [string, string, boolean][] } => {
  const nodes = new Set<string>([page]);
  const edges: [string, string, boolean][] = [];
  const queue: string[] = [page];
  const visit = (from: string, to: string, isFetch: boolean): void => {
    if (HIDDEN_FILES.has(to) || !TREE_LAYERS.has(layerOf(to))) return;
    edges.push([from, to, isFetch]);
    if (nodes.has(to)) return;
    nodes.add(to);
    queue.push(to);
  };

  while (queue.length > 0) {
    const file: string = queue.shift() as string;
    for (const target of uses.get(file) ?? []) {
      // A route handler is only reached by fetch, never by import, and a server service does not import a page.
      if (layerOf(target) === "route") continue;
      visit(file, target, false);
    }
    for (const route of CLIENT_SERVICE_ROUTES[file] ?? []) if (fileSet.has(route)) visit(file, route, true);
  }
  return { nodes, edges };
};

// The convention of the image link: render-diagrams.ts finds it just before the mermaid block and writes the image there.
const diagramBlock = (name: string, alt: string, code: string): string =>
  [`[![${alt}](./diagrams/${name}.png)](./diagrams/${name}.svg)`, "", "<details>", "<summary>Mermaid source</summary>", "", "```mermaid", code, "```", "", "</details>", ""].join("\n");

const toTreeMermaid = (nodes: Set<string>, edges: [string, string, boolean][]): string => {
  const ids = new Map<string, string>([...nodes].sort().map((file: string, index: number) => [file, `n${index}`]));
  const lines: string[] = ["flowchart TD"];
  for (const file of [...nodes].sort()) lines.push(`  ${ids.get(file)}["${labelOf(file)}"]:::${layerOf(file)}`);
  for (const [from, to, isFetch] of edges) lines.push(isFetch ? `  ${ids.get(from)} -. fetch .-> ${ids.get(to)}` : `  ${ids.get(from)} --> ${ids.get(to)}`);
  for (const layer of LAYER_ORDER) lines.push(`  classDef ${layer} fill:${LAYER_COLORS[layer]},stroke:#64748b,color:#0f172a`);
  const clientFiles: string[] = [...nodes].filter(isClientFile).map((file: string) => ids.get(file) as string);
  if (clientFiles.length > 0) {
    lines.push("  classDef client stroke:#dc2626,stroke-width:3px", `  class ${clientFiles.join(",")} client`);
  }
  return lines.join("\n");
};

const slugOf = (page: string): string =>
  "tree-" + page.replace(/^app\/\(root\)\//, "").replace(/\/page\.tsx$/, "").replace(/\[|\]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");

const treePages: string[] = Object.keys(PAGE_TITLES).filter((file: string) => fileSet.has(file));
const treeSections: string[] = [
  "# Component hierarchy per page (generated)",
  "",
  "Generated by `scripts/generate-architecture.ts` from the real imports. Do not edit by hand.",
  "",
  "Each diagram is one page, from the top down: **the page, the components it shows, their hooks, the client service, the API route handler it calls (dashed arrow, `fetch`), and the server services**.",
  "An arrow `A --> B` means **A imports (uses) B**. A red border is a client component (`\"use client\"`): it runs in the browser. The others run on the server.",
  "Schemas, `lib/`, `helpers/` and `constants/` are left out here: see [file-usage.md](./file-usage.md) for who uses them. The overview and the feature flows are in [architecture.md](./architecture.md).",
  "",
  "Colors: " + LAYER_ORDER.filter((layer: TLayer) => layer !== "schema" && layer !== "utility" && layer !== "proxy").map((layer: TLayer) => `**${LAYER_TITLES[layer]}**`).join(", ") + ".",
  "",
];
for (const page of treePages) {
  const { nodes, edges } = treeOf(page);
  treeSections.push(`## ${PAGE_TITLES[page]}`, "", `Page file: \`${page}\` (${nodes.size} files).`, "", diagramBlock(slugOf(page), PAGE_TITLES[page], toTreeMermaid(nodes, edges)));
}
writeFileSync(join(ROOT, "docs", "component-tree.md"), treeSections.join("\n"));
const usageRows: string[] = [
  "# Who uses what (generated)",
  "",
  "Generated by `scripts/generate-architecture.ts` from the real imports. Do not edit by hand.",
  "**Uses** are the project files a file imports. **Used by** are the files that import it. Type-only imports and the `types/` folder are left out. A file that nothing uses is an entry point (a page or a route handler) or may be dead code.",
  "",
];
for (const layer of LAYER_ORDER) {
  const inLayer: string[] = files.filter((file: string) => layerOf(file) === layer).sort();
  if (inLayer.length === 0) continue;
  usageRows.push(`## ${LAYER_TITLES[layer]}`, "", "| File | Uses | Used by |", "|---|---|---|");
  for (const file of inLayer) {
    const format = (list: string[]): string => (list.length === 0 ? "-" : list.map((item: string) => `\`${item}\``).join("<br>"));
    usageRows.push(`| \`${file}\` | ${format(uses.get(file) ?? [])} | ${format((usedBy.get(file) ?? []).sort())} |`);
  }
  usageRows.push("");
}
writeFileSync(join(ROOT, "docs", "file-usage.md"), usageRows.join("\n"));

const unused: string[] = files.filter((file: string) => (usedBy.get(file) ?? []).length === 0 && layerOf(file) !== "page" && layerOf(file) !== "route" && file !== "proxy.ts");
console.log(`${files.length} files. Files that nothing imports (not pages or routes): ${unused.length === 0 ? "none" : unused.join(", ")}`);
