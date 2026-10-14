/**
 * De volledige analyse van een functie: domein, nulpunten met stappen, tekentabel,
 * besluit en asymptoten. Veelterm-, rationale en wortelfuncties worden exact berekend,
 * andere functies numeriek.
 */
import { Breuk, EEN, MIN_EEN } from './getal.js';
import { M, X, FX, REEEL, breukMathML, breukTekst, decimaal, getalMathML, getalTekst } from './opmaak.js';
import { compileer, naarMathML } from './expressie.js';
import { naarRationaal, naarWortelvorm, alsVeelterm } from './symbolisch.js';
import { Veelterm, veeltermMathML, veeltermTekst, factorMathML, factorTekst } from './veelterm.js';
import { ontbind, nulpuntenVan } from './factoren.js';
import {
  TEKEN,
  ordenPunten,
  veeltermTekens,
  functieTekens,
  productTekens,
  intervallen,
  verzamelingMathML,
  reeelZonderMathML,
  besluitUitTabel,
  begrens,
  puntMathML,
  puntenVerzamelingMathML,
} from './tabel.js';
import { veeltermAsymptoten, rationaleAsymptoten, wortelAsymptoten } from './asymptoten.js';
import { zoekBijzonderePunten } from './numeriek.js';

const NUL_MML = M.n('0');
const NUMERIEK_BEREIK = 10;
const MAX_PUNTEN_NUMERIEK = 14;
const ZIN_PRODUCT = 'Het teken van f(x) volgt uit het aantal mintekens in elke kolom: een even aantal geeft +, een oneven aantal −.';

function domeinMathML(verzameling) {
  return M.rij(M.tekst('dom '), M.i('f'), M.o('='), verzameling);
}

function gelijkNul(links) {
  return M.rij(links, M.o('='), NUL_MML);
}

/** Punten van de tabel met hun opmaak: exact (getal) of benaderd. */
function metOpmaak(punten) {
  return punten.map((p) => ({
    ...p,
    mathml: p.getal ? getalMathML(p.getal) : M.rij(M.o('≈'), M.n(decimaal(p.waarde))),
    tekst: p.getal ? getalTekst(p.getal) : `≈ ${decimaal(p.waarde)}`,
    benaderd: !p.getal,
  }));
}

function besluitNulpunten(nulpunten) {
  if (nulpunten.length === 0) return M.tekst('f heeft geen nulpunten.');
  if (nulpunten.length === 1) return M.rij(M.tekst('Het nulpunt is '), X, M.o('='), puntMathML(nulpunten[0]));
  return M.rij(M.tekst('De nulpunten zijn '), X, M.o('∈'), puntenVerzamelingMathML(nulpunten));
}

function discriminant(q) {
  const b = q.coef(1);
  return b.maal(b).min(new Breuk(4n).maal(q.coef(2)).maal(q.coef(0)));
}

function constanteRij(c, herkomst, punten) {
  const teken = c.isNul() ? TEKEN.NUL : c.teken() < 0 ? TEKEN.MIN : TEKEN.PLUS;
  return { mathml: breukMathML(c), tekst: breukTekst(c), herkomst, tekens: Array(2 * punten.length + 1).fill(teken) };
}

function factorRijen(ontbinding, herkomst, punten) {
  const rijen = ontbinding.factoren.map((f) => ({
    mathml: f.macht > 1 ? factorMathML(f.veelterm, f.macht) : veeltermMathML(f.veelterm),
    tekst: f.macht > 1 ? factorTekst(f.veelterm, f.macht) : veeltermTekst(f.veelterm),
    herkomst,
    veelterm: f.veelterm,
    macht: f.macht,
    D: f.veelterm.graad === 2 ? discriminant(f.veelterm) : null,
    tekens: veeltermTekens(f.veelterm, f.macht, punten),
  }));
  if (ontbinding.constante.teken() <= 0) rijen.unshift(constanteRij(ontbinding.constante, herkomst, punten));
  return rijen;
}

