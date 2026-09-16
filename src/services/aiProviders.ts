// ─── AI Providers ─────────────────────────────────────────────────────────────
//  Bring-Your-Own-Key (BYOK) abstraction over four chat LLM providers.
//  Every call is a direct browser → provider fetch; the user's key never leaves
//  their machine except to the provider they chose. No backend involved.

export type ProviderId = 'openai' | 'gemini' | 'claude' | 'groq';

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  blurb: string;          // one-line description shown on the picker card
  defaultModel: string;
  keyLabel: string;       // e.g. "sk-..."
  keyUrl: string;         // where the user creates a key
  free: boolean;          // has a usable free tier
  accent: string;         // brand-ish accent colour for the card
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  groq: {
    id: 'groq',
    name: 'Groq',
    blurb: 'Llama 3.3 70B · very fast, free tier',
    defaultModel: 'llama-3.3-70b-versatile',
    keyLabel: 'gsk_...',
    keyUrl: 'https://console.groq.com/keys',
    free: true,
    accent: '#f55036',
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    blurb: 'Gemini 2.0 Flash · generous free tier',
    defaultModel: 'gemini-2.0-flash',
    keyLabel: 'AIza...',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    free: true,
    accent: '#4285f4',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    blurb: 'GPT-4o mini · paid',
    defaultModel: 'gpt-4o-mini',
    keyLabel: 'sk-...',
    keyUrl: 'https://platform.openai.com/api-keys',
    free: false,
    accent: '#10a37f',
  },
  claude: {
    id: 'claude',
    name: 'Anthropic Claude',
    blurb: 'Claude 3.5 Sonnet · paid',
    defaultModel: 'claude-3-5-sonnet-latest',
    keyLabel: 'sk-ant-...',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    free: false,
    accent: '#d97757',
  },
};

/** Display order for the provider picker (free options first). */
export const PROVIDER_ORDER: ProviderId[] = ['groq', 'gemini', 'openai', 'claude'];

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatArgs {
  provider: ProviderId;
  apiKey: string;
  model: string;
  system: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
}

/** Send a chat completion and return the assistant's text reply. */
export async function chatComplete(args: ChatArgs): Promise<string> {
  switch (args.provider) {
    case 'openai': return openAiCompatible('https://api.openai.com/v1/chat/completions', args);
    case 'groq':   return openAiCompatible('https://api.groq.com/openai/v1/chat/completions', args);
    case 'gemini': return geminiComplete(args);
    case 'claude': return claudeComplete(args);
    default:       throw new Error(`Unknown provider: ${args.provider as string}`);
  }
}

// ─── OpenAI-compatible (OpenAI + Groq) ─────────────────────────────────────────
async function openAiCompatible(url: string, args: ChatArgs): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      messages: [{ role: 'system', content: args.system }, ...args.messages],
      temperature: 0.3,
    }),
    signal: args.signal,
  });
  if (!res.ok) throw await httpError(res);
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content ?? '').trim() || '(the model returned an empty reply)';
}

// ─── Google Gemini ─────────────────────────────────────────────────────────────
async function geminiComplete(args: ChatArgs): Promise<string> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}` +
    `:generateContent?key=${encodeURIComponent(args.apiKey)}`;
  const contents = args.messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: args.system }] },
      generationConfig: { temperature: 0.3 },
    }),
    signal: args.signal,
  });
  if (!res.ok) throw await httpError(res);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p: { text?: string }) => p.text ?? '').join('');
  return text.trim() || '(the model returned an empty reply)';
}

// ─── Anthropic Claude ──────────────────────────────────────────────────────────
async function claudeComplete(args: ChatArgs): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': args.apiKey,
      'anthropic-version': '2023-06-01',
      // Required to allow calling the Anthropic API directly from a browser.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: 1024,
      system: args.system,
      messages: args.messages,
    }),
    signal: args.signal,
  });
  if (!res.ok) throw await httpError(res);
  const data = await res.json();
  const blocks = data?.content ?? [];
  const text = blocks.map((b: { text?: string }) => b.text ?? '').join('');
  return text.trim() || '(the model returned an empty reply)';
}

// ─── Error formatting ──────────────────────────────────────────────────────────
async function httpError(res: Response): Promise<Error> {
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.error?.message ?? body?.message ?? '';
  } catch {
    detail = await res.text().catch(() => '');
  }
  const hint =
    res.status === 401 || res.status === 403 ? ' — check that your API key is correct and active'
    : res.status === 429 ? ' — rate limit or quota exceeded, try again shortly'
    : res.status === 404 ? ' — model name not found for this provider'
    : '';
  const trimmed = detail ? `: ${detail.slice(0, 240)}` : '';
  return new Error(`Request failed (${res.status})${hint}${trimmed}`);
}
