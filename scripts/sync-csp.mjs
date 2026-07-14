import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const cspTs = readFileSync(join(root, "lib", "csp.ts"), "utf-8");

const directives = [];
for (const line of cspTs.split("\n")) {
  const trimmed = line.trim();
  const match = trimmed.match(/^"(.+)"[,;\]]?$/);
  if (match && !trimmed.startsWith("export")) {
    directives.push(match[1]);
  }
}

const canonicalCsp = directives.join("; ");

if (!canonicalCsp) {
  console.error("Could not extract CSP directives from lib/csp.ts");
  process.exit(1);
}

const vercelPath = join(root, "vercel.json");
const vercelRaw = readFileSync(vercelPath, "utf-8");
const vercelConfig = JSON.parse(vercelRaw);

for (const headerGroup of vercelConfig.headers ?? []) {
  if (headerGroup.source === "/(.*)") {
    for (const h of headerGroup.headers ?? []) {
      if (h.key === "Content-Security-Policy") {
        h.value = canonicalCsp;
      }
    }
  }
}

writeFileSync(vercelPath, JSON.stringify(vercelConfig, null, 2) + "\n");
console.log("✓ vercel.json synced from lib/csp.ts");
