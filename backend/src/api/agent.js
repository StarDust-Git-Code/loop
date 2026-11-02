// Agent loop, modelled on how Claude Code works:
//  - tools are described to the model as typed JSON schemas and called through the provider's native tool-call API
//  - one turn may contain several tool calls; independent read-only calls run in parallel, writes run in order
//  - results go back as tool messages, the loop repeats until the model answers without calling a tool
//  - repeated identical calls are cached, a budget ends runaway loops with a forced final answer
//  - providers without native tool calling get the same loop through a tolerant text protocol
import { chatStream, effortOf } from './llm.js';
import { toolsFor, runTool } from './tools.js';
import { buildSystem } from './prompt.js';
import { toOpenAI, parseTextCalls, protocolBlock, toTextMessages } from './toolcalls.js';

const TOOL_TURNS = { low: 2, medium: 3, high: 5, xhigh: 8 }; // more thinking = more room to use tools
const MAX_PARALLEL = 6;
const HEAD_CALL = /^\s*(\{|```|<)/;
const callish = (t) => HEAD_CALL.test(t) || /"tool"\s*:|<tool_call>|<function=/.test(t);
/** Only the standard fields go to the provider. */
const clean = (msgs) => msgs.map((m) => (m.role === 'tool' ? { role: 'tool', tool_call_id: m.tool_call_id, content: m.content } : m.role === 'assistant' && m.tool_calls ? { role: 'assistant', content: m.content || null, tool_calls: m.tool_calls } : { role: m.role, content: m.content }));

/**
 * converse: one assistant turn. history = [{role:'user'|'assistant', content}]
 * emit({type:'delta'|'reset'|'tool'|'tool_result'}) ; returns { text, tools:[{name,ok}] }
 */
export async function converse({ uid, mateKey, cfg = {}, settings, mode = 'chat', history, emit = () => {}, signal, ctx = {}, others = [] }) {
  const effort = effortOf(cfg.thinking);
  const allowed = mode === 'plan' ? [] : toolsFor(cfg.tools ?? [], settings, mateKey);
  const known = new Set(allowed.map((t) => t.name));
  const last = [...history].reverse().find((m) => m.role === 'user')?.content ?? '';
  const system = await buildSystem({ uid, mateKey, cfg, mode, query: last, settings, tools: allowed, others });
  const schemas = toOpenAI(allowed);
  const msgs = [...history]; // canonical (native) conversation, without the system message
  const used = []; const gathered = []; const cache = new Map();
  const toolCtx = { uid, settings, mate: mateKey, ...ctx };
  const maxTurns = allowed.length ? TOOL_TURNS[effort] : 0;
  const maxTokens = mode === 'ultracode' ? 3000 : 1500;
  let dupes = 0, forced = false;

  const finalMsgs = () => [{ role: 'system', content: system }, ...clean(toTextMessages(msgs))];
  const textMsgs = () => [{ role: 'system', content: allowed.length ? `${system}\n\n${protocolBlock(allowed)}` : system }, ...clean(toTextMessages(msgs))];

  for (let turn = 0; ; turn++) {
    const canCall = !forced && turn < maxTurns;
    if (!canCall && used.length && !forced) { forced = true; msgs.push({ role: 'user', content: 'Tool budget reached. Write your final answer to the owner now, in plain text. Do not call any tool and do not output JSON.' }); }
    let modeNow = 'native', head = '', hide = null;
    const r = await chatStream(uid, {
      model: cfg.model || settings.model, effort, maxTokens, signal,
      messages: canCall ? [{ role: 'system', content: system }, ...clean(msgs)] : finalMsgs(),
      textMessages: canCall ? textMsgs() : finalMsgs(),
      tools: canCall ? schemas : undefined,
    }, (d) => { // live text
      if (hide === null) {
        if (modeNow === 'native' || !canCall) hide = false;
        else { head += d; if (!head.trim()) return; hide = HEAD_CALL.test(head); if (!hide) emit({ type: 'delta', text: head }); return; }
      }
      if (!hide) emit({ type: 'delta', text: d });
    }, (s) => { modeNow = s.mode; });
    let text = r.text ?? '';
    if (hide === null && text && !hide) { /* nothing streamed yet (empty head) */ emit({ type: 'delta', text }); }

    if (hide === true && !r.toolCalls.length && !(canCall && parseTextCalls(text, known).length)) emit({ type: 'delta', text }); // buffered but it was just prose
    let calls = canCall ? r.toolCalls : [];
    let fromText = false;
    if (canCall && !calls.length && text && callish(text)) { // the model wrote its calls as text
      calls = parseTextCalls(text, known); fromText = calls.length > 0;
      if (fromText && !hide) emit({ type: 'reset' }); // it was already streamed as plain text: take it back
    }

    if (calls.length) {
      calls = calls.slice(0, MAX_PARALLEL);
      msgs.push({ role: 'assistant', content: fromText ? '' : text, tool_calls: calls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })) });
      for (const c of calls) emit({ type: 'tool', name: c.name, args: c.args });
      const exec = async (c) => {
        const t = allowed.find((x) => x.name === c.name);
        const key = `${c.name}:${JSON.stringify(c.args)}`;
        if (t && !t.write && cache.has(key)) { dupes++; return { ok: true, text: `(You already made this exact call; same result as before.)\n${cache.get(key)}` }; }
        const res = c.args.__bad ? { ok: false, text: 'Tool error: the arguments were not valid JSON. Send them again as a JSON object.' } : await runTool(c.name, c.args, toolCtx, allowed);
        if (t && !t.write && res.ok) cache.set(key, res.text);
        return res;
      };
      const parallel = calls.every((c) => { const t = allowed.find((x) => x.name === c.name); return !t || !t.write; });
      const results = parallel ? await Promise.all(calls.map(exec)) : await (async () => { const o = []; for (const c of calls) o.push(await exec(c)); return o; })();
      calls.forEach((c, i) => {
        used.push({ name: c.name, ok: results[i].ok }); gathered.push(`${c.name}: ${results[i].text.slice(0, 400)}`);
        emit({ type: 'tool_result', name: c.name, ok: results[i].ok });
        msgs.push({ role: 'tool', tool_call_id: c.id, name: c.name, content: results[i].text, is_error: !results[i].ok });
      });
      if (dupes >= 2) { forced = false; turn = maxTurns; } // looping on the same calls: go to the final answer
      continue;
    }

    if (!canCall && (callish(text) && parseTextCalls(text).length || !text.trim())) { // never show raw tool JSON (or nothing) as the answer
      const fb = used.length ? `I used my tools but could not finish a written answer. What I gathered:\n\n${gathered.slice(-4).map((g) => `- ${g}`).join('\n')}` : 'I could not produce an answer. Please try again.';
      emit({ type: 'reset' }); emit({ type: 'delta', text: fb });
      return { text: fb, tools: used };
    }
    return { text, tools: used };
  }
}
