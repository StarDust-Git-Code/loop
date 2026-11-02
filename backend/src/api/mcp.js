// Verify an HTTP MCP server: initialize -> notifications/initialized -> tools/list.
const HEAD = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };

async function rpc(url, body, sid) {
  const res = await fetch(url, { method: 'POST', headers: { ...HEAD, ...(sid ? { 'mcp-session-id': sid } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
  let json = null;
  if ((res.headers.get('content-type') || '').includes('text/event-stream')) {
    for (const line of text.split('\n')) if (line.startsWith('data:')) { try { const j = JSON.parse(line.slice(5)); if (j.id === body.id) json = j; } catch { /* keep scanning */ } }
  } else if (text) { try { json = JSON.parse(text); } catch { /* notification replies are empty */ } }
  return { json, sid: res.headers.get('mcp-session-id') || sid };
}

export async function verifyMcp(server) {
  if (server.transport === 'stdio') return { ok: false, error: 'stdio servers cannot run on the free hosts. Use an HTTP MCP server, or run it on the VM sandbox.' };
  if (!/^https?:\/\//i.test(server.url || '')) return { ok: false, error: 'Add the server URL first.' };
  try {
    const init = await rpc(server.url, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'loopmates', version: '0.1.0' } } });
    if (init.json?.error) throw new Error(init.json.error.message || 'initialize failed');
    await rpc(server.url, { jsonrpc: '2.0', method: 'notifications/initialized' }, init.sid).catch(() => {});
    const list = await rpc(server.url, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, init.sid);
    if (list.json?.error) throw new Error(list.json.error.message || 'tools/list failed');
    return { ok: true, tools: (list.json?.result?.tools ?? []).map((t) => t.name).filter(Boolean).slice(0, 200) };
  } catch (e) { return { ok: false, error: e.message }; }
}
