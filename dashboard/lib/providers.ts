/** Model providers. Base URLs and model IDs are suggestions: "Fetch models" asks the provider what it actually offers. */
export type Auth = 'bearer' | 'anthropic';
export type Preset = { id: string; name: string; baseUrl: string; auth: Auth; hint: string; models: string[]; keyless?: boolean; group: 'Frontier' | 'Open & hosting' | 'Local' };

export const PRESETS: Preset[] = [
  { id: 'anthropic', name: 'Anthropic (Claude)', baseUrl: 'https://api.anthropic.com/v1', auth: 'anthropic', group: 'Frontier', hint: 'console.anthropic.com', models: ['claude-fable-5-1', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] },
  { id: 'openai', name: 'OpenAI (ChatGPT)', baseUrl: 'https://api.openai.com/v1', auth: 'bearer', group: 'Frontier', hint: 'platform.openai.com', models: ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna'] },
  { id: 'google', name: 'Google (Gemini)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', auth: 'bearer', group: 'Frontier', hint: 'aistudio.google.com', models: ['gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite'] },
  { id: 'xai', name: 'xAI (Grok)', baseUrl: 'https://api.x.ai/v1', auth: 'bearer', group: 'Frontier', hint: 'console.x.ai', models: ['grok-4.5'] },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', auth: 'bearer', group: 'Frontier', hint: 'platform.deepseek.com', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { id: 'zai', name: 'Z.ai (GLM)', baseUrl: 'https://api.z.ai/api/paas/v4', auth: 'bearer', group: 'Frontier', hint: 'z.ai/manage-apikey', models: ['glm-4.6'] },
  { id: 'nim', name: 'NVIDIA NIM', baseUrl: 'https://integrate.api.nvidia.com/v1', auth: 'bearer', group: 'Open & hosting', hint: 'build.nvidia.com', models: ['nvidia/nemotron-3-super-120b-a12b', 'meta/llama-3.3-70b-instruct'] },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', auth: 'bearer', group: 'Open & hosting', hint: 'openrouter.ai/keys', models: [] },
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', auth: 'bearer', group: 'Open & hosting', hint: 'console.groq.com', models: [] },
  { id: 'together', name: 'Together AI', baseUrl: 'https://api.together.ai/v1', auth: 'bearer', group: 'Open & hosting', hint: 'api.together.ai', models: [] },
  { id: 'fireworks', name: 'Fireworks AI', baseUrl: 'https://api.fireworks.ai/inference/v1', auth: 'bearer', group: 'Open & hosting', hint: 'fireworks.ai', models: [] },
  { id: 'cerebras', name: 'Cerebras', baseUrl: 'https://api.cerebras.ai/v1', auth: 'bearer', group: 'Open & hosting', hint: 'cloud.cerebras.ai', models: [] },
  { id: 'mistral', name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', auth: 'bearer', group: 'Open & hosting', hint: 'console.mistral.ai', models: [] },
  { id: 'moonshot', name: 'Moonshot (Kimi)', baseUrl: 'https://api.moonshot.ai/v1', auth: 'bearer', group: 'Open & hosting', hint: 'platform.moonshot.ai', models: [] },
  { id: 'hf', name: 'Hugging Face', baseUrl: 'https://router.huggingface.co/v1', auth: 'bearer', group: 'Open & hosting', hint: 'huggingface.co/settings/tokens', models: [] },
  { id: 'ollama', name: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', auth: 'bearer', group: 'Local', keyless: true, hint: 'runs on your machine', models: [] },
  { id: 'lmstudio', name: 'LM Studio (local)', baseUrl: 'http://localhost:1234/v1', auth: 'bearer', group: 'Local', keyless: true, hint: 'runs on your machine', models: [] },
  { id: 'custom', name: 'Custom OpenAI-compatible', baseUrl: '', auth: 'bearer', group: 'Local', hint: 'any server that speaks /v1/models and /v1/chat/completions', models: [] },
];
export const PRESET = Object.fromEntries(PRESETS.map((p) => [p.id, p])) as Record<string, Preset>;

/** A model is addressed as `${providerId}::${modelId}`. Empty string means "workspace default". */
export const modelKey = (providerId: string, model: string) => `${providerId}::${model}`;
export const splitModel = (v: string) => { const i = v.indexOf('::'); return i < 0 ? { provider: '', model: v } : { provider: v.slice(0, i), model: v.slice(i + 2) }; };

export type FetchArgs = { baseUrl: string; apiKey: string; auth: Auth };

/** Direct browser call to `${baseUrl}/models`. Many providers block browsers (CORS); the error says so. */
export async function fetchModelList({ baseUrl, apiKey, auth }: FetchArgs): Promise<string[]> {
  const url = `${baseUrl.replace(/\/+$/, '')}/models`;
  const headers: Record<string, string> = auth === 'anthropic'
    ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }
    : apiKey ? { authorization: `Bearer ${apiKey}` } : {};
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url, { headers, signal: ctl.signal });
    if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'The provider rejected the API key.' : `The provider answered ${res.status}.`);
    const body = (await res.json()) as { data?: { id: string }[]; models?: { name?: string; id?: string }[] };
    const raw = body.data?.map((m) => m.id) ?? body.models?.map((m) => m.id ?? m.name ?? '') ?? [];
    const ids = raw.filter(Boolean).map((id) => id.replace(/^models\//, ''));
    if (ids.length === 0) throw new Error('The provider returned no models.');
    return [...new Set(ids)].sort();
  } catch (e) {
    if (e instanceof Error && /key|answered|no models/.test(e.message)) throw e;
    throw new Error('Could not reach the provider from the browser. Check the base URL, or connect the backend, which can make this call for you (CORS blocks many providers).');
  } finally { clearTimeout(timer); }
}
