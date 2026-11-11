// The modder's AI service keys, shared by every EDGE tool on this PC (REDnode #23): read and written
// through keys.mjs, REDnode's library copied unchanged beside this file. An environment variable wins
// when set (OPENAI_API_KEY), for tests and for clients that pass keys.

// keys.mjs is an ES module and this package is CommonJS: esbuild bundles it either way, and TypeScript
// only objects to the module kind, not the types (keys.d.mts).
// @ts-expect-error TS1479
export { checkKey, promises as sharedKeys } from "./keys.mjs";
