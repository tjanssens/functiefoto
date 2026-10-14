/**
 * Veeltermen met exacte (breuk)coëfficiënten: rekenen, staartdeling, Horner en opmaak.
 */
import { Breuk, NUL, EEN, MIN_EEN, kgvGeheel } from './getal.js';
import { M, MIN, X, breukMathML, breukTekst } from './opmaak.js';

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';

export function superscript(n) {
  return [...String(n)].map((c) => SUPERSCRIPT[Number(c)]).join('');
}

export class Veelterm {
  /** @param {Breuk[]} coefficienten coëfficiënt i hoort bij x^i */
  constructor(coefficienten) {
    const c = coefficienten.map((b) => b ?? NUL);
    while (c.length && c[c.length - 1].isNul()) c.pop();
    this.c = Object.freeze(c);
    this.numeriek = Object.freeze(c.map((b) => b.naarGetal()));
    Object.freeze(this);
  }

  static constante(b) {
    return new Veelterm([b]);
  }

  /** (x − r) */
  static lineairMetNulpunt(r) {
    return new Veelterm([r.tegengestelde(), EEN]);
  }

  /** −1 voor de nulveelterm. */
  get graad() {
    return this.c.length - 1;
  }

  coef(i) {
    return this.c[i] ?? NUL;
  }

  kop() {
    return this.c[this.c.length - 1] ?? NUL;
  }

  isNul() {
    return this.c.length === 0;
  }

  isConstant() {
    return this.c.length <= 1;
  }

  aantalTermen() {
    return this.c.filter((b) => !b.isNul()).length;
  }

  plus(q) {
    const n = Math.max(this.c.length, q.c.length);
    return new Veelterm(Array.from({ length: n }, (_, i) => this.coef(i).plus(q.coef(i))));
  }

  min(q) {
    const n = Math.max(this.c.length, q.c.length);
    return new Veelterm(Array.from({ length: n }, (_, i) => this.coef(i).min(q.coef(i))));
  }

  maalBreuk(k) {
    return new Veelterm(this.c.map((b) => b.maal(k)));
  }

  tegengestelde() {
    return this.maalBreuk(MIN_EEN);
  }

  maal(q) {
    if (this.isNul() || q.isNul()) return NUL_VEELTERM;
    const r = Array(this.c.length + q.c.length - 1).fill(NUL);
    this.c.forEach((a, i) => q.c.forEach((b, j) => {
      r[i + j] = r[i + j].plus(a.maal(b));
    }));
    return new Veelterm(r);
  }

  macht(k) {
    let r = EEN_VEELTERM;
    for (let i = 0; i < k; i++) r = r.maal(this);
    return r;
  }

  /** Staartdeling: this = quotient · deler + rest. */
  deel(deler) {
    if (deler.isNul()) throw new RangeError('Delen door de nulveelterm.');
    const quotient = Array(Math.max(this.graad - deler.graad + 1, 0)).fill(NUL);
    let rest = this;
    while (!rest.isNul() && rest.graad >= deler.graad) {
      const k = rest.graad - deler.graad;
      const factor = rest.kop().gedeeldDoor(deler.kop());
      quotient[k] = factor;
      rest = rest.min(monoom(factor, k).maal(deler));
    }
    return { quotient: new Veelterm(quotient), rest };
  }

  waardeIn(x) {
    let s = 0;
    for (let i = this.numeriek.length - 1; i >= 0; i--) s = s * x + this.numeriek[i];
    return s;
  }

  /** Grootte van de termen in x, om te beslissen wat "praktisch 0" is. */
  schaalIn(x) {
    let s = 0;
    const ax = Math.abs(x);
    for (let i = this.numeriek.length - 1; i >= 0; i--) s = s * ax + Math.abs(this.numeriek[i]);
    return s;
  }

  waardeInBreuk(r) {
    let s = NUL;
    for (let i = this.c.length - 1; i >= 0; i--) s = s.maal(r).plus(this.c[i]);
    return s;
  }

  gelijkAan(q) {
    return this.c.length === q.c.length && this.c.every((b, i) => b.gelijkAan(q.c[i]));
  }

  /** Coëfficiënten als gehele getallen (na vermenigvuldigen met het kgv van de noemers). */
  geheleCoefficienten() {
    const kgv = this.c.reduce((k, b) => kgvGeheel(k, b.noemer), 1n);
    return this.c.map((b) => b.teller * (kgv / b.noemer));
  }
}

export const NUL_VEELTERM = new Veelterm([]);
export const EEN_VEELTERM = new Veelterm([EEN]);
export const X_VEELTERM = new Veelterm([NUL, EEN]);

