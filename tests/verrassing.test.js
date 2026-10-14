import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kiesVallendeSter } from '../js/verrassing.js';

/** Een vaste reeks "toevalsgetallen", zodat de test herhaalbaar is. */
function reeks(...getallen) {
  let i = 0;
  return () => getallen[i++ % getallen.length];
}

test('kiesVallendeSter_naarRechts_valtSchuinNaarRechtsOnder', () => {
  const s = kiesVallendeSter(800, 160, reeks(0.1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5));
  assert.ok(s.dx > 0 && s.dy > 0, JSON.stringify(s));
  assert.ok(s.hoek >= 12 && s.hoek <= 32);
});

test('kiesVallendeSter_naarLinks_valtSchuinNaarLinksOnder', () => {
  const s = kiesVallendeSter(800, 160, reeks(0.9, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5));
  assert.ok(s.dx < 0 && s.dy > 0, JSON.stringify(s));
  assert.ok(s.hoek >= 148 && s.hoek <= 168);
});

test('kiesVallendeSter_startInDeBovensteHelftEnBinnenDeKop', () => {
  for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
    const s = kiesVallendeSter(800, 160, reeks(r, r, r, r, r, r, r));
    assert.ok(s.x0 >= 0 && s.x0 <= 800, `x0 ${s.x0}`);
    assert.ok(s.y0 >= 0 && s.y0 <= 80, `y0 ${s.y0}`);
    assert.ok(s.lengte >= 70 && s.lengte <= 130);
    assert.ok(s.duur >= 650 && s.duur <= 1050);
  }
});

test('kiesVallendeSter_bredeLageKop_eindigtNietOnderDeRand', () => {
  for (const r of [0, 0.3, 0.6, 0.999]) {
    const s = kiesVallendeSter(928, 143, reeks(r, r, r, r, r, r, r));
    assert.ok(s.y0 + s.dy <= 143 + 1e-9, `eindigt op y = ${s.y0 + s.dy}`);
  }
});

test('kiesVallendeSter_smalleKop_houdtEenMinimaleAfstand', () => {
  const s = kiesVallendeSter(300, 200, reeks(0.1, 0.5, 0, 0.5, 0.5, 0.5, 0.5));
  assert.ok(Math.hypot(s.dx, s.dy) >= 160 - 1e-9);
});
