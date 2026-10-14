/**
 * Opmaak van wiskunde: MathML-bouwstenen en Vlaamse getalnotatie (decimale komma, echt minteken).
 */
import { absGeheel } from './getal.js';

export const MIN = '−';

export function ontsnap(tekst) {
  return String(tekst)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const M = {
  n: (s) => `<mn>${ontsnap(s)}</mn>`,
  i: (s) => `<mi>${ontsnap(s)}</mi>`,
  o: (s) => `<mo>${ontsnap(s)}</mo>`,
  rij: (...delen) => `<mrow>${delen.join('')}</mrow>`,
  breuk: (teller, noemer) => `<mfrac>${teller}${noemer}</mfrac>`,
  wortel: (x) => `<msqrt>${x}</msqrt>`,
  nwortel: (x, n) => `<mroot>${x}${n}</mroot>`,
  macht: (grondtal, exponent) => `<msup>${grondtal}${exponent}</msup>`,
  tekst: (s) => `<mtext>${ontsnap(s)}</mtext>`,
  haakjes: (x) => `<mrow><mo>(</mo>${x}<mo>)</mo></mrow>`,
  formule: (x) => `<math>${x}</math>`,
  /** Een formule op een eigen regel, links uitgelijnd, met breuken op volle grootte. */
  regel: (x) => `<math displaystyle="true">${x}</math>`,
  blok: (x) => `<math display="block">${x}</math>`,
};

export const X = M.i('x');
export const FX = M.rij(M.i('f'), M.haakjes(X));
export const REEEL = M.i('ℝ');

const DECIMAAL = new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 2 });
const DECIMAAL_FIJN = new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 4 });

/** Een kommagetal in Vlaamse notatie: 1,37 en −0,5. */
export function decimaal(x, fijn = false) {
  if (!Number.isFinite(x)) return x > 0 ? '+∞' : x < 0 ? `${MIN}∞` : '?';
  const tekst = (fijn ? DECIMAAL_FIJN : DECIMAAL).format(Object.is(x, -0) ? 0 : x);
  return tekst.replace('-', MIN);
}

export function breukMathML(b) {
  const absoluut = b.absoluut();
  const kern = absoluut.isGeheel()
    ? M.n(absoluut.teller.toString())
    : M.breuk(M.n(absoluut.teller.toString()), M.n(absoluut.noemer.toString()));
  return b.teken() < 0 ? M.rij(M.o(MIN), kern) : kern;
}

export function breukTekst(b) {
  const absoluut = b.absoluut();
  const kern = absoluut.isGeheel() ? `${absoluut.teller}` : `${absoluut.teller}/${absoluut.noemer}`;
  return b.teken() < 0 ? `${MIN}${kern}` : kern;
}

function wortelDeel(coef, d) {
  const w = M.wortel(M.n(d.toString()));
  return coef === 1n ? w : M.rij(M.n(coef.toString()), w);
}

/** Een Getal als MathML, met wortels in één breuk: (−1 − √3)/2. */
export function getalMathML(g) {
  if (g.isRationaal()) return breukMathML(g.a);
  const { t1, t2, d, n } = g.alsEenBreuk();
  if (t1 === 0n) {
    const kern = n === 1n ? wortelDeel(absGeheel(t2), d) : M.breuk(wortelDeel(absGeheel(t2), d), M.n(n.toString()));
    return t2 < 0n ? M.rij(M.o(MIN), kern) : kern;
  }
  const teller = M.rij(
    t1 < 0n ? M.o(MIN) : '',
    M.n(absGeheel(t1).toString()),
    M.o(t2 < 0n ? MIN : '+'),
    wortelDeel(absGeheel(t2), d),
  );
  return n === 1n ? teller : M.breuk(teller, M.n(n.toString()));
}

export function getalTekst(g) {
  if (g.isRationaal()) return breukTekst(g.a);
  const { t1, t2, d, n } = g.alsEenBreuk();
  const wortel = `${absGeheel(t2) === 1n ? '' : absGeheel(t2)}√${d}`;
  let teller;
  if (t1 === 0n) teller = `${t2 < 0n ? MIN : ''}${wortel}`;
  else teller = `${t1 < 0n ? MIN : ''}${absGeheel(t1)} ${t2 < 0n ? MIN : '+'} ${wortel}`;
  if (n === 1n) return teller;
  return t1 === 0n ? `${teller}/${n}` : `(${teller})/${n}`;
}

export function vergelijking(links, teken, rechts) {
  return M.rij(links, M.o(teken), rechts);
}
