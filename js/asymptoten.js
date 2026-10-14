/**
 * Asymptoten van veelterm-, rationale en wortelfuncties, met één zin uitleg per stap.
 */
import { Breuk, Getal, EEN } from './getal.js';
import { M, MIN, X, breukMathML, getalMathML } from './opmaak.js';
import { ggd, veeltermMathML, factorMathML } from './veelterm.js';
import { ontbind, nulpuntenVan } from './factoren.js';
import { puntMathML } from './tabel.js';

const Y = M.i('y');

function rechteMathML(m, q) {
  if (m.isRationaal() && m.a.isNul()) return M.rij(Y, M.o('='), getalMathML(q));
  let helling;
  if (m.isRationaal()) {
    const absoluut = m.a.absoluut();
    const kern = absoluut.gelijkAan(EEN) ? X : M.rij(breukMathML(absoluut), X);
    helling = m.a.teken() < 0 ? M.rij(M.o(MIN), kern) : kern;
  } else {
    helling = M.rij(M.haakjes(getalMathML(m)), X);
  }
  if (q.isRationaal() && q.a.isNul()) return M.rij(Y, M.o('='), helling);
  if (q.isRationaal()) {
    return M.rij(Y, M.o('='), helling, M.o(q.a.teken() < 0 ? MIN : '+'), breukMathML(q.a.absoluut()));
  }
  return M.rij(Y, M.o('='), helling, M.o('+'), M.haakjes(getalMathML(q)));
}

function rechte(m, q, kant) {
  const isHorizontaal = m.isRationaal() && m.a.isNul();
  return {
    soort: isHorizontaal ? 'HA' : 'SA',
    m: m.naarGetal(),
    q: q.naarGetal(),
    kant,
    mathml: rechteMathML(m, q),
  };
}

export function veeltermAsymptoten(P) {
  const uitleg = P.graad <= 1
    ? 'De grafiek is zelf een rechte, dus er zijn geen asymptoten.'
    : 'Een veeltermfunctie van graad 2 of hoger heeft geen asymptoten.';
  return { stappen: [{ titel: 'Geen asymptoten', formules: [], uitleg }], lijst: [] };
}

/** Asymptoten van P/Q: verticale in de overblijvende nulpunten van de noemer, horizontale of schuine via de graden. */
export function rationaleAsymptoten(P, Q, uitgesloten) {
  const stappen = [];
  const lijst = [];
  const gemeenschappelijk = ggd(P, Q);
  const vereenvoudigdeNoemer = Q.deel(gemeenschappelijk).quotient;
  const verticaal = nulpuntenVan(ontbind(vereenvoudigdeNoemer));
  const isVerticaal = (p) => verticaal.some((v) => Math.abs(v.waarde - p.waarde) < 1e-9);
  const perforaties = uitgesloten.filter((p) => !isVerticaal(p));

  if (verticaal.length) {
    const unieke = verticaal.filter((v, i) => i === 0 || Math.abs(v.waarde - verticaal[i - 1].waarde) > 1e-9);
    const formules = unieke.map((v) => M.rij(X, M.o('='), puntMathML(v)));
    stappen.push({
      titel: 'Verticale asymptoten',
      formules,
      uitleg: gemeenschappelijk.isConstant()
        ? 'In de nulpunten van de noemer is de teller niet 0, dus daar gaat f naar ±∞.'
        : 'Na het schrappen van gemeenschappelijke factoren blijven deze nulpunten van de noemer over: daar gaat f naar ±∞.',
    });
    unieke.forEach((v, i) => lijst.push({ soort: 'VA', x: v.waarde, mathml: formules[i] }));
  } else {
    stappen.push({
      titel: 'Verticale asymptoten',
      formules: [],
      uitleg: perforaties.length
        ? 'Na het schrappen van gemeenschappelijke factoren wordt de noemer nergens 0, dus er zijn geen verticale asymptoten.'
        : 'De noemer wordt nergens 0, dus er zijn geen verticale asymptoten.',
    });
  }
  if (perforaties.length) {
    stappen.push({
      titel: 'Perforaties',
      formules: perforaties.map((p) => M.rij(X, M.o('='), puntMathML(p))),
      uitleg: 'Hier zijn teller en noemer allebei 0 en valt de factor weg, dus heeft de grafiek een gat en geen asymptoot.',
    });
  }

  const m = P.graad;
  const n = Q.graad;
  const graden = M.rij(M.tekst('gr T = '), M.n(String(m)), M.tekst(' en gr N = '), M.n(String(n)));
  if (m < n) {
    stappen.push({ titel: 'Vergelijk de graden', formules: [graden], uitleg: 'De graad van de teller is kleiner dan die van de noemer, dus f nadert 0 voor grote |x|.' });
    const nul = Getal.van(new Breuk(0n));
    const ha = rechte(nul, nul, 'beide');
    stappen.push({ titel: 'Horizontale asymptoot', formules: [ha.mathml], uitleg: 'De horizontale asymptoot is de x-as.' });
    lijst.push(ha);
  } else if (m === n) {
    const q = P.kop().gedeeldDoor(Q.kop());
    const ha = rechte(Getal.van(new Breuk(0n)), Getal.van(q), 'beide');
    stappen.push({ titel: 'Vergelijk de graden', formules: [graden], uitleg: 'De graden zijn gelijk, dus er is een horizontale asymptoot.' });
    stappen.push({
      titel: 'Horizontale asymptoot',
      formules: [M.rij(Y, M.o('='), M.breuk(breukMathML(P.kop()), breukMathML(Q.kop())), M.o('='), breukMathML(q))],
      uitleg: 'De horizontale asymptoot is het quotiënt van de hoogstegraadscoëfficiënten van teller en noemer.',
    });
    lijst.push(ha);
  } else if (m === n + 1) {
    const { quotient, rest } = P.deel(Q);
    stappen.push({ titel: 'Vergelijk de graden', formules: [graden], uitleg: 'De graad van de teller is precies 1 hoger dan die van de noemer, dus er is een schuine asymptoot.' });
    stappen.push({
      titel: 'Deel de teller door de noemer',
      formules: [M.rij(veeltermMathML(P), M.o('='), factorMathML(Q), M.o('·'), factorMathML(quotient), M.o('+'), M.haakjes(veeltermMathML(rest)))],
      uitleg: 'Het quotiënt van de staartdeling geeft de asymptoot, want de rest gedeeld door de noemer gaat naar 0.',
    });
    const sa = rechte(Getal.van(quotient.coef(1)), Getal.van(quotient.coef(0)), 'beide');
    stappen.push({ titel: 'Schuine asymptoot', formules: [sa.mathml], uitleg: 'Dit is het quotiënt van de deling.' });
    lijst.push(sa);
  } else {
    stappen.push({
      titel: 'Vergelijk de graden',
      formules: [graden],
      uitleg: 'De graad van de teller is minstens 2 hoger dan die van de noemer, dus er is geen horizontale of schuine asymptoot.',
    });
  }
  return { stappen, lijst };
}

