import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lijnDikte, omhullende, raaktStreep, exportMaat, pasStrepenIn, Geschiedenis, BASIS_DIKTE } from '../js/tekenblad-logica.js';

const streep = (punten, pen = false) => ({ punten: punten.map(([x, y, druk = 0.5]) => ({ x, y, druk })), pen });

test('lijnDikte_penVolgtDrukVingerIsVast', () => {
  assert.equal(lijnDikte(0.9, false), BASIS_DIKTE);
  assert.ok(lijnDikte(1, true) > lijnDikte(0.1, true));
  assert.equal(lijnDikte(0, true), lijnDikte(0.5, true));
});

test('omhullende_legeTekeningGeeftNull', () => {
  assert.equal(omhullende([]), null);
});

test('omhullende_omvatAlleStrepenMetLijndikte', () => {
  const o = omhullende([streep([[10, 20], [30, 25]]), streep([[5, 50]])]);
  const half = BASIS_DIKTE / 2;
  assert.deepEqual(o, { x0: 5 - half, y0: 20 - half, x1: 30 + half, y1: 50 + half });
});

test('raaktStreep_binnenEnBuitenDeStraal', () => {
  const s = streep([[0, 0], [100, 0]]);
  assert.ok(raaktStreep(s, { x: 50, y: 8 }, 10));
  assert.ok(!raaktStreep(s, { x: 50, y: 12 }, 10));
  assert.ok(!raaktStreep(s, { x: 115, y: 0 }, 10));
  assert.ok(raaktStreep(streep([[5, 5]]), { x: 9, y: 5 }, 10));
});

test('exportMaat_begrenstGrootteEnVergroting', () => {
  assert.deepEqual(exportMaat(3000, 1000, 1568), { schaal: 1568 / 3000, breedte: 1568, hoogte: 523 });
  assert.equal(exportMaat(100, 50, 1568).schaal, 3);
});

test('lijnDikte_drukNaNOfOnbekend_gebruiktMiddenwaarde', () => {
  assert.equal(lijnDikte(Number.NaN, true), lijnDikte(0.5, true));
  assert.equal(lijnDikte(undefined, true), lijnDikte(0.5, true));
});

test('lijnDikte_drukBovenEen_wordtBegrensd', () => {
  assert.equal(lijnDikte(4, true), lijnDikte(1, true));
});

test('raaktStreep_lijnstukZonderLengte_meetTotHetPunt', () => {
  const s = streep([[10, 10], [10, 10]]);
  assert.ok(raaktStreep(s, { x: 15, y: 10 }, 6));
  assert.ok(!raaktStreep(s, { x: 20, y: 10 }, 6));
});

test('omhullendeEnRaaktStreep_streepZonderPunten', () => {
  const leeg = { punten: [], pen: false };
  assert.equal(omhullende([leeg]), null);
  assert.ok(!raaktStreep(leeg, { x: 0, y: 0 }, 10));
});

test('exportMaat_nulMaat_geeftMinstensEenPixel', () => {
  const m = exportMaat(0, 0, 1568);
  assert.ok(m.breedte >= 1 && m.hoogte >= 1);
});

test('pasStrepenIn_binnenHetVel_blijftOngewijzigd', () => {
  const strepen = [streep([[50, 50], [200, 120]])];
  assert.equal(pasStrepenIn(strepen, 800, 600, 20), strepen);
});

test('pasStrepenIn_naDraaien_valtAllesWeerBinnenHetVel', () => {
  const strepen = [streep([[900, 300], [1100, 340]])];
  const ingepast = pasStrepenIn(strepen, 820, 1100, 20);
  const o = omhullende(ingepast);
  assert.ok(o.x0 >= 20 - 1e-9 && o.x1 <= 800 + 1e-9, JSON.stringify(o));
  assert.ok(Math.abs((o.x1 - o.x0) - (omhullende(strepen).x1 - omhullende(strepen).x0)) < 1e-9, 'past zonder verkleinen');
});

test('pasStrepenIn_teBreed_wordtVerkleind', () => {
  const strepen = [streep([[0, 100], [1500, 100]])];
  const o = omhullende(pasStrepenIn(strepen, 820, 1100, 20));
  // De lijndikte krimpt niet mee, dus de rand mag tot een lijndikte in de marge komen.
  assert.ok(o.x0 >= 20 - BASIS_DIKTE && o.x1 <= 800 + BASIS_DIKTE, JSON.stringify(o));
  assert.ok(o.x1 - o.x0 < 800, 'verkleind');
});

test('Geschiedenis_ongedaanZetVorigeToestandTerug', () => {
  const g = new Geschiedenis();
  const a = streep([[1, 1]]);
  const b = streep([[2, 2]]);
  g.bewaar([]);
  g.bewaar([a]);
  g.bewaar([a, b]);
  assert.deepEqual(g.ongedaan(), [a, b]);
  assert.deepEqual(g.ongedaan(), [a]);
  assert.deepEqual(g.ongedaan(), []);
  assert.equal(g.ongedaan(), null);
});

test('Geschiedenis_bewaartEenKopieEnHoudtHetMaximum', () => {
  const g = new Geschiedenis(2);
  const lijst = [streep([[1, 1]])];
  g.bewaar(lijst);
  lijst.push(streep([[2, 2]]));
  g.bewaar(lijst);
  g.bewaar([]);
  assert.equal(g.stapel.length, 2);
  assert.equal(g.stapel[0].length, 2);
});
