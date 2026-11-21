// Unit tests for the DOM-free helpers in web/app.js.   Run: node tests/web/pure.test.js
'use strict';
const assert = require('assert');
const P = require('../../web/app.js');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('  ok  ', name); };

t('lerpSnake interpolates every segment', () => {
  const prev = [[5, 5], [5, 4], [5, 3]], next = [[5, 6], [5, 5], [5, 4]];
  assert.deepStrictEqual(P.lerpSnake(prev, next, 0), prev);
  assert.deepStrictEqual(P.lerpSnake(prev, next, 1), next);
  assert.deepStrictEqual(P.lerpSnake(prev, next, 0.5)[0], [5, 5.5]);
});
t('lerpSnake handles growth (new tail segment stays put)', () => {
  const out = P.lerpSnake([[1, 1], [1, 0]], [[1, 2], [1, 1], [1, 0]], 0.5);
  assert.strictEqual(out.length, 3);
  assert.deepStrictEqual(out[2], [1, 0]);
});
t('lerpSnake without a previous frame is the identity', () => {
  assert.deepStrictEqual(P.lerpSnake(null, [[2, 2]], 0.3), [[2, 2]]);
});
t('qBarWidths: lowest 6, highest 100, flat input centred', () => {
  const w = P.qBarWidths([1, 3, 2]);
  assert.strictEqual(w[0], 6); assert.strictEqual(w[1], 100); assert.ok(Math.abs(w[2] - 53) < 1e-9);
  assert.deepStrictEqual(P.qBarWidths([0, 0, 0]), [50, 50, 50]);
});
t('dirFromKey maps arrows and WASD', () => {
  assert.strictEqual(P.dirFromKey('ArrowUp'), 0); assert.strictEqual(P.dirFromKey('d'), 1);
  assert.strictEqual(P.dirFromKey('S'), 2); assert.strictEqual(P.dirFromKey('ArrowLeft'), 3);
  assert.strictEqual(P.dirFromKey('x'), null);
});
t('describeEnd covers every cause', () => {
  for (const c of ['wall', 'self', 'starved', 'timeout', 'win', 'other']) assert.ok(P.describeEnd(c, 3).title);
  assert.strictEqual(P.describeEnd('win', 9).cls, 'is-win');
  assert.ok(P.describeEnd('wall', 7).text.includes('7'));
});
t('niceCeil', () => {
  assert.strictEqual(P.niceCeil(0), 1); assert.strictEqual(P.niceCeil(3.2), 5); assert.strictEqual(P.niceCeil(41), 50);
  assert.strictEqual(P.niceCeil(100), 100); assert.strictEqual(P.niceCeil(101), 200);
});
t('nearestRow picks the closest episode', () => {
  const h = [{ episode: 25 }, { episode: 50 }, { episode: 75 }, { episode: 100 }];
  assert.strictEqual(P.nearestRow(h, 0, 100), 0); assert.strictEqual(P.nearestRow(h, 0.6, 100), 1);
  assert.strictEqual(P.nearestRow(h, 1, 100), 3); assert.strictEqual(P.nearestRow([], 0.5, 100), -1);
});
t('deathShares sums to 100 and survives an empty input', () => {
  const s = P.deathShares({ wall: 1, self: 1, starved: 1, win: 1 });
  assert.strictEqual(s.wall + s.self + s.starved + s.win, 100);
  assert.strictEqual(P.deathShares({}).total, 0);
});
t('fmt / fmtSeconds', () => {
  assert.strictEqual(P.fmt(3.14159, 2), '3.14'); assert.strictEqual(P.fmt(null), '—'); assert.strictEqual(P.fmt(NaN), '—');
  assert.strictEqual(P.fmtSeconds(42), '42 s'); assert.strictEqual(P.fmtSeconds(120), '2.0 min'); assert.strictEqual(P.fmtSeconds(7200), '2.0 h');
});
console.log(`${n} passed`);
