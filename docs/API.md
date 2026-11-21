# HTTP API

All responses are JSON (`Content-Type: application/json`, `Cache-Control: no-store`) except the static files. Errors have the
shape `{"error": "...", "status": 400}`. Game endpoints accept `?sid=<id>` (1–40 characters of `A-Z a-z 0-9 - _`);
anything else falls back to the shared `default` session. At most `server.max_sessions` sessions are kept; the least
recently used is evicted first.

Directions are `0` up, `1` right, `2` down, `3` left. Actions are relative: `0` straight, `1` left, `2` right.

| Method & path | Description |
|---|---|
| `GET /` , `GET /static/<file>` | dashboard and its assets (only files that exist in `web/`) |
| `GET /api/health` | `{status, version, uptime, sessions}` |
| `GET /api/model` | the model card: algorithm, network, parameter count, training stats, final evaluation, feature names, full config |
| `GET /api/metrics` | `{history: [{episode, steps, epsilon, train_score, train_return, loss, eval_mean, eval_max, seconds, steps_per_sec}], …}` |
| `GET /api/state` | current game of the session (see below) |
| `POST /api/reset` | start a new game, returns the state |
| `POST /api/ai-step` | play one greedy move; adds `decision: {action, name, q}` (the Q-values the move was based on) |
| `POST /api/human` | body `{"action": 0\|1\|2}` or `{"dir": 0..3}`; a 180° reversal is ignored; no effect after game over |
| `GET /api/benchmark?episodes=N` | plays `N` (1–`server.benchmark_max`) fresh greedy games: `{mean, max, std, mean_length, scores, deaths, histogram}` |
| `POST /api/shutdown` | stops the server; `403` unless started with `--set server.allow_shutdown=true` |

Wrong method → `405` with an `Allow` header; unknown path → `404`; malformed body → `400`.

## State object (example)

```json
{
  "size": 10, "snake": [[5,5],[5,4],[5,3]], "food": [8,6], "dir": 1,
  "score": 0, "steps": 0, "length": 3, "done": false, "cause": "",
  "q": [0.41, 0.38, 0.12], "best_action": 0,
  "features": [0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0.39, 0.5, 0.4, 0.4, 1, 1, 1, 0.03],
  "session": {"games": 0, "best": 0, "mean": 0}
}
```

`snake[0]` is the head, cells are `[row, column]`. `cause` is `""`, `wall`, `self`, `starved`, `timeout` or `win`.
`q` is ordered `[straight, left, right]`. `features` follows the order in the model card's `features` list.

## Security notes

* The server binds to `127.0.0.1` by default. Use `--host 0.0.0.0` deliberately; there is no authentication.
* Every response carries `Content-Security-Policy` (scripts and styles only from the same origin), `X-Content-Type-Options: nosniff`
  and `Referrer-Policy: no-referrer`.
* Static files are served from an in-memory map built at start-up, so there is no path to traverse.
* Shutdown over HTTP is opt-in.