/** Asymptoten van C·√A + B: alleen bij A van graad 2 met a > 0 en B van graad hoogstens 1. */
export function wortelAsymptoten(C, A, B, { links, rechts }) {
  const stappen = [{
    titel: 'Verticale asymptoten',
    formules: [],
    uitleg: 'Een wortelfunctie van deze vorm wordt nergens oneindig groot in haar domein, dus er zijn geen verticale asymptoten.',
  }];
  const lijst = [];
  if (A.graad === 1) {
    stappen.push({ titel: 'Geen horizontale of schuine asymptoot', formules: [], uitleg: 'De wortel van een eerstegraadsveelterm groeit onbeperkt maar niet zoals een rechte, dus er is geen rechte asymptoot.' });
    return { stappen, lijst };
  }
  if (A.graad !== 2 || B.graad > 1) {
    stappen.push({ titel: 'Geen horizontale of schuine asymptoot', formules: [], uitleg: 'Bij deze wortelfunctie gaat f naar ±∞ zonder een rechte te naderen.' });
    return { stappen, lijst };
  }
  const a = A.coef(2);
  if (a.teken() < 0 || (!links && !rechts)) {
    stappen.push({ titel: 'Geen horizontale of schuine asymptoot', formules: [], uitleg: 'Het domein is begrensd, dus x kan niet naar ±∞ gaan.' });
    return { stappen, lijst };
  }
  const beta = A.coef(1);
  const verschuiving = beta.gedeeldDoor(a.maal(new Breuk(2n)));
  const wortelA = Getal.wortelVan(a);
  const binnen = verschuiving.isNul()
    ? X
    : M.rij(X, M.o(verschuiving.teken() < 0 ? MIN : '+'), breukMathML(verschuiving.absoluut()));
  stappen.push({
    titel: 'Gedrag van de wortel voor grote |x|',
    formules: [M.rij(M.wortel(veeltermMathML(A)), M.o('≈'), getalMathML(wortelA), M.o('·'), M.o('|'), binnen, M.o('|'))],
    uitleg: 'Splits een kwadraat af: de constante die overblijft, wordt verwaarloosbaar als |x| heel groot wordt.',
  });
  const kanten = [];
  if (rechts) kanten.push({ s: 1, kant: 'rechts', titel: 'Voor x → +∞', begin: 'Voor grote positieve x valt de absolute waarde gewoon weg' });
  if (links) kanten.push({ s: -1, kant: 'links', titel: 'Voor x → −∞', begin: 'Voor grote negatieve x keert de absolute waarde het teken om' });
  const rechten = kanten.map(({ s, kant, titel, begin }) => {
    const factor = wortelA.maalBreuk(C.maal(new Breuk(BigInt(s))));
    const m = factor.plus(Getal.van(B.coef(1)));
    const q = factor.maalBreuk(verschuiving).plus(Getal.van(B.coef(0)));
    const r = rechte(m, q, kant);
    const einde = r.soort === 'HA'
      ? 'en verdwijnen de x-termen, dus is er een horizontale asymptoot.'
      : 'en blijft er een rechte over, dus is er een schuine asymptoot.';
    stappen.push({ titel, formules: [r.mathml], uitleg: `${begin} ${einde}` });
    return r;
  });
  if (rechten.length === 2 && Math.abs(rechten[0].m - rechten[1].m) < 1e-12 && Math.abs(rechten[0].q - rechten[1].q) < 1e-12) {
    lijst.push({ ...rechten[0], kant: 'beide' });
  } else {
    lijst.push(...rechten);
  }
  return { stappen, lijst };
}
