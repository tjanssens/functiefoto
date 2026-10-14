import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseerInvoer, ontleed, compileer, naarMathML, ExpressieFout } from '../js/expressie.js';

const waarde = (tekst, x) => compileer(ontleed(tekst))(x);

test('normaliseerInvoer_zetSchoolnotatieOm', () => {
  assert.equal(normaliseerInvoer('f(x) = 2x³ − 3x + 1'), '2x^3 - 3x + 1');
  assert.equal(normaliseerInvoer('f: x ↦ √(2x+5) − x − 1'), 'sqrt(2x+5) - x - 1');
  assert.equal(normaliseerInvoer('0,5x²'), '0.5x^2');
  assert.equal(normaliseerInvoer('x : 2'), 'x / 2');
});

test('ontleed_impliciteVermenigvuldiging', () => {
  assert.equal(waarde('2x^2', 3), 18);
  assert.equal(waarde('x(x+1)', 2), 6);
  assert.equal(waarde('(x+1)(x-1)', 3), 8);
  assert.equal(waarde('2sqrt(x)', 4), 4);
});

test('ontleed_voorrangVanMintekenEnMacht', () => {
  assert.equal(waarde('-x^2', 3), -9);
  assert.equal(waarde('2^-1', 0), 0.5);
  assert.equal(waarde('x^2^1', 3), 9);
});

test('compileer_reeleRekenregels', () => {
  assert.ok(Number.isNaN(waarde('sqrt(x)', -1)));
  assert.equal(waarde('1/x', 0), Infinity);
  assert.ok(Math.abs(waarde('x^(1/3)', -8) + 2) < 1e-12);
  assert.ok(Math.abs(waarde('root(x, 3)', -27) + 3) < 1e-12);
});

test('ontleed_geeftDuidelijkeFouten', () => {
  assert.throws(() => ontleed(''), ExpressieFout);
  assert.throws(() => ontleed('(x+1'), /sluithaakje/);
  assert.throws(() => ontleed('x+1)'), /sluithaakje/);
  assert.throws(() => ontleed('y+1'), /ken ik niet/);
  assert.throws(() => ontleed('x+'), /te vroeg/);
});

test('naarMathML_maaktBreukEnWortel', () => {
  const mml = naarMathML(ontleed('(2x^3-3x+1)/(x^2+1)'));
  assert.match(mml, /^<mfrac>/);
  assert.match(naarMathML(ontleed('sqrt(2x+5)-x-1')), /<msqrt>/);
});

test('naarMathML_zetHaakjesRondNegatiefRechterlid', () => {
  assert.match(naarMathML(ontleed('x - (-3)')), /<mo>−<\/mo><mrow><mo>\(<\/mo>/);
});
