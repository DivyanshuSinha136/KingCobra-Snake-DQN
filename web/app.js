/* Snake DQN dashboard.
 *
 * Plain browser JavaScript, no dependencies, no build step. The server (src/server.kc) sends a strict
 * Content-Security-Policy, so everything lives in this one file and style.css.
 *
 * Layout of this file:
 *   1. pure helpers      — no DOM; exported for `node tests/web/pure.test.js`
 *   2. API client        — a thin fetch wrapper with timeouts and readable errors
 *   3. rendering         — board canvas, Q bars, feature inspector, training chart, model card, benchmark
 *   4. game loop + input — tick scheduling, keyboard, mode switching
 */
(function () {
  'use strict';

  /* ═════════════════════════ 1. pure helpers ═════════════════════════ */

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const lerp = (a, b, t) => a + (b - a) * t;

  /** Interpolated body positions between two consecutive snapshots (segment i moves from prev[i] to next[i]). */
  function lerpSnake(prev, next, t) {
    return next.map((seg, i) => {
      const from = prev && i < prev.length ? prev[i] : seg;
      return [lerp(from[0], seg[0], t), lerp(from[1], seg[1], t)];
    });
  }

  /** Bar widths (percent) for a list of Q-values: the lowest gets 6%, the highest 100%. */
  function qBarWidths(q) {
    const lo = Math.min(...q), hi = Math.max(...q);
    if (!(hi - lo > 1e-9)) return q.map(() => 50);
    return q.map(v => 6 + 94 * (v - lo) / (hi - lo));
  }

  /** Map an arrow/WASD key to a heading (0 up, 1 right, 2 down, 3 left), or null. */
  function dirFromKey(key) {
    switch (key) {
      case 'ArrowUp': case 'w': case 'W': return 0;
      case 'ArrowRight': case 'd': case 'D': return 1;
      case 'ArrowDown': case 's': case 'S': return 2;
      case 'ArrowLeft': case 'a': case 'A': return 3;
      default: return null;
    }
  }

  /** Title / text / style for the game-over overlay. */
  function describeEnd(cause, score) {
    switch (cause) {
      case 'wall': return { title: 'Hit the wall', text: `Final score ${score}.`, cls: 'is-dead' };
      case 'self': return { title: 'Ate its own tail', text: `Final score ${score}.`, cls: 'is-dead' };
      case 'starved': return { title: 'Starved', text: `It circled for too long without food. Final score ${score}.`, cls: 'is-dead' };
      case 'timeout': return { title: 'Time limit', text: `The step limit was reached. Final score ${score}.`, cls: 'is-dead' };
      case 'win': return { title: 'Perfect game!', text: 'The snake filled the whole board.', cls: 'is-win' };
      default: return { title: 'Game over', text: `Final score ${score}.`, cls: 'is-dead' };
    }
  }

  /** Round `x` up to a "nice" axis maximum (1, 2, 5, 10, 20, 50 ...). */
  function niceCeil(x) {
    if (!(x > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(x)));
    const f = x / p;
    const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return n * p;
  }

  /** Index of the history row nearest to an x position in 0..1 of the plot width. */
  function nearestRow(history, frac, maxEpisode) {
    if (!history.length) return -1;
    const target = frac * maxEpisode;
    let best = 0, bd = Infinity;
    history.forEach((r, i) => { const d = Math.abs(r.episode - target); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  /** Percentages for a death-cause breakdown { wall, self, starved, win }. */
  function deathShares(d) {
    const total = (d.wall || 0) + (d.self || 0) + (d.starved || 0) + (d.win || 0);
    const pct = k => total ? 100 * (d[k] || 0) / total : 0;
    return { wall: pct('wall'), self: pct('self'), starved: pct('starved'), win: pct('win'), total };
  }

  const fmt = (x, d = 1) => (typeof x === 'number' && isFinite(x)) ? x.toFixed(d) : '—';
  const fmtSeconds = s => s < 90 ? `${s.toFixed(0)} s` : s < 5400 ? `${(s / 60).toFixed(1)} min` : `${(s / 3600).toFixed(1)} h`;

  const Pure = { clamp, lerp, lerpSnake, qBarWidths, dirFromKey, describeEnd, niceCeil, nearestRow, deathShares, fmt, fmtSeconds };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Pure; return; }

  /* ═════════════════════════ 2. API client ═════════════════════════ */

  const $ = id => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('snake-dqn:' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem('snake-dqn:' + k, JSON.stringify(v)); } catch (_) { /* private mode */ } }
  };

  const SID = (() => {
    try {
      let s = sessionStorage.getItem('snake-dqn:sid');
      if (!s) {
        const b = new Uint8Array(8); crypto.getRandomValues(b);
        s = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
        sessionStorage.setItem('snake-dqn:sid', s);
      }
      return s;
    } catch (_) { return 'default'; }
  })();

  async function api(method, path, body) {
    const sep = path.includes('?') ? '&' : '?';
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    try {
      const res = await fetch(`${path}${sep}sid=${SID}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctl.signal,
        cache: 'no-store'
      });
      let data = null;
      try { data = await res.json(); } catch (_) { /* non-JSON body */ }
      if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
      setConn(true);
      return data;
    } catch (e) {
      if (e.name === 'AbortError') e = new Error('request timed out');
      if (e instanceof TypeError) { setConn(false); e = new Error('cannot reach the server'); }
      throw e;
    } finally { clearTimeout(timer); }
  }

  /* ═════════════════════════ 3. rendering ═════════════════════════ */

  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ACTION_LABEL = { 0: 'go straight', 1: 'turn left', 2: 'turn right' };

  function toast(msg, isError) {
    const el = document.createElement('div');
    el.className = 'toast' + (isError ? ' is-error' : '');
    el.textContent = msg;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  let online = null;
  function setConn(ok) {
    if (online === ok) return;
    online = ok;
    const el = $('conn');
    el.textContent = ok ? 'connected' : 'offline';
    el.className = 'pill ' + (ok ? 'pill-on' : 'pill-off');
    if (!ok) { pause(); retryHealth(); }
  }
  function retryHealth() {
    const t = setInterval(async () => {
      try { await fetch('/api/health', { cache: 'no-store' }); clearInterval(t); setConn(true); init(false); } catch (_) { /* keep trying */ }
    }, 2000);
  }

  /* ---- board ---- */
  const board = $('board');
  const bctx = board.getContext('2d');
  let bw = 480; // CSS pixels

  function fitCanvas(canvas, ctx, cssW, cssH) {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(cssW * dpr)), h = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const HEAD = [165, 243, 252], TAIL = [14, 116, 144];
  const mix = (a, b, t) => `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;

  function drawBoard(now) {
    const s = G.snap;
    const rect = board.getBoundingClientRect();
    bw = rect.width || bw;
    fitCanvas(board, bctx, bw, bw);
    const ctx = bctx;
    ctx.clearRect(0, 0, bw, bw);
    ctx.fillStyle = '#070a0e';
    ctx.fillRect(0, 0, bw, bw);
    if (!s) return;
    const n = s.size, cell = bw / n;

    // checkerboard + fine grid
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if ((r + c) % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.018)'; ctx.fillRect(c * cell, r * cell, cell, cell); }
    }

    // food: pulsing orb with a soft glow
    if (s.food) {
      const fx = (s.food[1] + 0.5) * cell, fy = (s.food[0] + 0.5) * cell;
      const pulse = reduceMotion ? 0 : Math.sin(now / 240) * 0.05;
      const rad = cell * (0.27 + pulse);
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, cell * 0.9);
      g.addColorStop(0, 'rgba(251,191,36,0.38)'); g.addColorStop(1, 'rgba(251,191,36,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, cell * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(fx, fy, rad, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(fx - rad * 0.3, fy - rad * 0.3, rad * 0.28, 0, Math.PI * 2); ctx.fill();
    }

    // snake: a tapered, round-capped polyline from tail to head, interpolated between ticks
    const t = reduceMotion ? 1 : clamp((now - G.tickStart) / G.tickDur, 0, 1);
    const pos = G.prev && !s.done ? lerpSnake(G.prev.snake, s.snake, t) : s.snake;
    const len = pos.length;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = len - 1; i >= 1; i--) {
      const k = len > 1 ? i / (len - 1) : 0;
      ctx.strokeStyle = mix(HEAD, TAIL, Math.pow(k, 0.8));
      ctx.lineWidth = cell * lerp(0.74, 0.52, k);
      ctx.beginPath();
      ctx.moveTo((pos[i][1] + 0.5) * cell, (pos[i][0] + 0.5) * cell);
      ctx.lineTo((pos[i - 1][1] + 0.5) * cell, (pos[i - 1][0] + 0.5) * cell);
      ctx.stroke();
    }
    // head
    const hx = (pos[0][1] + 0.5) * cell, hy = (pos[0][0] + 0.5) * cell;
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const d = dirs[s.dir];
    ctx.fillStyle = s.done && s.cause !== 'win' ? '#fb7185' : mix(HEAD, HEAD, 0);
    ctx.beginPath(); ctx.arc(hx, hy, cell * 0.39, 0, Math.PI * 2); ctx.fill();
    // eyes, set towards the heading
    const px = -d[1], py = d[0]; // perpendicular
    for (const side of [-1, 1]) {
      const ex = hx + d[0] * cell * 0.13 + px * side * cell * 0.17;
      const ey = hy + d[1] * cell * 0.13 + py * side * cell * 0.17;
      ctx.fillStyle = '#06222b'; ctx.beginPath(); ctx.arc(ex, ey, cell * 0.075, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e6fcff'; ctx.beginPath(); ctx.arc(ex + d[0] * cell * 0.02, ey + d[1] * cell * 0.02, cell * 0.028, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* ---- HUD, Q bars, features ---- */
  function renderHud(s) {
    $('score').textContent = s.score;
    $('length').textContent = s.length;
    $('steps').textContent = s.steps;
    const st = $('status');
    st.textContent = s.done ? 'game over' : G.running ? (G.mode === 'ai' ? 'AI playing' : 'you play') : 'paused';
    st.className = 'metric-value metric-status ' + (s.done ? 'is-dead' : G.running ? 'is-run' : 'is-idle');
    board.setAttribute('aria-label', `Snake board. Score ${s.score}, length ${s.length}${s.done ? ', game over' : ''}.`);

    const ss = s.session;
    $('sGames').textContent = ss.games;
    $('sBest').textContent = ss.best;
    $('sMean').textContent = fmt(ss.mean, 1);
    const key = 'best:' + (G.modelName || 'model');
    const prevBest = store.get(key, 0);
    if (s.score > prevBest) store.set(key, s.score);
    $('sAll').textContent = Math.max(prevBest, s.score);

    // Q-values
    const w = qBarWidths(s.q);
    document.querySelectorAll('#qbars .qrow').forEach(row => {
      const a = Number(row.dataset.action);
      row.classList.toggle('is-best', a === s.best_action);
      row.querySelector('.qfill').style.setProperty('--w', w[a].toFixed(1) + '%');
      row.querySelector('.qval').textContent = fmt(s.q[a], 2);
    });
    $('policy').textContent = s.done ? 'game over' : ACTION_LABEL[s.best_action];

    // features
    document.querySelectorAll('#features .frow').forEach(row => {
      const v = s.features[Number(row.dataset.index)];
      row.querySelector('.ffill').style.setProperty('--w', (clamp(v, 0, 1) * 100).toFixed(0) + '%');
      row.querySelector('.fval').textContent = v.toFixed(2);
    });
  }

  function buildFeatureRows(names) {
    const groups = [
      ['Danger (adjacent cell is wall/body)', /^danger_/, 'is-danger'],
      ['Heading', /^dir_/, ''],
      ['Food, relative to heading', /^food_/, 'is-food'],
      ['Free cells before an obstacle', /^ray_/, ''],
      ['Reachable space after the move (flood fill)', /^space_/, 'is-space'],
      ['Body', /^length$/, '']
    ];
    const host = $('features');
    host.textContent = '';
    for (const [title, re, cls] of groups) {
      const idx = names.map((n, i) => re.test(n) ? i : -1).filter(i => i >= 0);
      if (!idx.length) continue;
      const g = document.createElement('div'); g.className = 'fgroup'; g.textContent = title; host.appendChild(g);
      for (const i of idx) {
        const r = document.createElement('div'); r.className = 'frow ' + cls;
        r.innerHTML = '<span class="fname"></span><span class="ftrack"><span class="ffill"></span></span><span class="fval">0.00</span>';
        r.querySelector('.fname').textContent = names[i].replace(/_/g, ' ');
        r.dataset.index = i;
        host.appendChild(r);
      }
    }
    $('featCount').textContent = `${names.length} inputs`;
  }

  /* ---- overlay ---- */
  function showOverlay(s) {
    const o = $('overlay');
    if (!s.done) { o.classList.add('is-hidden'); return; }
    const d = describeEnd(s.cause, s.score);
    o.className = 'overlay ' + d.cls;
    $('overlayTitle').textContent = d.title;
    $('overlayText').textContent = d.text;
    $('overlayBtn').textContent = G.mode === 'ai' && $('autoRestart').checked ? 'Restarting…' : 'Play again';
  }

  /* ---- training chart ---- */
  const curve = $('curve');
  const cctx = curve.getContext('2d');
  let metrics = { history: [] };
  let hover = -1;
  const PAD = { l: 44, r: 42, t: 12, b: 38 };

  function drawCurve() {
    const rect = curve.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    if (!W || !H) return;
    fitCanvas(curve, cctx, W, H);
    const ctx = cctx;
    ctx.clearRect(0, 0, W, H);
    const hist = metrics.history || [];
    $('curveEmpty').classList.toggle('is-hidden', hist.length > 0);
    if (!hist.length) return;

    const pw = W - PAD.l - PAD.r, ph = H - PAD.t - PAD.b;
    const maxEp = Math.max(...hist.map(r => r.episode));
    let maxScore = 1;
    hist.forEach(r => { maxScore = Math.max(maxScore, r.train_score || 0, r.eval_mean || 0); });
    const yMax = niceCeil(maxScore * 1.05);
    const X = ep => PAD.l + pw * ep / maxEp;
    const Y = v => PAD.t + ph * (1 - v / yMax);
    const YE = v => PAD.t + ph * (1 - v);

    ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
    ctx.textBaseline = 'middle';
    // grid + axes
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = PAD.t + ph * i / 5;
      ctx.strokeStyle = i === 5 ? '#2a3a4b' : '#16212c';
      ctx.beginPath(); ctx.moveTo(PAD.l, y + 0.5); ctx.lineTo(W - PAD.r, y + 0.5); ctx.stroke();
      ctx.fillStyle = '#7d8ea0'; ctx.textAlign = 'right';
      ctx.fillText(fmt(yMax * (1 - i / 5), yMax < 5 ? 1 : 0), PAD.l - 7, y);
      ctx.fillStyle = '#9a7b1e'; ctx.textAlign = 'left';
      ctx.fillText((1 - i / 5).toFixed(2), W - PAD.r + 7, y);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#7d8ea0';
    const step = niceCeil(maxEp / 5);
    for (let ep = 0; ep <= maxEp + 1e-9; ep += step) ctx.fillText(String(ep), X(ep), H - PAD.b + 8);
    ctx.fillText('episode', PAD.l + pw / 2, H - 14);

    const line = (get, color, width, dash, scaleY) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      ctx.beginPath(); let started = false;
      hist.forEach(r => {
        const v = get(r); if (v === null || v === undefined) return;
        const x = X(r.episode), y = scaleY(v);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      });
      ctx.stroke(); ctx.setLineDash([]);
    };
    line(r => r.epsilon, '#fbbf24', 1.4, [5, 4], YE);
    line(r => r.train_score, '#a78bfa', 1.8, null, Y);
    line(r => r.eval_mean, '#22d3ee', 2.4, null, Y);
    // eval points + best marker
    let bestRow = null;
    hist.forEach(r => { if (r.eval_mean != null && (!bestRow || r.eval_mean > bestRow.eval_mean)) bestRow = r; });
    hist.forEach(r => {
      if (r.eval_mean == null) return;
      ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.arc(X(r.episode), Y(r.eval_mean), 3, 0, Math.PI * 2); ctx.fill();
    });
    if (bestRow) {
      ctx.strokeStyle = '#a5f3fc'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(X(bestRow.episode), Y(bestRow.eval_mean), 6.5, 0, Math.PI * 2); ctx.stroke();
    }

    // hover crosshair
    const tip = $('tip');
    if (hover >= 0 && hover < hist.length) {
      const r = hist[hover], x = X(r.episode);
      ctx.strokeStyle = 'rgba(165,243,252,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 0.5, PAD.t); ctx.lineTo(x + 0.5, PAD.t + ph); ctx.stroke();
      tip.innerHTML = `<b>episode ${r.episode}</b><br>` +
        `<span class="c-eval">eval mean</span> ${fmt(r.eval_mean, 2)}${r.eval_max != null ? ` (max ${r.eval_max})` : ''}<br>` +
        `<span class="c-train">train avg</span> ${fmt(r.train_score, 2)}<br>` +
        `<span class="c-eps">epsilon</span> ${fmt(r.epsilon, 2)} · loss ${fmt(r.loss, 4)}`;
      tip.classList.remove('is-hidden');
      const tw = tip.offsetWidth;
      tip.style.left = clamp(x + 12, 4, W - tw - 4) + 'px';
      tip.style.top = (PAD.t + 4) + 'px';
    } else tip.classList.add('is-hidden');
  }

  curve.addEventListener('pointermove', e => {
    const rect = curve.getBoundingClientRect();
    const pw = rect.width - PAD.l - PAD.r;
    const frac = clamp((e.clientX - rect.left - PAD.l) / pw, 0, 1);
    const maxEp = Math.max(1, ...((metrics.history || []).map(r => r.episode)));
    const i = nearestRow(metrics.history || [], frac, maxEp);
    if (i !== hover) { hover = i; drawCurve(); }
  });
  curve.addEventListener('pointerleave', () => { hover = -1; drawCurve(); });

  /* ---- model card + benchmark ---- */
  function fact(dt, dd, big) {
    const wrap = document.createElement('div');
    const a = document.createElement('dt'); a.textContent = dt;
    const b = document.createElement('dd'); b.textContent = dd; if (big) b.className = 'big';
    wrap.append(a, b);
    return wrap;
  }

  function renderModel(card) {
    G.modelName = card.name || 'model';
    $('modelName').textContent = `${card.name || 'model'} · ${card.algorithm || ''}`.trim();
    const host = $('modelFacts');
    host.textContent = '';
    if (!card.final_eval) { host.appendChild(fact('Status', card.note || 'no model card')); return; }
    const f = card.final_eval;
    const net = (card.network || []).join('→');
    host.append(
      fact('Final eval — mean score', `${fmt(f.mean, 2)} ± ${fmt(f.std, 2)}`, true),
      fact('Final eval — best game', `${fmt(f.max, 0)}`, true),
      fact('Algorithm', card.algorithm),
      fact('Network', net),
      fact('Parameters', String(card.parameters)),
      fact('Board', `${card.board}×${card.board}`),
      fact('Episodes', String(card.episodes)),
      fact('Environment steps', String(card.total_steps)),
      fact('Training time', fmtSeconds(card.train_seconds)),
      fact('Best checkpoint', `episode ${card.best_episode}`),
      fact('Eval games', String(f.episodes)),
      fact('Mean length', fmt(f.mean_length, 1)),
      fact('Seed', String(card.seed)),
      fact('Inputs', `${card.input_dim} features`)
    );
    if (card.config) $('cfgDump').textContent = JSON.stringify(card.config, null, 2);
  }

  function renderBench(r) {
    $('benchOut').classList.remove('is-hidden');
    $('benchHint').classList.add('is-hidden');
    const f = $('benchFacts'); f.textContent = '';
    f.append(fact('Mean score', fmt(r.mean, 2), true), fact('Best', fmt(r.max, 0), true), fact('Std dev', fmt(r.std, 2)), fact('Mean length', fmt(r.mean_length, 1)));

    const hist = $('hist'); hist.textContent = '';
    const peak = Math.max(1, ...r.histogram.counts);
    r.histogram.counts.forEach((c, i) => {
      const lo = i * r.histogram.width, hi = lo + r.histogram.width - 1;
      const bar = document.createElement('div'); bar.className = 'hbar';
      const cnt = document.createElement('span'); cnt.className = 'hbar-cnt'; cnt.textContent = c ? c : '';
      const fill = document.createElement('div'); fill.className = 'hbar-fill'; fill.style.setProperty('--h', (c / peak * 78).toFixed(0) + '%');
      const lab = document.createElement('span'); lab.className = 'hbar-lab'; lab.textContent = r.histogram.width === 1 ? String(lo) : `${lo}–${hi}`;
      bar.append(cnt, fill, lab); hist.appendChild(bar);
    });

    const sh = deathShares(r.deaths);
    const dh = $('deaths'); dh.textContent = '';
    const track = document.createElement('div'); track.className = 'deaths';
    const labels = { wall: 'hit a wall', self: 'ate itself', starved: 'starved', win: 'filled the board' };
    const key = document.createElement('div'); key.className = 'deaths-key';
    for (const k of ['wall', 'self', 'starved', 'win']) {
      const seg = document.createElement('div'); seg.className = 'seg-d d-' + k; seg.style.setProperty('--w', sh[k].toFixed(1) + '%'); track.appendChild(seg);
      const item = document.createElement('span'); const dot = document.createElement('i'); dot.className = 'd-' + k;
      item.append(dot, `${labels[k]} ${sh[k].toFixed(0)}%`); key.appendChild(item);
    }
    dh.append(track, key);
  }

  /* ═════════════════════════ 4. game loop + input ═════════════════════════ */

  const G = {
    snap: null, prev: null, tickStart: 0, tickDur: 120,
    mode: store.get('mode', 'ai'), running: false, busy: false, timer: null,
    speed: clamp(store.get('speed', 12), 1, 40), pendingDir: null, restartTimer: null, modelName: ''
  };

  function setSnapshot(s, keepPrev) {
    const sameGame = G.snap && keepPrev && s.steps === G.snap.steps + 1 && !G.snap.done;
    G.prev = sameGame ? G.snap : null;
    G.snap = s;
    G.tickStart = performance.now();
    G.tickDur = G.running ? 1000 / G.speed : 140;
    renderHud(s);
    showOverlay(s);
    if (s.done) onGameOver(s);
  }

  function onGameOver(s) {
    pause();
    if (G.mode === 'ai' && $('autoRestart').checked) {
      clearTimeout(G.restartTimer);
      G.restartTimer = setTimeout(async () => { await doReset(); if (G.mode === 'ai') play(); }, 1100);
    }
  }

  async function doReset() {
    clearTimeout(G.restartTimer);
    pause();
    G.pendingDir = null;
    try { setSnapshot(await api('POST', '/api/reset'), false); } catch (e) { toast(e.message, true); }
  }

  async function tick() {
    if (G.busy || !G.snap || G.snap.done) return;
    G.busy = true;
    try {
      let s;
      if (G.mode === 'ai') s = await api('POST', '/api/ai-step');
      else s = await api('POST', '/api/human', { dir: G.pendingDir === null ? G.snap.dir : G.pendingDir });
      setSnapshot(s, true);
    } catch (e) { toast(e.message, true); pause(); }
    finally { G.busy = false; }
  }

  function loop() {
    if (!G.running) return;
    const started = performance.now();
    tick().finally(() => {
      if (!G.running) return;
      const wait = Math.max(0, 1000 / G.speed - (performance.now() - started));
      G.timer = setTimeout(loop, wait);
    });
  }

  function play() {
    if (G.running || !G.snap || G.snap.done) return;
    G.running = true; syncControls(); loop();
  }
  function pause() {
    G.running = false; clearTimeout(G.timer); syncControls();
    if (G.snap) renderHud(G.snap);
  }
  function syncControls() {
    $('btnPlay').textContent = G.running ? '⏸ Pause' : '▶ Play';
    $('modeAi').classList.toggle('is-on', G.mode === 'ai');
    $('modeHuman').classList.toggle('is-on', G.mode === 'human');
    $('modeAi').setAttribute('aria-pressed', String(G.mode === 'ai'));
    $('modeHuman').setAttribute('aria-pressed', String(G.mode === 'human'));
  }

  async function setMode(m, restart) {
    if (G.mode === m && !restart) return;
    G.mode = m; store.set('mode', m);
    pause(); G.pendingDir = null;
    syncControls();
    if (restart) await doReset();
    else if (G.snap) renderHud(G.snap);
  }

  function setSpeed(v) {
    G.speed = clamp(v, 1, 40);
    $('speed').value = G.speed; $('speedOut').textContent = `${G.speed}/s`;
    store.set('speed', G.speed);
    if (G.running) G.tickDur = 1000 / G.speed;
  }

  window.addEventListener('keydown', async e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'SELECT' || (tag === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox')) return;
    const d = dirFromKey(e.key);
    if (d !== null) {
      e.preventDefault();
      if (G.mode !== 'human') await setMode('human', false);
      if (G.snap && G.snap.done) await doReset();
      G.pendingDir = d;
      if (!G.running) play();
      return;
    }
    switch (e.key) {
      case ' ': e.preventDefault(); G.running ? pause() : play(); break;
      case 'n': case 'N': tick(); break;
      case 'r': case 'R': doReset(); break;
      case 'm': case 'M': setMode(G.mode === 'ai' ? 'human' : 'ai', true); break;
      case '[': setSpeed(G.speed - (G.speed > 10 ? 2 : 1)); break;
      case ']': setSpeed(G.speed + (G.speed >= 10 ? 2 : 1)); break;
      default: break;
    }
  });

  $('btnPlay').addEventListener('click', () => { G.running ? pause() : play(); });
  $('btnStep').addEventListener('click', () => { pause(); tick(); });
  $('btnReset').addEventListener('click', doReset);
  $('overlayBtn').addEventListener('click', async () => { await doReset(); play(); });
  $('modeAi').addEventListener('click', () => setMode('ai', true));
  $('modeHuman').addEventListener('click', () => setMode('human', true));
  $('speed').addEventListener('input', e => setSpeed(Number(e.target.value)));
  $('autoRestart').checked = store.get('auto', true);
  $('autoRestart').addEventListener('change', e => store.set('auto', e.target.checked));
  $('btnBench').addEventListener('click', async () => {
    const btn = $('btnBench'); btn.disabled = true; btn.textContent = 'Running…';
    try { renderBench(await api('GET', `/api/benchmark?episodes=${$('benchN').value}`)); }
    catch (e) { toast(e.message, true); }
    finally { btn.disabled = false; btn.textContent = 'Run'; }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.running) { G.wasRunning = true; pause(); } else if (!document.hidden && G.wasRunning) { G.wasRunning = false; play(); } });
  window.addEventListener('resize', () => { drawCurve(); });
  if (window.ResizeObserver) new ResizeObserver(() => drawCurve()).observe(curve.parentElement);

  function frame(now) { drawBoard(now); requestAnimationFrame(frame); }

  async function init(first) {
    try {
      const [card, mets, snap] = await Promise.all([api('GET', '/api/model'), api('GET', '/api/metrics'), api('GET', '/api/state')]);
      buildFeatureRows(card.features || []);
      renderModel(card);
      metrics = mets; drawCurve();
      setSnapshot(snap, false);
      if (first) {
        setSpeed(G.speed); syncControls();
        requestAnimationFrame(frame);
        if (G.mode === 'ai' && !snap.done) setTimeout(play, 350);
      }
    } catch (e) { toast(e.message, true); }
  }
  init(true);
})();