export function monoom(coef, k) {
  const c = Array(k + 1).fill(NUL);
  c[k] = coef;
  return new Veelterm(c);
}

/** Monische grootste gemene deler (algoritme van Euclides). */
export function ggd(p, q) {
  let a = p;
  let b = q;
  while (!b.isNul()) [a, b] = [b, a.deel(b).rest];
  return a.isNul() ? EEN_VEELTERM : a.maalBreuk(EEN.gedeeldDoor(a.kop()));
}

function xMacht(k, variabele) {
  if (k === 0) return '';
  return k === 1 ? variabele : M.macht(variabele, M.n(String(k)));
}

/** MathML van een veelterm, hoogste macht eerst: 2x³ − 3x + 1. */
export function veeltermMathML(p, variabele = X) {
  if (p.isNul()) return M.n('0');
  const delen = [];
  for (let k = p.graad; k >= 0; k--) {
    const c = p.coef(k);
    if (c.isNul()) continue;
    const negatief = c.teken() < 0;
    const absoluut = c.absoluut();
    if (delen.length === 0) {
      if (negatief) delen.push(M.o(MIN));
    } else {
      delen.push(M.o(negatief ? MIN : '+'));
    }
    const coefZichtbaar = k === 0 || !absoluut.gelijkAan(EEN);
    delen.push(M.rij(coefZichtbaar ? breukMathML(absoluut) : '', xMacht(k, variabele)));
  }
  return M.rij(...delen);
}

export function veeltermTekst(p) {
  if (p.isNul()) return '0';
  const delen = [];
  for (let k = p.graad; k >= 0; k--) {
    const c = p.coef(k);
    if (c.isNul()) continue;
    const negatief = c.teken() < 0;
    const absoluut = c.absoluut();
    const coefZichtbaar = k === 0 || !absoluut.gelijkAan(EEN);
    const coef = coefZichtbaar ? breukTekst(absoluut) : '';
    const macht = k === 0 ? '' : k === 1 ? 'x' : `x${superscript(k)}`;
    const term = coef.includes('/') && macht ? `(${coef})${macht}` : `${coef}${macht}`;
    if (delen.length === 0) delen.push(negatief ? `${MIN}${term}` : term);
    else delen.push(`${negatief ? MIN : '+'} ${term}`);
  }
  return delen.join(' ');
}

/** Factor in een product: haakjes rond meer dan één term, exponent als macht > 1. */
export function factorMathML(p, macht = 1) {
  const kern = p.aantalTermen() > 1 ? M.haakjes(veeltermMathML(p)) : veeltermMathML(p);
  return macht > 1 ? M.macht(kern, M.n(String(macht))) : kern;
}

export function factorTekst(p, macht = 1) {
  const kern = p.aantalTermen() > 1 ? `(${veeltermTekst(p)})` : veeltermTekst(p);
  return macht > 1 ? `${kern}${superscript(macht)}` : kern;
}

/** Invullen van r in p, uitgeschreven: 2·1³ − 3·1 + 1. */
export function invullenMathML(p, r) {
  const negatiefOfBreuk = r.teken() < 0 || !r.isGeheel();
  const rWeergave = negatiefOfBreuk ? M.haakjes(breukMathML(r)) : breukMathML(r);
  const delen = [];
  for (let k = p.graad; k >= 0; k--) {
    const c = p.coef(k);
    if (c.isNul()) continue;
    const negatief = c.teken() < 0;
    const absoluut = c.absoluut();
    if (delen.length === 0) {
      if (negatief) delen.push(M.o(MIN));
    } else {
      delen.push(M.o(negatief ? MIN : '+'));
    }
    if (k === 0) {
      delen.push(breukMathML(absoluut));
      continue;
    }
    const macht = k === 1 ? rWeergave : M.macht(rWeergave, M.n(String(k)));
    delen.push(absoluut.gelijkAan(EEN) ? macht : M.rij(breukMathML(absoluut), M.o('·'), macht));
  }
  return M.rij(...delen);
}

/** Het schema van Horner voor de deling van p door (x − r). */
export function hornerSchema(p, r) {
  const boven = [];
  const midden = [null];
  const onder = [];
  let s = null;
  for (let k = p.graad; k >= 0; k--) {
    const c = p.coef(k);
    boven.push(c);
    if (s === null) {
      s = c;
    } else {
      const product = s.maal(r);
      midden.push(product);
      s = c.plus(product);
    }
    onder.push(s);
  }
  const rest = onder[onder.length - 1];
  const quotientCoefs = onder.slice(0, -1).reverse();
  return { deler: r, boven, midden, onder, quotient: new Veelterm(quotientCoefs), rest };
}
