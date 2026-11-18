// Prints the release notes for one version from its section of CHANGELOG.md. The Release workflow
// uses it for the GitHub release, and stops when the version has no section.
//
//   node tools/release-notes.mjs [version]            markdown for GitHub
//   node tools/release-notes.mjs [version] --nexus    the section's short Nexus summary (see below), for
//                                                     Nexus's changelog field; stops when there is none
//   --out <file>                                      writes the notes to a file (UTF-8)
//
// The version defaults to package.json's.
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const nexus = args.includes("--nexus");
const outAt = args.indexOf("--out");
const out = outAt >= 0 ? args.splice(outAt, 2)[1] : null;
const version = args.find((a) => !a.startsWith("--")) ?? JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const lines = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8").split(/\r?\n/);

// "## 0.1.0" or "## 0.1.0 (2026-10-20)"
const heading = new RegExp(`^## ${version.replace(/\./g, "\\.")}(\\s|$)`);
const start = lines.findIndex((line) => heading.test(line));
if (start < 0) {
  console.error(`CHANGELOG.md has no section for ${version}: rename Unreleased to "## ${version} (date)" first`);
  process.exit(1);
}
let end = lines.findIndex((line, i) => i > start && line.startsWith("## "));
if (end < 0) end = lines.length;
const section = lines.slice(start + 1, end);
if (!section.some((line) => line.trim())) {
  console.error(`CHANGELOG.md: the section for ${version} is empty`);
  process.exit(1);
}

// The section for GitHub: without its Nexus summary (below).
const github = [];
for (let i = 0, inBlock = false; i < section.length; i++) {
  if (!inBlock && section[i].trim() === '<!-- nexus') inBlock = true;
  else if (inBlock && section[i].trim() === '-->') inBlock = false;
  else if (!inBlock) github.push(section[i]);
}

if (nexus) {
  // Nexus shows each line of a version's changelog as one entry, as plain text in a small field,
  // so its lines are a short summary written by hand in the section, not the section itself:
  //
  //   <!-- nexus
  //   New: Hide in the pause menu, on by default (F10 still works there)
  //   Fixed: Update REDbridge while it ran kept the old version
  //   -->
  //
  // An HTML comment, so GitHub and the docs site show none of it. Each line starts with New:,
  // Changed:, Fixed:, Other: or Needs:, has no markdown and at most NEXUS_LINE characters; at most
  // NEXUS_LINES lines. A "Full changelog" line with the link is added at the end.
  const NEXUS_LINE = 120;
  const NEXUS_LINES = 12;
  const open = section.findIndex(line => line.trim() === '<!-- nexus');
  const close = open < 0 ? -1 : section.findIndex((line, i) => i > open && line.trim() === '-->');
  if (open < 0 || close < 0) {
    console.error(`CHANGELOG.md: the section for ${version} has no Nexus summary. Add one under its heading:

<!-- nexus
New: one short line per change, at most ${NEXUS_LINE} characters
-->`);
    process.exit(1);
  }
  const summary = section.slice(open + 1, close).map(line => line.trim()).filter(Boolean);
  const wrong = [];
  if (!summary.length) wrong.push('it is empty');
  if (summary.length > NEXUS_LINES) wrong.push(`${summary.length} lines, at most ${NEXUS_LINES}`);
  for (const line of summary) {
    if (!/^(New|Changed|Fixed|Other|Needs): \S/.test(line)) wrong.push(`"${line}" does not start with New:, Changed:, Fixed:, Other: or Needs:`);
    if (line.length > NEXUS_LINE) wrong.push(`"${line.slice(0, 50)}..." is ${line.length} characters, at most ${NEXUS_LINE}`);
    if (/`|\*\*|\]\(/.test(line)) wrong.push(`"${line.slice(0, 50)}..." has markdown`);
  }
  if (wrong.length) {
    console.error(`CHANGELOG.md: the Nexus summary for ${version}:\n- ${wrong.join('\n- ')}`);
    process.exit(1);
  }
  const full = 'https://github.com/Edgemodders/EDGEhack/blob/main/CHANGELOG.md';
  write([...summary, `Full changelog: ${full}`].join('\n'));
} else {
  write(`${github.join("\n").trim()}

**Install:** from the VS Code Marketplace or Open VSX (search for EDGEhack), or the \`.vsix\` below with Extensions > ... > Install from VSIX... Docs: https://edgemodders.github.io/EDGEhack/ (changelog: https://github.com/Edgemodders/EDGEhack/blob/main/CHANGELOG.md)`);
}

function write(text) {
  if (out) fs.writeFileSync(out, text + "\n", "utf8");
  else console.log(text);
}
