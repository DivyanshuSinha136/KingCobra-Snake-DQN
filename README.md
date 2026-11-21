<p align="center">
  <img src="docs/img/banner.svg" alt="KingCobra Snake DQN — a Double DQN agent that learned to play Snake, written entirely in KingCobra" width="100%">
</p>

<p align="center">
  <a href="#quick-start"><img src="docs/img/icons/rocket.svg" width="18" height="18" align="top" alt=""> Quick start</a> &nbsp;·&nbsp;
  <a href="#the-dashboard"><img src="docs/img/icons/live.svg" width="18" height="18" align="top" alt=""> Dashboard</a> &nbsp;·&nbsp;
  <a href="#training"><img src="docs/img/icons/training.svg" width="18" height="18" align="top" alt=""> Training</a> &nbsp;·&nbsp;
  <a href="#how-it-works"><img src="docs/img/icons/brain.svg" width="18" height="18" align="top" alt=""> How it works</a> &nbsp;·&nbsp;
  <a href="docs/API.md"><img src="docs/img/icons/api.svg" width="18" height="18" align="top" alt=""> API</a> &nbsp;·&nbsp;
  <a href="CONTRIBUTING.md"><img src="docs/img/icons/branch.svg" width="18" height="18" align="top" alt=""> Contributing</a> &nbsp;·&nbsp;
  <a href="CHANGELOG.md"><img src="docs/img/icons/tag.svg" width="18" height="18" align="top" alt=""> Changelog</a>
</p>

<p align="center">
  <img src="docs/img/results.svg" alt="Results: mean score 33.1 over 100 greedy games, best game 50, 11.5k parameters, 2 minutes of training on one CPU core" width="100%">
</p>