/** Eén rij voor een veelterm van graad 1 of 2, anders een rij per factor. */
function rijenVoor(p, herkomst, punten) {
  if (p.graad > 2) return factorRijen(ontbind(p), herkomst, punten);
  return [{
    mathml: veeltermMathML(p),
    tekst: veeltermTekst(p),
    herkomst,
    veelterm: p,
    macht: 1,
    D: p.graad === 2 ? discriminant(p) : null,
    tekens: veeltermTekens(p, 1, punten),
  }];
}

function uitlegBijRijen(rijen) {
  const zinnen = [];
  for (const r of rijen) {
    if (r.D && r.macht === 1) {
      const a = r.veelterm.kop().teken() > 0 ? '+' : '−';
      const omgekeerd = a === '+' ? '−' : '+';
      if (r.D.teken() < 0) zinnen.push(`${r.tekst} heeft geen nulpunten en heeft dus overal het teken van a: ${a}.`);
      else if (r.D.isNul()) zinnen.push(`${r.tekst} heeft een dubbel nulpunt en heeft verder overal het teken van a: ${a}.`);
      else zinnen.push(`${r.tekst} heeft het teken van a (${a}) buiten de nulpunten en ${omgekeerd} ertussen.`);
    } else if (r.macht && r.macht % 2 === 0) {
      zinnen.push(`${r.tekst} is een even macht en dus nooit negatief.`);
    }
  }
  return zinnen;
}

export function analyseer(boom) {
  const f = compileer(boom);
  const voorschrift = naarMathML(boom);
  const basis = { f, voorschrift, functie: M.rij(FX, M.o('='), voorschrift), opmerkingen: [] };
  const rationaal = naarRationaal(boom);
  if (rationaal) {
    let { teller, noemer } = rationaal;
    if (noemer.isConstant()) {
      teller = teller.maalBreuk(EEN.gedeeldDoor(noemer.kop()));
      noemer = Veelterm.constante(EEN);
    }
    const voorwaarden = rationaal.voorwaarden.filter((v) => !v.isConstant());
    if (noemer.isConstant() && voorwaarden.length === 0) return analyseerVeelterm(basis, teller);
    return analyseerRationaal(basis, boom, teller, noemer, voorwaarden);
  }
  const wortel = naarWortelvorm(boom);
  if (wortel) return analyseerWortel(basis, wortel);
  return analyseerNumeriek(basis);
}

function analyseerVeelterm(basis, P) {
  const ontbinding = ontbind(P);
  const stappen = [];
  if (P.isConstant()) {
    stappen.push({
      titel: 'Constante functie',
      formules: [M.rij(FX, M.o('='), veeltermMathML(P))],
      uitleg: P.isNul() ? 'f(x) is overal 0, dus elke x is een nulpunt.' : 'Een constante functie die niet 0 is, heeft geen nulpunten.',
    });
  } else {
    stappen.push({ titel: 'Stel f(x) gelijk aan 0', formules: [gelijkNul(veeltermMathML(P))], uitleg: 'Een nulpunt is een x-waarde waarvoor de functiewaarde 0 is.' });
    stappen.push(...ontbinding.stappen);
  }
  const punten = ordenPunten(nulpuntenVan(ontbinding));
  const rijen = factorRijen(ontbinding, '', punten);
  const fTekens = productTekens(rijen, 2 * punten.length + 1);
  const uitleg = uitlegBijRijen(rijen);
  if (rijen.length > 1) uitleg.push(ZIN_PRODUCT);
  return {
    ...basis,
    soort: 'veelterm',
    domein: { mathml: domeinMathML(REEEL), uitleg: 'Een veeltermfunctie bestaat voor elke x.' },
    nulpunten: { stappen, besluit: besluitNulpunten(punten) },
    tabel: { punten: metOpmaak(punten), rijen, f: fTekens, uitleg },
    besluit: besluitUitTabel(fTekens, punten),
    asymptoten: veeltermAsymptoten(P),
  };
}

