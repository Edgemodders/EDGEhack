// Bundles the extension (CommonJS, VS Code's module loader); the editor page's script joins it in
// E1. `node esbuild.mjs --watch` rebuilds on change; `--tests` bundles test/*.test.ts for `node --test "dist-test/*.test.cjs"`; `--production`
// (vsce's prepublish) minifies, with no source maps.
import * as esbuild from "esbuild";
import * as fs from "node:fs";

const watch = process.argv.includes("--watch");
const tests = process.argv.includes("--tests");
const production = process.argv.includes("--production");

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

if (tests) await esbuild.build(testBuild);
else if (watch) await Promise.all([extension].map(async (o) => (await esbuild.context(o)).watch()));
else await Promise.all([extension].map((o) => esbuild.build(o)));
