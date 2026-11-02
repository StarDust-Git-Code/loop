# Backend contract

The UI talks to one interface, `lib/api/contract.ts`. Two adapters implement it:

- `lib/api/local.ts` (default): saves to `localStorage`, starts empty, **executes nothing**. Runs stay `queued`, chat messages stay `pending`, connections stay `pending`, file bytes are not stored.
- `lib/api/http.ts`: used when `NEXT_PUBLIC_API_URL` is set. Calls `${URL}/v1/...` with `Authorization: Bearer <Firebase ID token>` (no cookies). Run events are read with `fetch` streaming, file downloads with `files.download()` (anchors cannot send the header). The reference implementation is `/backend` at the repo root.

## Endpoints (JSON; every entity has `id`, `createdAt`, `updatedAt`)
Standard CRUD (`GET /x`, `GET /x/:id`, `POST /x`, `PATCH /x/:id`, `DELETE /x/:id`) for:
`/tasks /workflows /automations /knowledge /memories /skills /mcp-servers /connections /conversations /events /files /runs /mates /providers`

Plus:
| Call | Purpose |
|---|---|
| `GET /auth/session`, `POST /auth/sign-out` | `{signedIn, name?, email?, plan?}` |
| `GET/PATCH /settings` | `SettingsData` (lib/types.ts) |
| `POST /runs` `{prompt, workflowId?, askFirst, fileIds}` | create and start a run (Planner Mate plans it) |
| `POST /runs/:id/stop|pause|resume` | control |
| `POST /runs/:id/approvals/:aid` `{decision: approved|denied}` | resolve an approval |
| `GET /runs/:id/events` (SSE) | `RunEvent` JSON per message: status, step, log, approval, file |
| `POST /conversations/:id/messages` `{text, mate?}` | store user message, reply asynchronously |
| `POST /mcp-servers/:id/verify` | connect, list tools, set `status` and `tools` |
| `POST /connections/:id/test` | check credentials, set `status` |
| `GET /connections/:id/chats` | WhatsApp bridge chat list: `[{id, name, meta}]` (the UI stores the ticked ids in `config.chats`) |
| `POST /runs/:id/steer` `{text}` | steer a live run |
| `POST /providers/:id/fetch-models` | call `GET {baseUrl}/models` with the stored key (Bearer, or `x-api-key` for Anthropic), save the IDs to `models`, return `string[]` |
| `POST /files` (multipart `file`), `GET /files/:id/content` | upload and download |
| `GET /knowledge/search?q=` | `[{id,name,snippet}]` |

## Backend jobs the UI assumes
Run execution and step planning; scheduling `automations`; indexing `knowledge` (`pending` to `indexed|error`); delivering Telegram/WhatsApp/email; auth; secrets storage for connections (never echo them back).


## Providers
`ProviderIn = {preset, name, baseUrl, apiKey, models[], enabled, fetchedAt?}`. Any OpenAI-compatible server works (`/models`, `/chat/completions`). A model is addressed as `${providerId}::${modelId}` on Mates, nodes and `settings.model`; empty means the workspace default. **Never return `apiKey` to the browser once the backend stores it**: send `''` or a mask. Fetching from the backend avoids the CORS blocks that stop the browser calling most providers directly.

## Newer fields
`Workflow.trigger/state`, `Task.tags`, `Memory.kind` adds `journal|link` plus `pinned`, `Run.report/notes`, `Conversation.mode/detached/members`, `MateConfig.description/outputFormat/memoryScope`, `McpServer.transport/command/catalogId`, and the RAG, harness and hook fields on `settings`.
