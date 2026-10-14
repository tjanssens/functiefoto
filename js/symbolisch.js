/**
 * Herkent het soort functie in de boom: een breuk van veeltermen (P/Q) of een
 * wortelfunctie C·√A + B met A en B veeltermen en C een getal.
 */
import { EEN, MIN_EEN, NUL } from './getal.js';
import { constanteBreuk } from './expressie.js';
import { Veelterm, X_VEELTERM, EEN_VEELTERM, NUL_VEELTERM, ggd } from './veelterm.js';

const MAX_EXPONENT = 20;

function alleenVeelterm(teller) {
  return { teller, noemer: EEN_VEELTERM, voorwaarden: [] };
}

/**
 * Zet de boom om naar teller/noemer, met de voorwaarden (veeltermen die niet 0 mogen zijn).
 * Geeft null als de functie geen breuk van veeltermen is.
 */
export function naarRationaal(k) {
  switch (k.soort) {
    case 'getal':
      return alleenVeelterm(Veelterm.constante(k.breuk));
    case 'x':
      return alleenVeelterm(X_VEELTERM);
    case 'neg': {
      const a = naarRationaal(k.a);
      return a && { ...a, teller: a.teller.maalBreuk(MIN_EEN) };
    }
    case '+':
    case '-': {
      const a = naarRationaal(k.a);
      const b = naarRationaal(k.b);
      if (!a || !b) return null;
      const g = ggd(a.noemer, b.noemer);
      const restA = a.noemer.deel(g).quotient;
      const restB = b.noemer.deel(g).quotient;
      const ta = a.teller.maal(restB);
      const tb = b.teller.maal(restA);
      return {
        teller: k.soort === '+' ? ta.plus(tb) : ta.min(tb),
        noemer: restA.maal(b.noemer),
        voorwaarden: [...a.voorwaarden, ...b.voorwaarden],
      };
    }
    case '*': {
      const a = naarRationaal(k.a);
      const b = naarRationaal(k.b);
      if (!a || !b) return null;
      return {
        teller: a.teller.maal(b.teller),
        noemer: a.noemer.maal(b.noemer),
        voorwaarden: [...a.voorwaarden, ...b.voorwaarden],
      };
    }
    case '/': {
      const a = naarRationaal(k.a);
      const b = naarRationaal(k.b);
      if (!a || !b || b.teller.isNul()) return null;
      return {
        teller: a.teller.maal(b.noemer),
        noemer: a.noemer.maal(b.teller),
        voorwaarden: [...a.voorwaarden, ...b.voorwaarden, b.teller],
      };
    }
    case '^': {
      const exponent = constanteBreuk(k.b);
      if (!exponent || !exponent.isGeheel()) return null;
      const n = Number(exponent.teller);
      if (Math.abs(n) > MAX_EXPONENT) return null;
      const a = naarRationaal(k.a);
      if (!a) return null;
      if (n >= 0) return { teller: a.teller.macht(n), noemer: a.noemer.macht(n), voorwaarden: a.voorwaarden };
      if (a.teller.isNul()) return null;
      return { teller: a.noemer.macht(-n), noemer: a.teller.macht(-n), voorwaarden: [...a.voorwaarden, a.teller] };
    }
    default:
      return null;
  }
}

/** De veelterm als de knoop een veelterm is (zonder x in een noemer), anders null. */
export function alsVeelterm(k) {
  const r = naarRationaal(k);
  if (!r || !r.noemer.isConstant() || r.voorwaarden.some((v) => !v.isConstant())) return null;
  return r.teller.maalBreuk(EEN.gedeeldDoor(r.noemer.kop()));
}

function verzamelTermen(k, teken, termen) {
  if (k.soort === '+') {
    verzamelTermen(k.a, teken, termen);
    verzamelTermen(k.b, teken, termen);
  } else if (k.soort === '-') {
    verzamelTermen(k.a, teken, termen);
    verzamelTermen(k.b, -teken, termen);
  } else if (k.soort === 'neg') {
    verzamelTermen(k.a, -teken, termen);
  } else {
    termen.push({ teken, knoop: k });
  }
}

/** c·√A, √A·c, √A/c of −√A, anders null. */
function wortelTerm(k) {
  if (k.soort === 'functie' && k.naam === 'sqrt') {
    const radicand = alsVeelterm(k.args[0]);
    return radicand && !radicand.isConstant() ? { coef: EEN, radicand } : null;
  }
  if (k.soort === 'neg') {
    const w = wortelTerm(k.a);
    return w && { coef: w.coef.tegengestelde(), radicand: w.radicand };
  }
  if (k.soort === '*') {
    const links = constanteBreuk(k.a);
    if (links) {
      const w = wortelTerm(k.b);
      return w && { coef: links.maal(w.coef), radicand: w.radicand };
    }
    const rechts = constanteBreuk(k.b);
    if (rechts) {
      const w = wortelTerm(k.a);
      return w && { coef: rechts.maal(w.coef), radicand: w.radicand };
    }
    return null;
  }
  if (k.soort === '/') {
    const deler = constanteBreuk(k.b);
    if (!deler || deler.isNul()) return null;
    const w = wortelTerm(k.a);
    return w && { coef: w.coef.gedeeldDoor(deler), radicand: w.radicand };
  }
  return null;
}

/** Herkent f(x) = C·√A + B. Geeft { C, A, B } of null. */
export function naarWortelvorm(k) {
  const termen = [];
  verzamelTermen(k, 1, termen);
  let C = NUL;
  let A = null;
  let B = NUL_VEELTERM;
  for (const { teken, knoop } of termen) {
    const veelterm = alsVeelterm(knoop);
    if (veelterm) {
      B = teken > 0 ? B.plus(veelterm) : B.min(veelterm);
      continue;
    }
    const w = wortelTerm(knoop);
    if (!w) return null;
    if (A && !A.gelijkAan(w.radicand)) return null;
    A = w.radicand;
    C = teken > 0 ? C.plus(w.coef) : C.min(w.coef);
  }
  if (!A || C.isNul()) return null;
  return { C, A, B };
}