function analyseerRationaal(basis, boom, P, Q, voorwaarden) {
  const stappen = [];
  stappen.push({ titel: 'Stel f(x) gelijk aan 0', formules: [gelijkNul(basis.voorschrift)], uitleg: 'Een breuk is 0 als de teller 0 is en de noemer niet.' });
  const isEenBreuk = boom.soort === '/' && alsVeelterm(boom.a) && alsVeelterm(boom.b);
  if (!isEenBreuk) {
    stappen.push({
      titel: 'Zet alles op één breuk',
      formules: [M.rij(FX, M.o('='), M.breuk(veeltermMathML(P), veeltermMathML(Q)))],
      uitleg: 'Breng alle termen op gelijke noemer, zodat f(x) één breuk wordt.',
    });
  }

  const ontbindingQ = ontbind(Q, 'Noemer: ');
  const monisch = (v) => v.maalBreuk(EEN.gedeeldDoor(v.kop()));
  const andere = voorwaarden.filter((v) => !monisch(v).gelijkAan(monisch(Q)));
  const uitgesloten = ordenPunten([
    ...nulpuntenVan(ontbindingQ),
    ...andere.flatMap((v) => nulpuntenVan(ontbind(v))),
  ]);
  const isUitgesloten = (p) => uitgesloten.some((u) => Math.abs(u.waarde - p.waarde) <= 1e-9 * Math.max(1, Math.abs(p.waarde)));
  stappen.push({
    titel: 'Bestaansvoorwaarde (BV)',
    formules: [Q, ...andere].filter((v) => !v.isConstant()).map((v) => M.rij(veeltermMathML(v), M.o('≠'), NUL_MML)),
    uitleg: 'De noemer mag niet 0 zijn, dus zoek eerst de nulpunten van de noemer.',
  });
  stappen.push(...ontbindingQ.stappen);
  stappen.push({
    titel: 'Domein',
    formules: [domeinMathML(reeelZonderMathML(uitgesloten))],
    uitleg: uitgesloten.length ? 'Laat de nulpunten van de noemer weg uit ℝ.' : 'De noemer wordt nooit 0, dus elke x mag.',
  });

  const ontbindingP = ontbind(P, 'Teller: ');
  if (!P.isConstant()) {
    stappen.push({ titel: 'Stel de teller gelijk aan 0', formules: [gelijkNul(veeltermMathML(P))], uitleg: 'Zoek nu de nulpunten van de teller.' });
    stappen.push(...ontbindingP.stappen);
  }
  const kandidaten = ordenPunten(nulpuntenVan(ontbindingP));
  const nulpunten = kandidaten.filter((p) => !isUitgesloten(p));
  if (kandidaten.length) {
    stappen.push({
      titel: 'Toets aan de BV',
      formules: kandidaten.map((p) => M.rij(X, M.o('='), puntMathML(p), M.tekst(isUitgesloten(p) ? ': voldoet niet aan de BV' : ': voldoet'))),
      uitleg: kandidaten.some(isUitgesloten)
        ? 'Een nulpunt van de teller dat ook de noemer 0 maakt, is geen nulpunt van f.'
        : 'Geen enkel nulpunt van de teller maakt de noemer 0.',
    });
  }

  const punten = ordenPunten([...kandidaten, ...uitgesloten]);
  const rijen = [...factorRijen(ontbindingP, 'teller', punten), ...factorRijen(ontbindingQ, 'noemer', punten)];
  const uitgeslotenKolommen = new Set(punten.flatMap((p, i) => (isUitgesloten(p) ? [2 * i + 1] : [])));
  const fTekens = productTekens(rijen, 2 * punten.length + 1, uitgeslotenKolommen);
  const uitleg = uitlegBijRijen(rijen);
  if (uitgesloten.length) uitleg.push('Waar de noemer 0 is, bestaat f niet: daar staat ‖.');
  if (rijen.length > 1) uitleg.push(ZIN_PRODUCT);
  return {
    ...basis,
    soort: 'rationaal',
    domein: { mathml: domeinMathML(reeelZonderMathML(uitgesloten)), uitleg: 'De noemer mag niet 0 zijn.' },
    nulpunten: { stappen, besluit: besluitNulpunten(nulpunten) },
    tabel: { punten: metOpmaak(punten), rijen, f: fTekens, uitleg },
    besluit: besluitUitTabel(fTekens, punten),
    asymptoten: rationaleAsymptoten(P, Q, ordenPunten(nulpuntenVan(ontbindingQ))),
  };
}

