import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Breuk, Getal, splitsKwadraat } from '../js/getal.js';
import { getalTekst, breukTekst, decimaal } from '../js/opmaak.js';

test('Breuk_vereenvoudigt_en_normaliseert_teken', () => {
  const b = new Breuk(6n, -4n);
  assert.equal(b.teller, -3n);
  assert.equal(b.noemer, 2n);
  assert.equal(breukTekst(b), '−3/2');
});

test('Breuk_uitTekst_leestDecimalenExact', () => {
  assert.equal(breukTekst(Breuk.uitTekst('0.25')), '1/4');
  assert.equal(breukTekst(Breuk.uitTekst('.5')), '1/2');
  assert.throws(() => Breuk.uitTekst('.'));
});

test('splitsKwadraat_haaltKwadratenUitDeWortel', () => {
  assert.deepEqual(splitsKwadraat(12n), { buiten: 2n, binnen: 3n });
  assert.deepEqual(splitsKwadraat(72n), { buiten: 6n, binnen: 2n });
  assert.deepEqual(splitsKwadraat(50n), { buiten: 5n, binnen: 2n });
});

test('Getal_wortelVan_vereenvoudigt', () => {
  assert.equal(getalTekst(Getal.wortelVan(new Breuk(12n))), '2√3');
  assert.equal(getalTekst(Getal.wortelVan(new Breuk(4n))), '2');
  assert.equal(getalTekst(Getal.wortelVan(new Breuk(1n, 2n))), '√2/2');
});

test('Getal_alsEenBreuk_schrijftWortelnulpuntZoalsInDeKlas', () => {
  const wortel3 = Getal.wortelVan(new Breuk(3n));
  const nulpunt = Getal.van(new Breuk(-1n)).plus(wortel3.maalBreuk(new Breuk(-1n))).maalBreuk(new Breuk(1n, 2n));
  assert.equal(getalTekst(nulpunt), '(−1 − √3)/2');
  assert.ok(Math.abs(nulpunt.naarGetal() + 1.3660254) < 1e-6);
});

test('decimaal_gebruiktKommaEnMinteken', () => {
  assert.equal(decimaal(-1.366), '−1,37');
  assert.equal(decimaal(2), '2');
});
