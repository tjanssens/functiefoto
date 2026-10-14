/**
 * Een veelterm ontbinden in factoren van de eerste en tweede graad, met de stappen
 * zoals in de klas: x buiten haakjes, een nulpunt proberen, Horner en de discriminant.
 */
import { Breuk, Getal, NUL, absGeheel } from './getal.js';
import { M, MIN, X, breukMathML, breukTekst, decimaal } from './opmaak.js';
import {
  Veelterm,
  X_VEELTERM,
  EEN_VEELTERM,
  hornerSchema,
  invullenMathML,
  veeltermMathML,
  veeltermTekst,
  factorMathML,
  superscript,
} from './veelterm.js';

const NUL_MML = M.n('0');
const MAX_COEFFICIENT_VOOR_PROBEREN = 10n ** 9n;

/** Een nulpunt met exacte waarde (getal) of alleen een benadering (getal = null). */
export function exactNulpunt(getal, multipliciteit = 1) {
  return { getal, waarde: getal.naarGetal(), multipliciteit };
}

export function benaderdNulpunt(waarde, multipliciteit = 1) {
  return { getal: null, waarde, multipliciteit };
}

function delers(n) {
  const klein = [];
  const groot = [];
  for (let d = 1n; d * d <= n; d++) {
    if (n % d === 0n) {
      klein.push(d);
      if (d * d !== n) groot.unshift(n / d);
    }
  }
  return [...klein, ...groot];
}

/** Zoekt een rationaal nulpunt p/q met p | constante term en q | hoogstegraadscoëfficiënt. */
export function zoekRationaalNulpunt(p) {
  const geheel = p.geheleCoefficienten();
  const a0 = absGeheel(geheel[0]);
  const an = absGeheel(geheel[geheel.length - 1]);
  if (a0 === 0n) return new Breuk(0n);
  if (a0 > MAX_COEFFICIENT_VOOR_PROBEREN || an > MAX_COEFFICIENT_VOOR_PROBEREN) return null;
  const kandidaten = [];
  for (const q of delers(an)) {
    for (const t of delers(a0)) kandidaten.push(new Breuk(t, q), new Breuk(-t, q));
  }
  kandidaten.sort((a, b) => Math.abs(a.naarGetal()) - Math.abs(b.naarGetal()) || b.teken() - a.teken());
  return kandidaten.find((r) => p.waardeInBreuk(r).isNul()) ?? null;
}

function bisectie(f, a, b) {
  let links = a;
  let rechts = b;
  let fLinks = f(links);
  for (let i = 0; i < 80; i++) {
    const midden = (links + rechts) / 2;
    const fMidden = f(midden);
    if (fMidden === 0) return midden;
    if (Math.sign(fMidden) === Math.sign(fLinks)) {
      links = midden;
      fLinks = fMidden;
    } else {
      rechts = midden;
    }
  }
  return (links + rechts) / 2;
}

/** Reële nulpunten van een veelterm, numeriek (tekenwissels binnen de grens van Cauchy). */
export function benaderNulpunten(p) {
  const kop = Math.abs(p.numeriek[p.graad]);
  const grens = 1 + Math.max(...p.numeriek.slice(0, -1).map((c) => Math.abs(c) / kop));
  const stappen = 4000;
  const h = (2 * grens) / stappen;
  const f = (x) => p.waardeIn(x);
  const nulpunten = [];
  let x0 = -grens;
  let y0 = f(x0);
  for (let i = 1; i <= stappen; i++) {
    const x1 = -grens + i * h;
    const y1 = f(x1);
    if (y0 === 0) nulpunten.push(x0);
    else if (y0 * y1 < 0) nulpunten.push(bisectie(f, x0, x1));
    x0 = x1;
    y0 = y1;
  }
  return nulpunten;
}

function haakjesAlsNegatief(b) {
  return b.teken() < 0 ? M.haakjes(breukMathML(b)) : breukMathML(b);
}

function voegFactorToe(factoren, veelterm, nulpunten, extra = {}) {
  const bestaand = factoren.find((f) => f.veelterm.gelijkAan(veelterm));
  if (bestaand) {
    bestaand.macht += 1;
    return;
  }
  factoren.push({ veelterm, macht: 1, nulpunten, ...extra });
}

function productMathML(factoren, rest) {
  const delen = factoren.map((f) => factorMathML(f.veelterm, f.macht));
  if (!rest.isConstant() || !rest.kop().gelijkAan(new Breuk(1n))) delen.push(factorMathML(rest));
  return M.rij(...delen);
}

function plusMinusVorm(g) {
  const { t1, t2, d, n } = g.alsEenBreuk();
  const wortel = absGeheel(t2) === 1n ? M.wortel(M.n(d.toString())) : M.rij(M.n(absGeheel(t2).toString()), M.wortel(M.n(d.toString())));
  const teller = t1 === 0n
    ? M.rij(M.o('±'), wortel)
    : M.rij(t1 < 0n ? M.o(MIN) : '', M.n(absGeheel(t1).toString()), M.o('±'), wortel);
  return n === 1n ? teller : M.breuk(teller, M.n(n.toString()));
}

