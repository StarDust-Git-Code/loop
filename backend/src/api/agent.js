// Agent loop: streams the answer live, and lets a Mate call its tools (JSON protocol) between model turns.
import { chatStream, extractJson } from './llm.js';
import { toolsFor, runTool } from './tools.js';
import { buildSystem } from './prompt.js';

const MAX_TOOL_TURNS = 4;

/** Decide from the first characters whether a reply is a tool call (JSON) or prose to stream. */
function looksLikeCall(head) { const t = head.trimStart(); return t.startsWith('{') || t.startsWith('```'); }

/**
 * converse: one assistant turn. history = [{role:'user'|'assistant', content}]
 * emit({type:'delta'|'tool'|'tool_result'|'reset', ...}) ; returns { text, tools:[{name,args,ok}] }
 */
export async function converse({ uid, mateKey, cfg = {}, settings, mode = 'chat', history, emit = () => {}, signal, ctx = {}, maxTools = MAX_TOOL_TURNS }) {
  const allowed = mode === 'plan' ? [] : toolsFor(cfg.tools ?? [], settings);
  const last = [...history].reverse().find((m) => m.role === 'user')?.content ?? '';
  const system = await buildSystem({ uid, mateKey, cfg, mode, query: last, settings, tools: allowed });
  const msgs = [{ role: 'system', content: system }, ...history];
  const used = [];
  const toolCtx = { uid, settings, mate: mateKey, ...ctx };

  for (let turn = 0; ; turn++) {
    let head = '', streaming = null, buf = '';
    const canCall = allowed.length && turn < maxTools;
    const r = await chatStream(uid, { model: cfg.model || settings.model, messages: msgs, maxTokens: mode === 'ultracode' ? 3000 : 1500, signal }, (d) => {
      buf += d;
      if (streaming === null) {
        head += d;
        if (head.trim().length < 1) return;
        streaming = !(canCall && looksLikeCall(head));
        if (streaming) emit({ type: 'delta', text: head });
        return;
      }
      if (streaming) emit({ type: 'delta', text: d });
    });
    const full = r.text ?? buf;
    if (streaming === null) { streaming = true; if (full) emit({ type: 'delta', text: full }); }

    if (!streaming) {
      const call = extractJson(full);
      if (call?.tool && typeof call.tool === 'string') {
        emit({ type: 'tool', name: call.tool, args: call.args ?? {} });
        const res = await runTool(call.tool, call.args, toolCtx, allowed);
        used.push({ name: call.tool, ok: res.ok });
        emit({ type: 'tool_result', name: call.tool, ok: res.ok });
        msgs.push({ role: 'assistant', content: full.trim() }, { role: 'user', content: `Tool result for ${call.tool}${res.ok ? '' : ' (failed)'}:\n<<<\n${res.text}\n>>>\nContinue. Use another tool only if needed; otherwise give the final answer to the owner now.` });
        continue;
      }
      // looked like JSON but was not a tool call: show it as-is
      emit({ type: 'delta', text: full });
    }
    return { text: full, tools: used };
  }
}