/** a·x + b ≥ 0 ⇔ x ≥ r (of x ≤ r als a negatief is). */
function eersteGraadsOplossing(p) {
  const r = p.coef(0).tegengestelde().gedeeldDoor(p.coef(1));
  return M.rij(veeltermMathML(p), M.o('≥'), NUL_MML, M.o('⇔'), X, M.o(p.coef(1).teken() > 0 ? '≥' : '≤'), breukMathML(r));
}

/** De oplossing van p(x) ≥ 0 als formule. */
function nietNegatiefFormules(p) {
  const basisFormule = M.rij(veeltermMathML(p), M.o('≥'), NUL_MML);
  if (p.isConstant()) return [basisFormule];
  if (p.graad === 1) return [eersteGraadsOplossing(p)];
  const punten = ordenPunten(nulpuntenVan(ontbind(p)));
  const groepen = intervallen(veeltermTekens(p, 1, punten), punten, (t) => t !== TEKEN.MIN);
  return [M.rij(basisFormule, M.o('⇔'), X, M.o('∈'), verzamelingMathML(groepen))];
}

function maalTeken(t, s) {
  if (t !== TEKEN.PLUS && t !== TEKEN.MIN) return t;
  if (s > 0) return t;
  return t === TEKEN.PLUS ? TEKEN.MIN : TEKEN.PLUS;
}