/** Is (−b ± √D)/(2a) al de eenvoudigste schrijfwijze van dit nulpunt? */
function isAlEenvoudig(nulpunt, minB, D, tweeA) {
  if (!D.isGeheel() || !tweeA.isGeheel() || !minB.isGeheel()) return false;
  const { t1, t2, d, n } = nulpunt.alsEenBreuk();
  return n === absGeheel(tweeA.teller) && absGeheel(t2) === 1n && d === D.teller && absGeheel(t1) === absGeheel(minB.teller);
}

/** Lost ax² + bx + c = 0 op met de discriminant; geeft de stappen en de nulpunten. */
export function losKwadratischOp(q, voorvoegsel = '') {
  const c = q.coef(0);
  const b = q.coef(1);
  const a = q.coef(2);
  const D = b.maal(b).min(new Breuk(4n).maal(a).maal(c));
  const naam = veeltermTekst(q);
  const stappen = [];
  const uitlegD = D.teken() > 0
    ? 'De discriminant is positief, dus er zijn twee nulpunten.'
    : D.isNul()
      ? 'De discriminant is 0, dus er is één dubbel nulpunt.'
      : `De discriminant is negatief, dus ${naam} heeft geen nulpunten.`;
  stappen.push({
    titel: `${voorvoegsel}Bereken de discriminant van ${naam}`,
    formules: [M.rij(
      M.i('D'), M.o('='), M.macht(haakjesAlsNegatief(b), M.n('2')), M.o(MIN), M.n('4'), M.o('·'),
      haakjesAlsNegatief(a), M.o('·'), haakjesAlsNegatief(c), M.o('='), breukMathML(D),
    )],
    uitleg: uitlegD,
  });
  if (D.teken() < 0) return { stappen, nulpunten: [], D };

  const tweeA = a.maal(new Breuk(2n));
  const minB = b.tegengestelde();
  if (D.isNul()) {
    const r = minB.gedeeldDoor(tweeA);
    stappen.push({
      titel: `${voorvoegsel}Bereken het dubbele nulpunt`,
      formules: [M.rij(X, M.o('='), M.breuk(breukMathML(minB), breukMathML(tweeA)), M.o('='), breukMathML(r))],
      uitleg: 'Bij een dubbel nulpunt raakt de grafiek de x-as en wisselt het teken niet.',
    });
    return { stappen, nulpunten: [exactNulpunt(Getal.van(r), 2)], D };
  }

  const wortelD = Getal.wortelVan(D);
  const deler = new Breuk(1n).gedeeldDoor(tweeA);
  const plus = Getal.van(minB).plus(wortelD).maalBreuk(deler);
  const min = Getal.van(minB).plus(wortelD.maalBreuk(new Breuk(-1n))).maalBreuk(deler);
  const nulpunten = [exactNulpunt(plus), exactNulpunt(min)].sort((p, r) => p.waarde - r.waarde);

  const tellerFormule = minB.isNul()
    ? M.rij(M.o('±'), M.wortel(breukMathML(D)))
    : M.rij(breukMathML(minB), M.o('±'), M.wortel(breukMathML(D)));
  const formules = [M.rij(X, M.o('='), M.breuk(tellerFormule, breukMathML(tweeA)))];
  let uitleg;
  if (wortelD.isRationaal()) {
    formules.push(M.rij(X, M.o('='), breukMathML(nulpunten[0].getal.a), M.tekst(' of '), X, M.o('='), breukMathML(nulpunten[1].getal.a)));
    uitleg = `Omdat √${breukTekst(D)} = ${breukTekst(wortelD.a)}, zijn de nulpunten rationale getallen.`;
  } else {
    if (!isAlEenvoudig(plus, minB, D, tweeA)) formules.push(M.rij(X, M.o('='), plusMinusVorm(plus)));
    formules.push(M.rij(X, M.o('≈'), M.n(decimaal(nulpunten[0].waarde)), M.tekst(' of '), X, M.o('≈'), M.n(decimaal(nulpunten[1].waarde))));
    const buiten = wortelD.b.teller;
    uitleg = D.isGeheel() && buiten > 1n
      ? `Omdat √${breukTekst(D)} = ${buiten}√${wortelD.d}, kun je de breuk vereenvoudigen.`
      : 'Vul a, b en D in de formule (−b ± √D)/(2a) in.';
  }
  stappen.push({ titel: `${voorvoegsel}Bereken de nulpunten`, formules, uitleg });
  return { stappen, nulpunten, D };
}

function uitlegProberen(p, r) {
  const geheel = p.geheleCoefficienten();
  const a0 = absGeheel(geheel[0]);
  const an = absGeheel(geheel[geheel.length - 1]);
  if (r.isGeheel()) return `Een geheel nulpunt is altijd een deler van de constante term, hier ${a0}.`;
  return `Een rationaal nulpunt heeft een teller die ${a0} deelt en een noemer die ${an} deelt.`;
}

