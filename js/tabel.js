/**
 * Bouwstenen van de tekentabel: tekens per kolom, intervallen en het besluit.
 * Een tabel met n punten heeft 2n + 1 kolommen: interval, punt, interval, ..., interval.
 */
import { M, MIN, X, FX, REEEL, decimaal, getalMathML } from './opmaak.js';

export const TEKEN = Object.freeze({ PLUS: '+', MIN: '-', NUL: '0', NIET: '|', BUITEN: '/' });

const NUL_TOLERANTIE = 1e-9;

/** Het teken van een waarde; schaal is de grootte van de termen (voor afrondingsfouten). */
export function tekenVan(waarde, schaal = 1) {
  if (Number.isNaN(waarde)) return TEKEN.BUITEN;
  if (!Number.isFinite(waarde)) return TEKEN.NIET;
  if (Math.abs(waarde) <= NUL_TOLERANTIE * Math.max(1, schaal)) return TEKEN.NUL;
  return waarde > 0 ? TEKEN.PLUS : TEKEN.MIN;
}

/** Punten oplopend en zonder dubbels; een exact punt wint van een benaderd. */
export function ordenPunten(lijst) {
  const gesorteerd = [...lijst].sort((a, b) => a.waarde - b.waarde);
  const uniek = [];
  for (const p of gesorteerd) {
    const vorige = uniek[uniek.length - 1];
    if (vorige && Math.abs(vorige.waarde - p.waarde) <= 1e-9 * Math.max(1, Math.abs(p.waarde))) {
      if (!vorige.getal && p.getal) uniek[uniek.length - 1] = { waarde: p.waarde, getal: p.getal };
      continue;
    }
    uniek.push({ waarde: p.waarde, getal: p.getal });
  }
  return uniek;
}

/** Eén x-waarde per interval tussen de punten. */
export function testwaarden(punten) {
  if (punten.length === 0) return [0.37];
  const w = punten.map((p) => p.waarde);
  const res = [w[0] - 1];
  for (let i = 0; i < w.length - 1; i++) res.push((w[i] + w[i + 1]) / 2);
  res.push(w[w.length - 1] + 1);
  return res;
}

function machtTeken(t, macht) {
  return t === TEKEN.MIN && macht % 2 === 0 ? TEKEN.PLUS : t;
}

/** Tekens van veelterm^macht in elke kolom. */
export function veeltermTekens(p, macht, punten) {
  const tekens = [];
  testwaarden(punten).forEach((x, i) => {
    tekens.push(machtTeken(tekenVan(p.waardeIn(x)), macht));
    if (i < punten.length) {
      const w = punten[i].waarde;
      tekens.push(machtTeken(tekenVan(p.waardeIn(w), p.schaalIn(w)), macht));
    }
  });
  return tekens;
}

/** Tekens van een willekeurige functie, numeriek. */
export function functieTekens(f, punten) {
  const tekens = [];
  testwaarden(punten).forEach((x, i) => {
    tekens.push(tekenVan(f(x)));
    if (i < punten.length) tekens.push(tekenVan(f(punten[i].waarde)));
  });
  return tekens;
}

/** Het teken van een product of quotiënt van rijen; ‖ waar de noemer 0 is of het punt uitgesloten is. */
export function productTekens(rijen, aantalKolommen, uitgeslotenKolommen = new Set()) {
  const res = [];
  for (let k = 0; k < aantalKolommen; k++) {
    if (uitgeslotenKolommen.has(k) || rijen.some((r) => r.herkomst === 'noemer' && r.tekens[k] === TEKEN.NUL)) {
      res.push(TEKEN.NIET);
    } else if (rijen.some((r) => r.tekens[k] === TEKEN.NUL)) {
      res.push(TEKEN.NUL);
    } else {
      const minnen = rijen.filter((r) => r.tekens[k] === TEKEN.MIN).length;
      res.push(minnen % 2 === 0 ? TEKEN.PLUS : TEKEN.MIN);
    }
  }
  return res;
}

export function puntMathML(p) {
  return p.getal ? getalMathML(p.getal) : M.n(decimaal(p.waarde));
}

