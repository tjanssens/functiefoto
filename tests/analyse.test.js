import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ontleed } from '../js/expressie.js';
import { analyseer } from '../js/analyse.js';
import { controleerTabel, controleerAsymptoot } from '../js/numeriek.js';

const analyse = (tekst) => analyseer(ontleed(tekst));
const punten = (a) => a.tabel.punten.map((p) => p.tekst);
const rij = (a, herkomst) => a.tabel.rijen.filter((r) => r.herkomst === herkomst).map((r) => r.tekst);

test('rationaal_foto1_tekentabelMetDubbelNulpuntInNoemer', () => {
  const a = analyse('(x^3 - 1)/(4x^3 + 4x^2 + x)');
  assert.equal(a.soort, 'rationaal');
  assert.deepEqual(punten(a), ['−1/2', '0', '1']);
  assert.deepEqual(rij(a, 'teller'), ['x − 1', 'x² + x + 1']);
  assert.deepEqual(rij(a, 'noemer'), ['x', '4x² + 4x + 1']);
  assert.deepEqual(a.tabel.f, ['+', '|', '+', '|', '-', '0', '+']);
  assert.deepEqual(controleerTabel(a.tabel, a.f), []);
  const soorten = a.asymptoten.lijst.map((l) => `${l.soort}:${l.x ?? l.q}`);
  assert.deepEqual(soorten, ['VA:-0.5', 'VA:0', 'HA:0.25']);
  assert.ok(a.asymptoten.lijst.every((l) => controleerAsymptoot(l, a.f)));
});

test('wortel_foto2_valseOplossingWordtAfgewezen', () => {
  const a = analyse('sqrt(2x+5) - x - 1');
  assert.equal(a.soort, 'wortel');
  assert.deepEqual(punten(a), ['−5/2', '−2', '−1', '2']);
  assert.deepEqual(a.tabel.f, ['/', '+', '+', '+', '+', '+', '+', '0', '-']);
  assert.deepEqual(a.tabel.rijen.map((r) => r.herkomst), ['onder de wortel', 'buiten de wortel', 'na kwadrateren']);
  assert.deepEqual(controleerTabel(a.tabel, a.f), []);
  const toets = a.nulpunten.stappen.find((s) => s.titel === 'Toets aan de BV en de KV');
  assert.equal(toets.formules.length, 2);
  assert.match(toets.formules.join(''), /voldoet niet aan de KV/);
  assert.equal(a.asymptoten.lijst.length, 0);
});

test('rationaal_foto3_schuineAsymptoot', () => {
  const a = analyse('(2x^3 - 3x + 1)/(x^2 + 1)');
  assert.deepEqual(punten(a), ['(−1 − √3)/2', '(−1 + √3)/2', '1']);
  assert.deepEqual(a.tabel.f, ['-', '0', '+', '0', '-', '0', '+']);
  assert.deepEqual(controleerTabel(a.tabel, a.f), []);
  assert.deepEqual(a.asymptoten.lijst.map((l) => [l.soort, l.m, l.q]), [['SA', 2, 0]]);
});

test('veelterm_tekenVolgtUitFactoren', () => {
  const a = analyse('x^3 - 4x');
  assert.equal(a.soort, 'veelterm');
  assert.deepEqual(punten(a), ['−2', '0', '2']);
  assert.deepEqual(a.tabel.f, ['-', '0', '+', '0', '-', '0', '+']);
  assert.deepEqual(controleerTabel(a.tabel, a.f), []);
});

test('rationaal_perforatieIsGeenAsymptoot', () => {
  const a = analyse('(x^2 - 1)/(x - 1)');
  assert.deepEqual(a.tabel.f, ['-', '0', '+', '|', '+']);
  assert.equal(a.asymptoten.lijst.filter((l) => l.soort === 'VA').length, 0);
  assert.ok(a.asymptoten.stappen.some((s) => s.titel === 'Perforaties'));
  assert.deepEqual(controleerTabel(a.tabel, a.f), []);
});

test('rationaal_somWordtEenBreuk', () => {
  const a = analyse('x + 1/x');
  assert.equal(a.soort, 'rationaal');
  assert.ok(a.nulpunten.stappen.some((s) => s.titel === 'Zet alles op één breuk'));
  assert.deepEqual(a.tabel.f, ['-', '|', '+']);
  assert.deepEqual(a.asymptoten.lijst.map((l) => l.soort), ['VA', 'SA']);
});

test('wortel_kwadratischOnderDeWortel_asymptotenPerKant', () => {
  const a = analyse('sqrt(x^2 + 1) - x');
  assert.deepEqual(controleerTabel(a.tabel, a.f), []);
  const lijst = a.asymptoten.lijst.map((l) => [l.soort, l.kant, l.m, l.q]);
  assert.deepEqual(lijst, [['HA', 'rechts', 0, 0], ['SA', 'links', -2, 0]]);
  assert.ok(a.asymptoten.lijst.every((l) => controleerAsymptoot(l, a.f)));
});

test('numeriek_andereFunctiesGebruikenBenaderingen', () => {
  const a = analyse('2^x - 3');
  assert.equal(a.soort, 'numeriek');
  assert.equal(a.tabel.punten.length, 1);
  assert.ok(Math.abs(a.tabel.punten[0].waarde - Math.log2(3)) < 1e-6);
  assert.deepEqual(a.tabel.f, ['-', '0', '+']);
});

test('veelterm_nulfunctieGeeftGeenValseVerschillen', () => {
  const a = analyse('0');
  assert.deepEqual(a.tabel.f, ['0']);
  assert.deepEqual(controleerTabel(a.tabel, a.f), []);
});

test('numeriek_besluitBlijftBinnenHetOnderzochteStuk', () => {
  const a = analyse('sin(x)');
  assert.ok(a.besluit.length > 0);
  assert.ok(a.besluit.every((lijn) => !lijn.includes('∞')));
});

test('controleerTabel_vindtEenFoutTeken', () => {
  const a = analyse('x^3 - 4x');
  const fout = { ...a.tabel, f: ['-', '0', '-', '0', '-', '0', '+'] };
  assert.ok(controleerTabel(fout, a.f).length > 0);
});
