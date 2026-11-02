// Tool-call plumbing shared by the agent loop: JSON schemas for tools, and a tolerant parser for models that
// write tool calls as text (<tool_call>, ```json, stray </tool> tags, several calls in one reply...).

const NUM_KEYS = new Set(['n', 'limit', 'hours', 'tail', 'minutes']);
/** Derive an OpenAI function schema from a tool's example `args` string ({"key": "description"}). */
export function toSchema(t) {
  let ex = {}; try { ex = JSON.parse(t.args || '{}'); } catch { /* no params */ }
  const properties = {}; const required = [];
  for (const [rawKey, v] of Object.entries(ex)) {
    const k = rawKey.replace(/\?$/, ''); const hint = String(v) + (rawKey.endsWith('?') ? ' optional' : '');
    const isEnum = /^\w+(\|\w+)+( optional)?$/.test(hint);
    properties[k] = isEnum ? { type: 'string', enum: hint.replace(/ optional$/, '').split('|') } : NUM_KEYS.has(k) || typeof v === 'number' ? { type: 'number', description: k } : { type: 'string', description: hint };
    if (!/optional/i.test(hint) && typeof v !== 'number') required.push(k);
  }
  Object.assign(properties, t.props ?? {});
  return { type: 'function', function: { name: t.name, description: t.desc, parameters: { type: 'object', properties, required } } };
}
export const toOpenAI = (tools) => tools.map(toSchema);

/** Every top-level balanced {...} in text (string-aware). */
function objects(text) {
  const out = []; let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') { if (depth > 0) inStr = true; continue; }
    if (ch === '{') { if (depth === 0) start = i; depth++; }
    else if (ch === '}' && depth > 0 && --depth === 0) { out.push(text.slice(start, i + 1)); start = -1; }
  }
  return out;
}

/** Text -> [{id,name,args}]. Accepts {"tool","args"}, {"name","arguments"|"parameters"}, <tool_call>...</tool_call>, <function=name>{...}. */
export function parseTextCalls(text, known) {
  const calls = [];
  const take = (name, args) => { if (typeof name === 'string' && (!known || known.has(name)) && calls.length < 6) calls.push({ id: `txt_${calls.length}`, name, args: args && typeof args === 'object' ? args : {} }); };
  for (const m of text.matchAll(/<function=([\w.-]+)>\s*(\{[\s\S]*?\})\s*(?:<\/function>|$)/g)) { try { take(m[1], JSON.parse(m[2])); } catch { /* skip */ } }
  if (calls.length) return calls;
  for (const o of objects(text)) {
    let j; try { j = JSON.parse(o); } catch { continue; }
    if (!j || typeof j !== 'object') continue;
    if (typeof j.tool === 'string') take(j.tool, j.args ?? j.arguments ?? j.parameters ?? j.input);
    else if (typeof j.name === 'string' && (j.arguments || j.parameters || j.args)) take(j.name, j.arguments ?? j.parameters ?? j.args);
    else if (j.function?.name) take(j.function.name, j.function.arguments ?? j.function.parameters);
  }
  return calls;
}

/** The text-mode protocol block (only used for providers without native tool calling). */
export const protocolBlock = (tools) => `You can use tools. To use tools, reply with ONLY one JSON object per line, nothing else, for example:\n{"tool": "web_search", "args": {"query": "..."}}\nSeveral independent calls may be written on separate lines. You will then receive the results. When you have what you need, answer normally with no JSON.\n\nTools:\n${tools.map((t) => `- ${t.name} ${t.args} - ${t.desc}`).join('\n')}`;

/** Native-format history -> text-format history (for providers that cannot do native tool calls). */
export function toTextMessages(msgs) {
  const out = [];
  for (const m of msgs) {
    if (m.role === 'assistant' && m.tool_calls?.length) out.push({ role: 'assistant', content: [m.content, ...m.tool_calls.map((c) => JSON.stringify({ tool: c.function.name, args: JSON.parse(c.function.arguments || '{}') }))].filter(Boolean).join('\n') });
    else if (m.role === 'tool') out.push({ role: 'user', content: `Tool result for ${m.name ?? 'tool'}${m.is_error ? ' (failed)' : ''}:\n<<<\n${m.content}\n>>>\nContinue. Use more tools only if needed; otherwise give the final answer now.` });
    else out.push(m);
  }
  return out;
}
