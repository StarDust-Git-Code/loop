// A tiny stdio MCP server for the end-to-end test: one tool, "echo".
import { createInterface } from 'node:readline';
const out = (m) => process.stdout.write(`${JSON.stringify(m)}\n`);
createInterface({ input: process.stdin }).on('line', (line) => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.method === 'initialize') out({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'echo', version: '1' } } });
  else if (m.method === 'tools/list') out({ jsonrpc: '2.0', id: m.id, result: { tools: [{ name: 'echo', description: 'Echo text back', inputSchema: { type: 'object', properties: { text: { type: 'string' } } }, annotations: { readOnlyHint: true } }] } });
  else if (m.method === 'tools/call') out({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: `echo: ${m.params?.arguments?.text ?? ''} (env ${process.env.ECHO_TOKEN ?? 'none'})` }] } });
  else if (m.id != null) out({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'no such method' } });
});
