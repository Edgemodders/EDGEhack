// Bundles the extension (CommonJS, VS Code's module loader) and the MCP server (H4.5). `node esbuild.mjs
// --watch` rebuilds the extension on change; `--tests` bundles test/*.test.ts for `node --test
// "dist-test/*.test.cjs"`; `--production` (vsce's prepublish) minifies, with no source maps.
//
// The server is one file with the MCP SDK and zod inside, so `node server.cjs` needs nothing else: it
// is published to npm from packages/edgehack-mcp/dist/server.cjs, and the extension carries the same
// file as dist/mcp/edgehack-mcp.cjs, for Connect an Assistant. Its version is EDGEhack's.
import * as esbuild from "esbuild";
import * as fs from "node:fs";
import * as path from "node:path";

const watch = process.argv.includes("--watch");
const tests = process.argv.includes("--tests");
const production = process.argv.includes("--production");
const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;

const common = { bundle: true, sourcemap: !production, minify: production, logLevel: "info" };

const extension = {
  ...common,
  platform: "node",
  format: "cjs",
  target: "node20",
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  external: ["vscode"],
};

const server = {
  ...common,
  minify: false,
  platform: "node",
  format: "cjs",
  target: "node20",
  entryPoints: ["packages/edgehack-mcp/src/server.ts"],
  outfile: "packages/edgehack-mcp/dist/server.cjs",
  define: { __VERSION__: JSON.stringify(version) },
  banner: { js: "#!/usr/bin/env node" },
  metafile: true,
};

const testBuild = {
  ...common,
  platform: "node",
  format: "cjs",
  target: "node20",
  entryPoints: fs.readdirSync("test").filter((f) => f.endsWith(".test.ts")).map((f) => `test/${f}`),
  outdir: "dist-test",
  outExtension: { ".js": ".cjs" },
  logLevel: "warning",
};

/**
 * The npm packages a bundle holds, each with its version, license and license text: MIT and similar
 * licenses ask for the notice to travel with the code, so both copies of the server carry it.
 */
function notices(metafile) {
  const dirs = new Set();
  for (const input of Object.keys(metafile.inputs)) {
    const m = /^(.*?node_modules[\\/](?:@[^\\/]+[\\/])?[^\\/]+)/.exec(input);
    if (m) dirs.add(m[1]);
  }
  const parts = [...dirs].sort().map((dir) => {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    const file = fs.readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
    const text = file ? fs.readFileSync(path.join(dir, file), "utf8").trim() : `License: ${pkg.license ?? "see the package"}`;
    return `${pkg.name} ${pkg.version} (${pkg.license ?? "unknown"})

${text}`;
  });
  return `Third-party software in EDGEhack's MCP server (edgehack-mcp), bundled into one file:

${parts.join(`

${"-".repeat(72)}

`)}
`;
}

/** The server, its third-party notices, and the copy of both in the extension. */
async function buildServer() {
  const result = await esbuild.build(server);
  const text = notices(result.metafile);
  fs.writeFileSync("packages/edgehack-mcp/THIRD-PARTY-NOTICES.txt", text);
  fs.mkdirSync("dist/mcp", { recursive: true });
  fs.copyFileSync(server.outfile, "dist/mcp/edgehack-mcp.cjs");
  fs.writeFileSync("dist/mcp/THIRD-PARTY-NOTICES.txt", text);
}

if (tests) await esbuild.build(testBuild);
else if (watch) await (await esbuild.context(extension)).watch();
else await Promise.all([esbuild.build(extension), buildServer()]);