function analyseerWortel(basis, { C, A, B }) {
  const stappen = [];
  const metB = !B.isNul();
  const R = B.maalBreuk(MIN_EEN.gedeeldDoor(C));
  const S = A.min(R.maal(R));
  const sC = C.teken();

  stappen.push({ titel: 'Stel f(x) gelijk aan 0', formules: [gelijkNul(basis.voorschrift)], uitleg: 'Een nulpunt is een x-waarde waarvoor de functiewaarde 0 is.' });

  const ontbindingA = ontbind(A, 'Onder de wortel: ');
  const puntenA = ordenPunten(nulpuntenVan(ontbindingA));
  const domeinGroepen = intervallen(veeltermTekens(A, 1, puntenA), puntenA, (t) => t !== TEKEN.MIN);
  stappen.push({
    titel: 'Bestaansvoorwaarde (BV)',
    formules: A.graad === 1 ? [eersteGraadsOplossing(A)] : [M.rij(veeltermMathML(A), M.o('≥'), NUL_MML)],
    uitleg: 'Onder een vierkantswortel mag geen negatief getal staan.',
  });
  if (A.graad > 1) stappen.push(...ontbindingA.stappen);
  const domein = verzamelingMathML(domeinGroepen);
  stappen.push({ titel: 'Domein', formules: [domeinMathML(domein)], uitleg: `Het domein bevat alle x waarvoor ${veeltermTekst(A)} niet negatief is.` });

  let nulpunten = [];
  const afgewezen = [];
  let ontbindingS = null;
  const kanR0 = !R.isConstant() || R.kop().teken() >= 0;
  if (!metB) {
    stappen.push({
      titel: 'Los op',
      formules: [M.rij(M.wortel(veeltermMathML(A)), M.o('='), NUL_MML, M.o('⇔'), veeltermMathML(A), M.o('='), NUL_MML)],
      uitleg: 'Een wortel is alleen 0 als wat eronder staat 0 is.',
    });
    nulpunten = puntenA;
  } else {
    stappen.push({
      titel: 'Zet de wortel alleen',
      formules: [M.rij(M.wortel(veeltermMathML(A)), M.o('='), veeltermMathML(R))],
      uitleg: C.gelijkAan(EEN)
        ? 'Breng de termen zonder wortel naar het rechterlid.'
        : `Breng de termen zonder wortel naar het rechterlid en deel door ${breukTekst(C)}.`,
    });
    if (!kanR0) {
      stappen.push({
        titel: 'Kwadrateringsvoorwaarde (KV)',
        formules: [M.rij(veeltermMathML(R), M.o('≥'), NUL_MML)],
        uitleg: 'Het rechterlid is negatief en een wortel nooit, dus f heeft geen nulpunten.',
      });
    } else {
      stappen.push({
        titel: 'Kwadrateringsvoorwaarde (KV)',
        formules: nietNegatiefFormules(R),
        uitleg: 'Een wortel is nooit negatief, dus mag je alleen kwadrateren als ook het rechterlid niet negatief is.',
      });
      stappen.push({ titel: 'Kwadrateer beide leden', formules: [M.rij(veeltermMathML(A), M.o('='), factorMathML(R, 2))], uitleg: 'Door te kwadrateren verdwijnt de wortel.' });
      if (R.aantalTermen() > 1) {
        stappen.push({
          titel: 'Werk het kwadraat uit',
          formules: [M.rij(veeltermMathML(A), M.o('='), veeltermMathML(R.maal(R)))],
          uitleg: R.aantalTermen() === 2 ? 'Gebruik het merkwaardig product (a + b)² = a² + 2ab + b².' : 'Werk het kwadraat uit.',
        });
      }
      const T = S.kop().teken() < 0 ? S.tegengestelde() : S;
      stappen.push({
        titel: 'Breng alles naar één kant',
        formules: [gelijkNul(veeltermMathML(T))],
        uitleg: T.isNul()
          ? 'Elke x die aan de BV en de KV voldoet, is een oplossing.'
          : T.isConstant()
            ? 'Deze vergelijking klopt nooit, dus f heeft geen nulpunten.'
            : 'Zo krijg je een vergelijking met 0 in het rechterlid.',
      });
      if (!T.isConstant()) {
        ontbindingS = ontbind(T);
        stappen.push(...ontbindingS.stappen);
        const kandidaten = ordenPunten(nulpuntenVan(ontbindingS));
        for (const p of kandidaten) {
          const bv = A.waardeIn(p.waarde) >= -1e-9 * Math.max(1, A.schaalIn(p.waarde));
          const kv = R.waardeIn(p.waarde) >= -1e-9 * Math.max(1, R.schaalIn(p.waarde));
          if (bv && kv) nulpunten.push(p);
          else afgewezen.push({ punt: p, reden: bv ? 'KV' : 'BV' });
        }
        if (kandidaten.length) {
          const reden = (p) => afgewezen.find((a) => a.punt === p)?.reden;
          stappen.push({
            titel: 'Toets aan de BV en de KV',
            formules: kandidaten.map((p) => M.rij(X, M.o('='), puntMathML(p), M.tekst(reden(p) ? `: voldoet niet aan de ${reden(p)}` : ': voldoet'))),
            uitleg: afgewezen.some((a) => a.reden === 'KV')
              ? 'Een oplossing die niet aan de KV voldoet, is een valse oplossing die door het kwadrateren is ontstaan.'
              : afgewezen.length
                ? 'Een oplossing die niet aan de BV voldoet, ligt buiten het domein.'
                : 'Alle oplossingen voldoen aan de BV en de KV.',
          });
        }
      }
    }
  }

  const toonR = metB && !R.isConstant();
  const toonS = metB && kanR0 && !S.isConstant();
  const punten = ordenPunten([
    ...puntenA,
    ...(toonR ? nulpuntenVan(ontbind(R)) : []),
    ...(toonS ? nulpuntenVan(ontbindingS ?? ontbind(S)) : []),
  ]);
  const tA = veeltermTekens(A, 1, punten);
  const tR = veeltermTekens(R, 1, punten);
  const tS = veeltermTekens(S, 1, punten);
  const fTekens = tA.map((a, k) => {
    if (a === TEKEN.MIN) return TEKEN.BUITEN;
    if (!metB) return a === TEKEN.NUL ? TEKEN.NUL : maalTeken(TEKEN.PLUS, sC);
    if (a === TEKEN.NUL) return maalTeken(tR[k], -sC);
    if (tR[k] === TEKEN.MIN) return maalTeken(TEKEN.PLUS, sC);
    return maalTeken(tS[k], sC);
  });

  const rijen = [...rijenVoor(A, 'onder de wortel', punten)];
  if (toonR) rijen.push(...rijenVoor(R, 'buiten de wortel', punten));
  if (toonS) rijen.push(...rijenVoor(S, 'na kwadrateren', punten));

  const uitleg = [];
  const positief = sC > 0 ? 'positief' : 'negatief';
  if (tA.includes(TEKEN.MIN)) uitleg.push(`Waar ${veeltermTekst(A)} < 0, bestaat f niet: daar staat ∄.`);
  if (!metB) {
    uitleg.push(`Waar de wortel bestaat, is f(x) ${positief}, behalve waar ${veeltermTekst(A)} = 0.`);
  } else {
    if (toonR) uitleg.push(`Waar ${veeltermTekst(R)} < 0, is f(x) zeker ${positief}, want een wortel is nooit negatief.`);
    if (kanR0) {
      const waar = toonR ? `Waar ${veeltermTekst(R)} ≥ 0` : 'Overal in het domein';
      uitleg.push(`${waar} heeft f(x) ${sC > 0 ? 'hetzelfde teken als' : 'het omgekeerde teken van'} ${veeltermTekst(S)}.`);
    }
    for (const a of afgewezen.filter((x) => x.reden === 'KV')) {
      uitleg.push(`Het nulpunt ${a.punt.getal ? getalTekst(a.punt.getal) : decimaal(a.punt.waarde)} van ${veeltermTekst(S)} telt niet mee, want daar is ${veeltermTekst(R)} < 0.`);
    }
  }

  return {
    ...basis,
    soort: 'wortel',
    domein: { mathml: domeinMathML(domein), uitleg: 'Onder de wortel mag geen negatief getal staan.' },
    nulpunten: { stappen, besluit: besluitNulpunten(nulpunten) },
    tabel: { punten: metOpmaak(punten), rijen, f: fTekens, uitleg },
    besluit: besluitUitTabel(fTekens, punten),
    asymptoten: wortelAsymptoten(C, A, B, { links: tA[0] !== TEKEN.MIN, rechts: tA[tA.length - 1] !== TEKEN.MIN }),
  };
}

