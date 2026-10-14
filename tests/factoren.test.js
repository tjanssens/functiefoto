import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Breuk } from '../js/getal.js';
import { Veelterm, hornerSchema, veeltermTekst, ggd } from '../js/veelterm.js';
import { ontbind, nulpuntenVan, zoekRationaalNulpunt } from '../js/factoren.js';
import { getalTekst, breukTekst } from '../js/opmaak.js';

const vt = (...coefs) => new Veelterm(coefs.reverse().map((c) => new Breuk(BigInt(c))));

test('veeltermTekst_hoogsteMachtEerst', () => {
  assert.equal(veeltermTekst(vt(2, 0, -3, 1)), '2x³ − 3x + 1');
  assert.equal(veeltermTekst(vt(-1, 0, 4)), '−x² + 4');
});

test('deel_staartdelingMetRest', () => {
  const { quotient, rest } = vt(2, 0, -3, 1).deel(vt(1, 0, 1));
  assert.equal(veeltermTekst(quotient), '2x');
  assert.equal(veeltermTekst(rest), '−5x + 1');
});

test('ggd_vindtGemeenschappelijkeFactor', () => {
  assert.equal(veeltermTekst(ggd(vt(1, 0, -1), vt(1, -1))), 'x − 1');
});

test('hornerSchema_zoalsInDeKlas', () => {
  const schema = hornerSchema(vt(2, 0, -3, 1), new Breuk(1n));
  assert.deepEqual(schema.onder.map(breukTekst), ['2', '2', '−1', '0']);
  assert.equal(veeltermTekst(schema.quotient), '2x² + 2x − 1');
});

test('zoekRationaalNulpunt_ookBreuken', () => {
  assert.equal(breukTekst(zoekRationaalNulpunt(vt(2, -1, -2, 1))), '1/2');
});

test('ontbind_teller_2x3_min_3x_plus_1', () => {
  const o = ontbind(vt(2, 0, -3, 1));
  assert.deepEqual(o.factoren.map((f) => veeltermTekst(f.veelterm)), ['x − 1', '2x² + 2x − 1']);
  const tekst = nulpuntenVan(o).map((n) => getalTekst(n.getal));
  assert.deepEqual(tekst, ['(−1 − √3)/2', '(−1 + √3)/2', '1']);
  assert.ok(o.stappen.some((s) => s.horner));
});

test('ontbind_noemer_4x3_plus_4x2_plus_x_dubbelNulpunt', () => {
  const o = ontbind(vt(4, 4, 1, 0));
  const nulpunten = nulpuntenVan(o);
  assert.deepEqual(nulpunten.map((n) => getalTekst(n.getal)), ['−1/2', '0']);
  assert.equal(nulpunten[0].multipliciteit, 2);
});

test('ontbind_herhaaldNulpuntWordtMacht', () => {
  const o = ontbind(vt(1, -2, 2, -2, 1));
  assert.deepEqual(o.factoren.map((f) => [veeltermTekst(f.veelterm), f.macht]), [['x − 1', 2], ['x² + 1', 1]]);
});

test('ontbind_zonderRationaalNulpuntWordtBenaderd', () => {
  const o = ontbind(vt(1, 0, -3, 1));
  const nulpunten = nulpuntenVan(o);
  assert.equal(nulpunten.length, 3);
  assert.ok(nulpunten.every((n) => n.getal === null));
});