/** Groepen van opeenvolgende kolommen die voldoen, als intervallen (null = oneindig). */
export function intervallen(tekens, punten, voldoet) {
  const groepen = [];
  let start = null;
  for (let k = 0; k <= tekens.length; k++) {
    const ok = k < tekens.length && voldoet(tekens[k]);
    if (ok && start === null) start = k;
    if (!ok && start !== null) {
      groepen.push([start, k - 1]);
      start = null;
    }
  }
  return groepen.map(([a, b]) => ({
    links: a % 2 === 0
      ? (a === 0 ? null : { punt: punten[a / 2 - 1], gesloten: false })
      : { punt: punten[(a - 1) / 2], gesloten: true },
    rechts: b % 2 === 0
      ? (b === tekens.length - 1 ? null : { punt: punten[b / 2], gesloten: false })
      : { punt: punten[(b - 1) / 2], gesloten: true },
    enkelPunt: a === b && a % 2 === 1,
  }));
}

const MIN_ONEINDIG = M.rij(M.o(MIN), M.i('∞'));
const PLUS_ONEINDIG = M.rij(M.o('+'), M.i('∞'));

function intervalMathML(g) {
  if (g.enkelPunt) return M.rij(M.o('{'), puntMathML(g.links.punt), M.o('}'));
  const links = g.links
    ? M.rij(M.o(g.links.gesloten ? '[' : ']'), puntMathML(g.links.punt))
    : M.rij(M.o(']'), MIN_ONEINDIG);
  const rechts = g.rechts
    ? M.rij(puntMathML(g.rechts.punt), M.o(g.rechts.gesloten ? ']' : '['))
    : M.rij(PLUS_ONEINDIG, M.o('['));
  return M.rij(links, M.o(','), rechts);
}

/** Een unie van intervallen in Vlaamse notatie: ]−∞, 2[ ∪ [3, +∞[. */
export function verzamelingMathML(groepen) {
  if (groepen.length === 0) return M.o('∅');
  if (groepen.length === 1 && !groepen[0].links && !groepen[0].rechts) return REEEL;
  const delen = [];
  groepen.forEach((g, i) => {
    if (i > 0) delen.push(M.o('∪'));
    delen.push(intervalMathML(g));
  });
  return M.rij(...delen);
}

export function puntenVerzamelingMathML(punten) {
  const delen = [];
  punten.forEach((p, i) => {
    if (i > 0) delen.push(M.o(','));
    delen.push(puntMathML(p));
  });
  return M.rij(M.o('{'), ...delen, M.o('}'));
}

/** ℝ \ {a, b}, of ℝ als er niets uitgesloten is. */
export function reeelZonderMathML(punten) {
  if (punten.length === 0) return REEEL;
  return M.rij(REEEL, M.o('\\'), puntenVerzamelingMathML(punten));
}

/** Vervangt ±∞ door gesloten grenzen, voor een tabel die maar op een stuk van ℝ geldt. */
export function begrens(groepen, grens) {
  if (!grens) return groepen;
  const punt = (waarde) => ({ punt: { waarde, getal: null }, gesloten: true });
  return groepen.map((g) => ({ ...g, links: g.links ?? punt(-grens), rechts: g.rechts ?? punt(grens) }));
}

/** De besluiten uit de f-rij: waar f positief, negatief en 0 is (binnen [−grens, grens] als die gegeven is). */
export function besluitUitTabel(fTekens, punten, grens = null) {
  const lijnen = [];
  const voor = M.tekst(' voor ');
  const positief = begrens(intervallen(fTekens, punten, (t) => t === TEKEN.PLUS), grens);
  const negatief = begrens(intervallen(fTekens, punten, (t) => t === TEKEN.MIN), grens);
  const nul = begrens(intervallen(fTekens, punten, (t) => t === TEKEN.NUL), grens);
  if (positief.length) lijnen.push(M.rij(FX, M.o('>'), M.n('0'), voor, X, M.o('∈'), verzamelingMathML(positief)));
  if (negatief.length) lijnen.push(M.rij(FX, M.o('<'), M.n('0'), voor, X, M.o('∈'), verzamelingMathML(negatief)));
  if (nul.length) {
    const alleenPunten = nul.every((g) => g.enkelPunt);
    if (alleenPunten && nul.length === 1) {
      lijnen.push(M.rij(FX, M.o('='), M.n('0'), voor, X, M.o('='), puntMathML(nul[0].links.punt)));
    } else if (alleenPunten) {
      lijnen.push(M.rij(FX, M.o('='), M.n('0'), voor, X, M.o('∈'), puntenVerzamelingMathML(nul.map((g) => g.links.punt))));
    } else {
      lijnen.push(M.rij(FX, M.o('='), M.n('0'), voor, X, M.o('∈'), verzamelingMathML(nul)));
    }
  }
  return lijnen;
}
