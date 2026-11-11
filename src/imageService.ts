// OpenAI's GPT Image for Generate (H3b.3; design, "Own icons (H3b)"): the modder's own key and credits,
// nothing called until they click. Plain fetch, with a time limit and cancel. The model comes from the
// key's own account (`gpt-image*`), so a new one shows without an update. Shaped after EDGEmat's
// imageServices.ts, OpenAI only. No VS Code, so H4's MCP server can use it.

export const OPENAI = { name: "OpenAI", base: "https://api.openai.com", keyFrom: "platform.openai.com > API keys" };

export interface CallOptions {
  key: string;
  /** Another server, for tests. */
  base?: string;
  /** 0 or less: no limit. Default 3 minutes. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

export type Quality = "low" | "medium" | "high" | "auto";

/** The sizes GPT Image draws: square, or portrait for the item card. */
export type ImageSize = "1024x1024" | "1024x1536";

export class ImageServiceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** A service's error body in plain words: its message when it has one, else the start of the text. */
export function errorText(status: number, body: string): string {
  try {
    const j = JSON.parse(body) as { error?: { message?: unknown } | string; message?: unknown };
    const e = j.error;
    if (typeof e === "string") return e;
    if (e && typeof e.message === "string") return e.message;
    if (typeof j.message === "string") return j.message;
  } catch {
    // Not JSON.
  }
  return body.trim().slice(0, 300) || `HTTP ${status}`;
}

/** What a status means to a modder, before the service's own words. */
function statusWords(status: number): string {
  if (status === 401 || status === 403) return "OpenAI refused the key";
  if (status === 429) return "OpenAI says too many requests, or the credits ran out";
  if (status >= 500) return "OpenAI had a problem on its side";
  return "OpenAI refused the request";
}

async function call(path: string, opts: CallOptions, init: { body?: unknown; form?: FormData }): Promise<any> {
  const limit = opts.timeoutMs ?? 180_000;
  const signals = [opts.signal, limit > 0 ? AbortSignal.timeout(limit) : undefined].filter(Boolean) as AbortSignal[];
  const url = new URL(path, (opts.base ?? OPENAI.base).replace(/\/+$/, "") + "/");
  let res: Response;
  try {
    // A form (files) sets its own content type with its boundary.
    res = await fetch(url, {
      method: init.body === undefined && !init.form ? "GET" : "POST",
      headers: { authorization: `Bearer ${opts.key}`, ...(init.body === undefined ? {} : { "content-type": "application/json" }) },
      body: init.form ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
      signal: signals.length ? AbortSignal.any(signals) : undefined,
    });
  } catch (e) {
    if (opts.signal?.aborted) throw new ImageServiceError("Cancelled.");
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) throw new ImageServiceError(`No answer from OpenAI in ${Math.round(limit / 1000)} s. Try again.`);
    throw new ImageServiceError(`Could not reach OpenAI: ${e instanceof Error ? e.message : String(e)}. Check the internet connection.`);
  }
  let text: string;
  try {
    text = await res.text();
  } catch (e) {
    if (opts.signal?.aborted) throw new ImageServiceError("Cancelled.");
    throw new ImageServiceError(`OpenAI's answer broke off: ${e instanceof Error ? e.message : String(e)}.`);
  }
  if (!res.ok) throw new ImageServiceError(`${statusWords(res.status)}: ${errorText(res.status, text)}`, res.status);
  try {
    return JSON.parse(text);
  } catch {
    throw new ImageServiceError("OpenAI sent something EDGEhack cannot read (not JSON).");
  }
}

/** Newest-looking first: higher version numbers ahead, "mini" after the rest. */
function byPreference(a: string, b: string): number {
  const rank = (m: string) => (/(^|[-_.])mini([-_.]|$)/i.test(m) ? 1 : 0);
  return rank(a) - rank(b) || b.localeCompare(a, undefined, { numeric: true });
}

/** The GPT Image models the key's account can use, newest-looking first. */
export async function listModels(opts: CallOptions): Promise<string[]> {
  const j = await call("v1/models", opts, {});
  return (j?.data ?? [])
    .map((m: { id?: unknown }) => String(m.id ?? ""))
    .filter((id: string) => /^gpt-image/i.test(id))
    .sort(byPreference);
}

function imageOf(j: any): Buffer {
  const b64 = j?.data?.[0]?.b64_json;
  if (typeof b64 !== "string" || !b64) throw new ImageServiceError("OpenAI sent no image.");
  return Buffer.from(b64, "base64");
}

/** One picture from words, as PNG bytes. */
export async function generateImage(model: string, prompt: string, size: ImageSize, opts: CallOptions & { quality?: Quality }): Promise<Buffer> {
  return imageOf(await call("v1/images/generations", opts, { body: { model, prompt, size, n: 1, quality: opts.quality ?? "medium", output_format: "png" } }));
}

/** One picture from words and a reference picture (PNG), as PNG bytes. */
export async function editImage(model: string, prompt: string, image: Buffer, size: ImageSize, opts: CallOptions & { quality?: Quality }): Promise<Buffer> {
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("n", "1");
  form.append("size", size);
  form.append("quality", opts.quality ?? "medium");
  form.append("output_format", "png");
  form.append("image[]", new Blob([new Uint8Array(image)], { type: "image/png" }), "reference.png");
  return imageOf(await call("v1/images/edits", opts, { form }));
}
