// Agent loop: streams the answer live, and lets a Mate call its tools (JSON protocol) between model turns.
import { chatStream, extractJson, effortOf } from './llm.js';
import { toolsFor, runTool } from './tools.js';
import { buildSystem } from './prompt.js';

const TOOL_TURNS = { low: 2, medium: 3, high: 5, xhigh: 8 }; // more thinking = more room to use tools

/** Decide from the first characters whether a reply is a tool call (JSON) or prose to stream. */
const looksLikeCall = (head) => { const t = head.trimStart(); return t.startsWith('{') || t.startsWith('```'); };
const isCall = (text) => { const j = extractJson(text); return j && typeof j.tool === 'string' ? j : null; };

/**
 * converse: one assistant turn. history = [{role:'user'|'assistant', content}]
 * emit({type:'delta'|'tool'|'tool_result'}) ; returns { text, tools:[{name,ok}] }
 */
export async function converse({ uid, mateKey, cfg = {}, settings, mode = 'chat', history, emit = () => {}, signal, ctx = {}, others = [] }) {
  const effort = effortOf(cfg.thinking);
  const allowed = mode === 'plan' ? [] : toolsFor(cfg.tools ?? [], settings, mateKey);
  const last = [...history].reverse().find((m) => m.role === 'user')?.content ?? '';
  const system = await buildSystem({ uid, mateKey, cfg, mode, query: last, settings, tools: allowed, others });
  const msgs = [{ role: 'system', content: system }, ...history];
  const used = []; const gathered = [];
  const toolCtx = { uid, settings, mate: mateKey, ...ctx };
  const maxTools = allowed.length ? TOOL_TURNS[effort] : 0;
  const maxTokens = mode === 'ultracode' ? 3000 : 1500;

  for (let turn = 0; ; turn++) {
    const canCall = turn < maxTools;
    if (!canCall && used.length && turn === maxTools) msgs.push({ role: 'user', content: 'Tool budget reached. Write your final answer to the owner now, in plain text. Do not output JSON and do not call another tool.' });
    let head = '', streaming = null, buf = '';
    const r = await chatStream(uid, { model: cfg.model || settings.model, messages: msgs, maxTokens, effort, signal }, (d) => {
      buf += d;
      if (streaming === null) {
        head += d;
        if (!head.trim()) return;
        streaming = !(canCall && looksLikeCall(head));
        if (streaming) emit({ type: 'delta', text: head });
        return;
      }
      if (streaming) emit({ type: 'delta', text: d });
    });
    const full = r.text ?? buf;
    if (streaming === null) { streaming = true; if (full) emit({ type: 'delta', text: full }); }

    if (!streaming) {
      const call = isCall(full);
      if (call) {
        emit({ type: 'tool', name: call.tool, args: call.args ?? {} });
        const res = await runTool(call.tool, call.args, toolCtx, allowed);
        used.push({ name: call.tool, ok: res.ok }); gathered.push(`${call.tool}: ${res.text.slice(0, 400)}`);
        emit({ type: 'tool_result', name: call.tool, ok: res.ok });
        msgs.push({ role: 'assistant', content: full.trim() }, { role: 'user', content: `Tool result for ${call.tool}${res.ok ? '' : ' (failed)'}:\n<<<\n${res.text}\n>>>\nContinue. Use another tool only if needed; otherwise give the final answer to the owner now.` });
        continue;
      }
      emit({ type: 'delta', text: full }); // looked like JSON but was not a tool call: show as-is
      return { text: full, tools: used };
    }
    // The model ignored the "no more tools" instruction: never show raw JSON as the answer.
    if (isCall(full) && !canCall) {
      const fb = `I ran out of tool turns before I could finish. What I gathered:\n\n${gathered.slice(-4).map((g) => `- ${g}`).join('\n') || '- (nothing)'}`;
      emit({ type: 'reset' }); emit({ type: 'delta', text: fb });
      return { text: fb, tools: used };
    }
    return { text: full, tools: used };
  }
}