function analyseerNumeriek(basis) {
  const { f } = basis;
  const scan = zoekBijzonderePunten(f, -NUMERIEK_BEREIK, NUMERIEK_BEREIK);
  const opmerking = 'Deze functie is geen veelterm, breuk van veeltermen of wortelfunctie van de vorm a·√(…) + …. '
    + 'Daarom rekent de pagina met benaderde waarden tussen −10 en 10, zonder stappen.';
  const geenAsymptoten = {
    stappen: [{ titel: 'Asymptoten', formules: [], uitleg: 'Voor dit soort functie berekent de pagina geen asymptoten.' }],
    lijst: [],
  };
  const alle = [...scan.nulpunten, ...scan.polen, ...scan.randen];
  const basisResultaat = { ...basis, soort: 'numeriek', opmerkingen: [opmerking], asymptoten: geenAsymptoten };
  if (alle.length > MAX_PUNTEN_NUMERIEK) {
    return {
      ...basisResultaat,
      domein: null,
      nulpunten: { stappen: [], besluit: M.tekst(`f heeft minstens ${scan.nulpunten.length} nulpunten tussen −10 en 10.`) },
      tabel: null,
      besluit: [],
      opmerkingen: [opmerking, 'Er zijn te veel nulpunten om een overzichtelijke tekentabel te maken.'],
    };
  }
  const punten = ordenPunten(alle.map((waarde) => ({ waarde, getal: null })));
  const isPool = (p) => scan.polen.some((x) => Math.abs(x - p.waarde) < 1e-7);
  const fTekens = functieTekens(f, punten).map((t, k) => (k % 2 === 1 && isPool(punten[(k - 1) / 2]) ? TEKEN.NIET : t));
  const nulpunten = punten.filter((p, i) => fTekens[2 * i + 1] === TEKEN.NUL);
  const domeinGroepen = begrens(intervallen(fTekens, punten, (t) => t !== TEKEN.BUITEN && t !== TEKEN.NIET), NUMERIEK_BEREIK);
  return {
    ...basisResultaat,
    domein: { mathml: domeinMathML(verzamelingMathML(domeinGroepen)), uitleg: 'Benaderd, tussen −10 en 10.' },
    nulpunten: { stappen: [], besluit: besluitNulpunten(nulpunten) },
    tabel: {
      punten: metOpmaak(punten),
      rijen: [],
      f: fTekens,
      uitleg: ['De punten zijn benaderd en het teken in elk interval is bepaald door f in een getal uit dat interval in te vullen.'],
    },
    besluit: besluitUitTabel(fTekens, punten, NUMERIEK_BEREIK),
  };
}