function uitlegHorner(p, r) {
  const ontbreekt = p.c.some((b) => b.isNul());
  const bevestiging = `de rest 0 bevestigt dat x = ${breukTekst(r)} een nulpunt is`;
  return ontbreekt
    ? `Voor de ontbrekende machten vul je een 0 in, en ${bevestiging}.`
    : `${bevestiging[0].toUpperCase()}${bevestiging.slice(1)}.`;
}

/**
 * Ontbindt p in factoren van graad 1 en 2 (en zo nodig een benaderde rest).
 * Geeft { constante, factoren: [{veelterm, macht, nulpunten, D?, benaderd?}], stappen }.
 */
export function ontbind(p, voorvoegsel = '') {
  const stappen = [];
  const factoren = [];
  if (p.isConstant()) return { constante: p.kop(), factoren, stappen };

  let rest = p;
  let k = 0;
  while (rest.coef(k).isNul()) k++;
  if (k > 0) {
    rest = new Veelterm(rest.c.slice(k));
    factoren.push({ veelterm: X_VEELTERM, macht: k, nulpunten: [exactNulpunt(Getal.van(NUL))] });
    const xk = k === 1 ? 'x' : `x${superscript(k)}`;
    if (rest.isConstant()) {
      stappen.push({
        titel: `${voorvoegsel}Los op`,
        formules: [M.rij(veeltermMathML(p), M.o('='), NUL_MML, M.o('⇔'), X, M.o('='), NUL_MML)],
        uitleg: `${xk} is alleen 0 als x zelf 0 is.`,
      });
    } else {
      stappen.push({
        titel: `${voorvoegsel}Zet ${xk} buiten haakjes`,
        formules: [M.rij(factorMathML(X_VEELTERM, k), M.haakjes(veeltermMathML(rest)), M.o('='), NUL_MML)],
        uitleg: `Elke term bevat ${xk}, dus je kunt ${xk} buiten haakjes brengen.`,
      });
    }
  }

  while (rest.graad >= 3) {
    const r = zoekRationaalNulpunt(rest);
    if (!r) break;
    stappen.push({
      titel: `${voorvoegsel}Zoek een nulpunt door te proberen`,
      formules: [M.rij(invullenMathML(rest, r), M.o('='), NUL_MML)],
      uitleg: uitlegProberen(rest, r),
    });
    const schema = hornerSchema(rest, r);
    const deler = Veelterm.lineairMetNulpunt(r);
    stappen.push({
      titel: `${voorvoegsel}Deel door ${veeltermTekst(deler)} met Horner`,
      horner: schema,
      uitleg: uitlegHorner(rest, r),
    });
    voegFactorToe(factoren, deler, [exactNulpunt(Getal.van(r))]);
    rest = schema.quotient;
    stappen.push({
      titel: `${voorvoegsel}Schrijf als product`,
      formules: [M.rij(veeltermMathML(p), M.o('='), productMathML(factoren, rest))],
      uitleg: `Het quotiënt uit Horner is ${veeltermTekst(rest)}.`,
    });
  }

  if (rest.graad >= 3) {
    const waarden = benaderNulpunten(rest);
    stappen.push({
      titel: `${voorvoegsel}Benader de andere nulpunten`,
      formules: waarden.length ? [M.rij(X, M.o('≈'), M.n(waarden.map((w) => decimaal(w)).join(' ; ')))] : [],
      uitleg: waarden.length
        ? `${veeltermTekst(rest)} heeft geen rationale nulpunten meer, dus deze nulpunten zijn benaderd.`
        : `${veeltermTekst(rest)} heeft geen rationale nulpunten en ook geen andere reële nulpunten.`,
    });
    factoren.push({ veelterm: rest, macht: 1, nulpunten: waarden.map((w) => benaderdNulpunt(w)), benaderd: true });
    rest = EEN_VEELTERM;
  } else if (rest.graad === 2) {
    const oplossing = losKwadratischOp(rest, voorvoegsel);
    stappen.push(...oplossing.stappen);
    voegFactorToe(factoren, rest, oplossing.nulpunten, { D: oplossing.D });
    rest = EEN_VEELTERM;
  } else if (rest.graad === 1) {
    const r = rest.coef(0).tegengestelde().gedeeldDoor(rest.coef(1));
    stappen.push({
      titel: `${voorvoegsel}Los de eerstegraadsvergelijking op`,
      formules: [M.rij(veeltermMathML(rest), M.o('='), NUL_MML, M.o('⇔'), X, M.o('='), breukMathML(r))],
      uitleg: 'Breng de constante naar het rechterlid en deel door de coëfficiënt van x.',
    });
    voegFactorToe(factoren, rest, [exactNulpunt(Getal.van(r))]);
    rest = EEN_VEELTERM;
  }
  return { constante: rest.kop(), factoren, stappen };
}

/** Alle nulpunten van een ontbinding, oplopend, met hun multipliciteit. */
export function nulpuntenVan(ontbinding) {
  const lijst = [];
  for (const f of ontbinding.factoren) {
    for (const n of f.nulpunten) lijst.push({ ...n, multipliciteit: n.multipliciteit * f.macht });
  }
  return lijst.sort((a, b) => a.waarde - b.waarde);
}