A **Double DQN** agent that learns to play Snake — environment, replay buffer, neural-network training, HTTP server and a
live web dashboard, all written in [KingCobra](https://github.com/DivyanshuSinha136/KingCobra) using only its standard
library (`std.nn`, `std.http`, `std.json`, `std.system`). No Python, no external dependencies.

<p align="center">
  <img src="docs/img/dashboard.png" alt="Screenshot of the dashboard: the AI playing, its Q-values and inputs, training curves, model card and benchmark" width="92%">
  <br><sub>The dashboard, captured from the real app: the trained agent playing, what it sees and wants, and how it learned.</sub>
</p>

| | |
|---|---|
| **Result** | mean score **33.1** (best game **50**) over 100 greedy games on a 10×10 board after a 2-minute CPU training run |
| **Agent** | Double DQN · 3-step returns · Huber loss · gradient clipping · soft target updates · optional prioritized replay |
| **Network** | 19 → 96 → 96 → 3 (11,523 parameters) |
| **Dashboard** | watch the AI, take over and play, see its Q-values and inputs live, training curves, one-click benchmark |
| **Reproducible** | one seed controls everything; two runs with the same seed give bit-identical models |

<p align="center"><img src="docs/img/divider.svg" alt="" width="100%"></p>

## <img src="docs/img/icons/live.svg" width="26" height="26" align="top" alt=""> Watch it play

<p align="center">
  <a href="docs/media/gameplay.mp4">
    <img src="docs/img/gameplay.gif" alt="Gameplay recording: the trained agent plays, a human takes over with the arrow keys, then the AI resumes, with its Q-values and inputs updating live" width="86%">
  </a>
  <br><sub>28 seconds, recorded from the real dashboard: the AI plays, a human takes over, the AI resumes.
  <a href="docs/media/gameplay.mp4">Full-quality MP4</a> (1.2 MB).</sub>
</p>

<p align="center"><img src="docs/img/divider.svg" alt="" width="100%"></p>

## <img src="docs/img/icons/rocket.svg" width="26" height="26" align="top" alt=""> Quick start

Requires KingCobra 1.0 (`kingcobra` on your `PATH`) — and `node` only for the front-end tests.

```sh
git clone https://github.com/DivyanshuSinha136/kingcobra-snake-dqn
cd kingcobra-snake-dqn

make serve            # open http://127.0.0.1:8765  — a pre-trained model is included
make watch            # or watch it play in the terminal
make train            # retrain from scratch (~2 minutes on one CPU core)
make test             # 48 KingCobra tests + front-end tests
```

No `make`? Every target is one command: `kingcobra run src/main.kc <command> [options]`.

<p align="center"><img src="docs/img/divider.svg" alt="" width="100%"></p>

## <img src="docs/img/icons/terminal.svg" width="26" height="26" align="top" alt=""> Commands

```
kingcobra run src/main.kc <command> [options]

train    train an agent; writes models/<name>.kcnn, .json (model card) and .metrics.json (curves)
eval     play greedy games with the saved model and print statistics
watch    watch the saved model play in the terminal
serve    serve the web dashboard (trains first if no model exists; --no-train to forbid)
info     print the saved model's card

--config FILE     JSON file overriding config/default.json        --seed N       random seed
--set a.b=value   override any value (repeatable)                  --episodes N   training / evaluation episodes
--out DIR --name NAME   where the model lives                      --port N --host H   server address
```

```sh
kingcobra run src/main.kc train --episodes 400 --seed 7 --set agent.n_step=1 --out runs/a
kingcobra run src/main.kc eval  --out runs/a --episodes 200
kingcobra run src/main.kc serve --out runs/a --port 9000
```

Every tunable lives in [`config/default.json`](config/default.json) and is documented in
[`docs/TRAINING.md`](docs/TRAINING.md). Unknown keys and nonsensical values are rejected with a clear message instead of
silently falling back to a default.

<p align="center"><img src="docs/img/divider.svg" alt="" width="100%"></p>

## <img src="docs/img/icons/live.svg" width="26" height="26" align="top" alt=""> The dashboard

A dependency-free canvas front-end served under a strict Content-Security-Policy. Keyboard: `Space` play/pause · `N` step ·
`R` reset · `M` AI/You · `[` `]` speed · arrows/WASD to steer (takes over from the AI).

<table>
<tr>
<td width="62%" valign="top">
  <img src="docs/img/human-mode.png" alt="Taking over from the AI with the arrow keys: the input inspector shows danger straight lit up and the network recommends turning right" width="100%">
  <br><sub><b>Take over any time.</b> Steer with the arrow keys; the network keeps showing what it would do.</sub>
</td>
<td width="38%" valign="top">
  <img src="docs/img/mobile.png" alt="The dashboard on a phone-sized screen" width="100%">
  <br><sub><b>Responsive.</b> Works on a phone.</sub>
</td>
</tr>
</table>

<table>
<tr>
<td width="50%" valign="top">
  <img src="docs/img/icons/q-bars.svg" width="22" height="22" align="top" alt=""> <b>What the network wants</b><br>
  <img src="docs/img/qvalues.png" alt="Q-value bars for the three moves, with the greedy choice highlighted" width="100%">
</td>
<td width="50%" valign="top">
  <img src="docs/img/icons/chart.svg" width="22" height="22" align="top" alt=""> <b>Benchmark</b><br>
  <img src="docs/img/benchmark.png" alt="Benchmark result: mean score, score histogram and how games ended" width="100%">
</td>
</tr>
</table>

Smooth snake animation, the network's Q-values for the current state, the 19 inputs it is looking at, training curves
with hover, a model card, and a server-side benchmark with a score histogram and death-cause breakdown.

<p align="center"><img src="docs/img/divider.svg" alt="" width="100%"></p>

## <img src="docs/img/icons/training.svg" width="26" height="26" align="top" alt=""> Training

<p align="center">
  <img src="docs/img/terminal-train.svg" alt="Terminal output of make train: evaluation score rising from 3.7 to 36.6 over 800 episodes" width="86%">
</p>

<p align="center">
  <img src="docs/img/training-curves.png" alt="Training curves: greedy evaluation score, training score and epsilon over 800 episodes" width="100%">
</p>

The greedy evaluation score climbs as epsilon decays; the circled point is the best checkpoint (episode 650), which is the
model that ships. Details, hyper-parameters and an ablation are in [`docs/TRAINING.md`](docs/TRAINING.md).

<p align="center"><img src="docs/img/divider.svg" alt="" width="100%"></p>

## <img src="docs/img/icons/brain.svg" width="26" height="26" align="top" alt=""> How it works

<p align="center">
  <img src="docs/img/architecture.svg" alt="Architecture: the environment feeds features to the agent; transitions flow through the replay buffer back to the agent; the trainer writes model files that the server loads and serves to the browser dashboard" width="88%">
</p>

**State.** Instead of raw pixels, the network sees 19 numbers expressed *relative to the snake's heading* — danger
left/straight/right, where the food is (ahead/behind/left/right), free cells before an obstacle on each side, body
length, and a **flood-fill estimate of the free space reachable after each possible move**. The flood-fill inputs are
what teach the agent not to box itself into a pocket (removing them drops the mean score from 33 to 21; see
[`docs/TRAINING.md`](docs/TRAINING.md)).

**Learning.** For a minibatch of transitions the target of the taken action is

```
y = r_n + γⁿ · (1 − done) · Q_target(s', argmax_a Q_online(s', a))
```

The online network *picks* the next action and the target network *scores* it (Double DQN), which removes the
over-estimation bias of plain DQN. The whole update is a handful of tensor operations — no per-sample loops — so a batch of
64 costs a fraction of a millisecond. The vectorised target is unit-tested against a one-sample-at-a-time reference to 1e-9.

<p align="center"><img src="docs/img/divider.svg" alt="" width="100%"></p>

## <img src="docs/img/icons/folder.svg" width="26" height="26" align="top" alt=""> Project layout

```
src/
  main.kc        CLI (train · eval · watch · serve · info)
  config.kc      defaults, JSON overlay, --set overrides, validation
  env.kc         Snake rules, rewards, ASCII renderer
  features.kc    state encoder (+ flood fill)
  replay.kc      circular buffer, optional prioritised sampling (sum tree)
  agent.kc       Double DQN: networks, vectorised learning step, save/load
  trainer.kc     training loop, evaluation, checkpointing, metrics
  server.kc      routing, sessions, security headers, static assets
  util.kc        RNG, statistics, helpers
web/             index.html · style.css · app.js · favicon.svg
config/          default.json
models/          pre-trained snake_ddqn.kcnn + model card + curves
scripts/         build_assets.js (SVGs) · screenshots.py · record_video.py · test_web.sh
tests/           KingCobra tests (env, features, replay, agent, trainer, config, server) and tests/web/ (Node)
docs/            ARCHITECTURE.md · TRAINING.md · API.md · img/ (banners, icons, screenshots, gif) · media/ (gameplay.mp4)
```

<p align="center"><img src="docs/img/divider.svg" alt="" width="100%"></p>

## <img src="docs/img/icons/api.svg" width="26" height="26" align="top" alt=""> HTTP API

`GET /api/state` · `POST /api/reset` · `POST /api/ai-step` · `POST /api/human` · `GET /api/model` ·
`GET /api/metrics` · `GET /api/benchmark?episodes=N` · `GET /api/health`. Games are per-session (`?sid=`), so several
browser tabs never share a board. Full reference: [`docs/API.md`](docs/API.md).

<p align="center"><img src="docs/img/divider.svg" alt="" width="100%"></p>

## <img src="docs/img/icons/test.svg" width="26" height="26" align="top" alt=""> Testing

<p align="center">
  <img src="docs/img/terminal-test.svg" alt="Terminal output of make test: 48 passed, 0 failed" width="86%">
</p>

`make test` runs 48 KingCobra tests — game rules (including the tail-cell rule and a perfect-game win), feature semantics
and rotation-equivariance, the sum tree and importance weights, the Double-DQN target against a reference, exact save/load
round-trips, determinism of whole training runs, and the real server booted as a child process and driven over HTTP — plus
unit tests for the front-end's pure functions and a smoke test that runs the real `app.js` against a live server with a stub DOM.

<p align="center"><img src="docs/img/divider.svg" alt="" width="100%"></p>

## <img src="docs/img/icons/warning.svg" width="26" height="26" align="top" alt=""> Limitations

* The server is single-threaded: a benchmark request blocks other requests for its duration (capped at 50 games).
* Training runs on the KingCobra interpreter, on the CPU (about 700 environment steps per second including learning).
* The shipped numbers come from one seed; differences of a few points between algorithm variants are within run-to-run
  noise (see the ablation notes in `docs/TRAINING.md`).
* Boards other than 10×10 work (`env.size`) but need their own training run; the shipped model is for 10×10.

<p align="center"><img src="docs/img/divider.svg" alt="" width="100%"></p>

## <img src="docs/img/icons/license.svg" width="26" height="26" align="top" alt=""> License

[MIT](LICENSE) © 2026 Divyanshu Sinha
