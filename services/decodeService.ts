type ActiveGen = {
  controller: AbortController;
  reader?: ReadableStreamDefaultReader<Uint8Array>;
  closed: Promise<void>;
  resolveClosed: () => void;
  sessionId: string;
};

let activeGen: ActiveGen | null = null;
const td = new TextDecoder();

export const DECODE_DEFAULTS = {
  temperature: 0.7,
  top_p: 0.9,
  top_k: 40,
  min_p: 0.08,
  repeat_penalty: 1.18,
  repeat_last_n: 256,
  penalize_nl: false,
  n_predict: 512,
  stop: ["<|endoftext|>", "</s>", "<|return|>", "### END"],
  cache_prompt: false,
  stream: true
};

export function looksDegenerate(s: string): boolean {
  const tail = s.slice(-400);
  const compact = tail.replace(/\s+/g, "");
  const uniq = new Set(compact.split(""));
  if (tail.length >= 60 && uniq.size <= 3) return true;
  if (/(#{3,}|\?{6,}|\.{6,}|—{6,})/.test(tail)) return true;
  return false;
}

export function buildRequestBody(input: {
  url: string;
  prompt: string;
  params?: Partial<typeof DECODE_DEFAULTS>;
  sessionPrefix?: string;
}) {
  const sessionId = (input.sessionPrefix || "llamahub") + "-" + crypto.randomUUID();
  const body = {
    prompt: input.prompt,
    id_session: sessionId,
    ...DECODE_DEFAULTS,
    ...(input.params || {})
  };
  return { sessionId, body: JSON.stringify(body) };
}

export async function startGeneration(opts: {
  url: string;
  body: string;
  sessionId: string;
  onText: (chunk: string) => void;
  onDone?: () => void;
}) {
  await activeGen?.closed.catch(() => {});
  activeGen = null;

  const controller = new AbortController();
  let resolveClosed!: () => void;
  const closed = new Promise<void>(r => (resolveClosed = r));

  const res = await fetch(opts.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: opts.body,
    signal: controller.signal
  });

  const reader = res.body?.getReader();
  activeGen = { controller, reader, closed, resolveClosed, sessionId: opts.sessionId };

  try {
    for (;;) {
      const r = await reader!.read();
      if (r.done) break;
      const text = td.decode(r.value, { stream: true });
      opts.onText(text);
    }
  } catch (err: any) {
    if (err?.name !== "AbortError") throw err;
  } finally {
    try { await reader?.cancel(); } catch {}
    opts.onDone?.();
    resolveClosed();
    activeGen = null;
  }
}

export async function stopGeneration() {
  if (!activeGen) return;
  const { controller, closed } = activeGen;
  controller.abort();
  await closed;
}

export async function generateWithGuard(input: {
  url: string;
  prompt: string;
  params?: Partial<typeof DECODE_DEFAULTS>;
  onText: (chunk: string) => void;
  onDone?: () => void;
}) {
  let buffer = "";
  let retried = false;

  const run = async (params: Partial<typeof DECODE_DEFAULTS>) => {
    const { sessionId, body } = buildRequestBody({ url: input.url, prompt: input.prompt, params });
    await startGeneration({
      url: input.url,
      body,
      sessionId,
      onText: async (chunk) => {
        buffer += chunk;
        input.onText(chunk);
        if (!retried && looksDegenerate(buffer)) {
          retried = true;
          await stopGeneration();
          const safer = {
            ...params,
            temperature: Math.min(1.0, (params.temperature ?? DECODE_DEFAULTS.temperature) + 0.1),
            repeat_penalty: (params.repeat_penalty ?? DECODE_DEFAULTS.repeat_penalty) + 0.05,
            n_predict: Math.min(512, params.n_predict ?? DECODE_DEFAULTS.n_predict)
          };
          buffer = "";
          await run(safer);
        }
      },
      onDone: input.onDone
    });
  };

  await run(input.params || {});
}

export async function sendMessage(url: string, prompt: string, params?: Partial<typeof DECODE_DEFAULTS>) {
  try {
    await generateWithGuard({
      url,
      prompt,
      params,
      onText: (_t) => {},
      onDone: () => {}
    });
  } catch (err: any) {
    if (err?.name === "AbortError") return;
    throw err;
  }
}

export type GenState = "idle" | "requesting" | "streaming" | "stopping" | "complete" | "aborted";

export async function exampleSendMessage() {
  await sendMessage("http://localhost:8082/completion", "Respond with \"DONE\" and stop.", {
    stop: ["<|endoftext|>", "</s>", "<|return|>", "DONE"]
  });
}
