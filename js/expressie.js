/**
 * Een functievoorschrift inlezen: normaliseren, ontleden tot een boom,
 * omzetten naar een rekenfunctie en naar MathML.
 */
import { Breuk } from './getal.js';
import { M, MIN, X, ontsnap } from './opmaak.js';

export class ExpressieFout extends Error {
  constructor(bericht) {
    super(bericht);
    this.name = 'ExpressieFout';
  }
}

const FUNCTIES = ['sqrt', 'root', 'abs', 'sin', 'cos', 'tan', 'ln', 'log', 'exp'];
const CONSTANTEN = ['pi', 'e'];
const NAMEN = [...FUNCTIES, ...CONSTANTEN, 'x'].sort((a, b) => b.length - a.length);
const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** Maakt van wat iemand typt of wat Claude leest een eenduidige schrijfwijze. */
export function normaliseerInvoer(tekst) {
  let s = String(tekst ?? '').trim();
  s = s
    .replace(/^f\s*\(\s*x\s*\)\s*=\s*/i, '')
    .replace(/^f\s*:\s*x\s*(?:↦|\|->|->|→)\s*/i, '')
    .replace(/^y\s*=\s*/i, '');
  s = s
    .replace(/[−–—]/g, '-')
    .replace(/[·×∙⋅]/g, '*')
    .replace(/[÷:]/g, '/')
    .replace(/π/g, 'pi')
    .replace(/[[{]/g, '(')
    .replace(/[\]}]/g, ')')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => `^${[...m].map((c) => SUPERSCRIPT.indexOf(c)).join('')}`)
    .replace(/√\s*\(/g, 'sqrt(')
    .replace(/√\s*(\d+(?:[.,]\d+)?|x)/g, 'sqrt($1)')
    .replace(/(\d),(\d)/g, '$1.$2');
  return s.replace(/\s+/g, ' ').trim();
}

function splitsNamen(woord, tokens) {
  let i = 0;
  while (i < woord.length) {
    const naam = NAMEN.find((n) => woord.startsWith(n, i));
    if (!naam) {
      throw new ExpressieFout(`"${woord[i]}" ken ik niet. Gebruik x als variabele, of een functie zoals sqrt( ).`);
    }
    if (naam === 'x') tokens.push({ soort: 'x' });
    else if (CONSTANTEN.includes(naam)) tokens.push({ soort: 'const', naam });
    else tokens.push({ soort: 'functie', naam });
    i += naam.length;
  }
}

function tokeniseer(s) {
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') {
      i++;
    } else if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const getal = s.slice(i, j);
      if (getal === '.' || (getal.match(/\./g) ?? []).length > 1) {
        throw new ExpressieFout(`"${getal}" is geen geldig getal.`);
      }
      tokens.push({ soort: 'getal', waarde: getal });
      i = j;
    } else if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      splitsNamen(s.slice(i, j).toLowerCase(), tokens);
      i = j;
    } else if ('+-*/^(),'.includes(c)) {
      tokens.push({ soort: c });
      i++;
    } else {
      throw new ExpressieFout(`Het teken "${c}" ken ik niet.`);
    }
  }
  return tokens;
}

const BEGINT_FACTOR = new Set(['getal', 'x', 'const', 'functie', '(']);

/** Ontleedt een functievoorschrift tot een boom van knopen. */
export function ontleed(tekst) {
  const bron = normaliseerInvoer(tekst);
  if (!bron) throw new ExpressieFout('Typ eerst een functie, bijvoorbeeld (x^2 - 1)/(x + 2).');
  const tokens = tokeniseer(bron);
  let pos = 0;
  const kijk = () => tokens[pos];
  const neem = (soort) => {
    const t = tokens[pos];
    if (!t || t.soort !== soort) {
      throw new ExpressieFout(soort === ')' ? 'Er ontbreekt een sluithaakje.' : `Hier verwachtte ik "${soort}".`);
    }
    pos++;
    return t;
  };

  function som() {
    let links = product();
    while (kijk() && (kijk().soort === '+' || kijk().soort === '-')) {
      const op = tokens[pos++].soort;
      links = { soort: op, a: links, b: product() };
    }
    return links;
  }

  function product() {
    let links = teken();
    for (;;) {
      const t = kijk();
      if (t && (t.soort === '*' || t.soort === '/')) {
        pos++;
        links = { soort: t.soort, a: links, b: teken() };
      } else if (t && BEGINT_FACTOR.has(t.soort)) {
        links = { soort: '*', a: links, b: macht() };
      } else {
        return links;
      }
    }
  }

  function teken() {
    const t = kijk();
    if (t && t.soort === '-') {
      pos++;
      return { soort: 'neg', a: teken() };
    }
    if (t && t.soort === '+') {
      pos++;
      return teken();
    }
    return macht();
  }

  function macht() {
    const grondtal = primair();
    if (kijk() && kijk().soort === '^') {
      pos++;
      return { soort: '^', a: grondtal, b: teken() };
    }
    return grondtal;
  }

  function functie(naam) {
    if (!kijk() || kijk().soort !== '(') {
      if (naam === 'root') throw new ExpressieFout('Schrijf een n-de machtswortel als root(getal, n).');
      return { soort: 'functie', naam, args: [macht()] };
    }
    neem('(');
    const args = [som()];
    while (kijk() && kijk().soort === ',') {
      pos++;
      args.push(som());
    }
    neem(')');
    const verwacht = naam === 'root' ? 2 : 1;
    if (args.length !== verwacht) {
      throw new ExpressieFout(naam === 'root' ? 'Schrijf een n-de machtswortel als root(getal, n).' : `${naam}( ) heeft één argument nodig.`);
    }
    return { soort: 'functie', naam, args };
  }

  function primair() {
    const t = kijk();
    if (!t) throw new ExpressieFout('De functie stopt te vroeg: er ontbreekt nog iets op het einde.');
    pos++;
    switch (t.soort) {
      case 'getal':
        return { soort: 'getal', breuk: Breuk.uitTekst(t.waarde), tekst: t.waarde };
      case 'x':
        return { soort: 'x' };
      case 'const':
        return { soort: 'const', naam: t.naam };
      case 'functie':
        return functie(t.naam);
      case '(': {
        const binnen = som();
        neem(')');
        return binnen;
      }
      case ')':
        throw new ExpressieFout('Er staat een sluithaakje te veel of op de verkeerde plaats.');
      default:
        throw new ExpressieFout(`Op deze plaats verwachtte ik een getal, x of een haakje, niet "${t.soort}".`);
    }
  }

  const boom = som();
  if (pos < tokens.length) {
    throw new ExpressieFout(tokens[pos].soort === ')' ? 'Er staat een sluithaakje te veel.' : 'Niet alles kon gelezen worden: controleer de tekens.');
  }
  return boom;
}

/** Kan de pagina dit voorschrift lezen? Een schrijffout geeft false, andere fouten gaan door. */
export function isLeesbaar(tekst) {
  try {
    ontleed(tekst);
    return true;
  } catch (fout) {
    if (fout instanceof ExpressieFout) return false;
    throw fout;
  }
}

/** Exacte waarde van een knoop zonder x (zoals 1/3 of -2), anders null. */
export function constanteBreuk(k) {
  switch (k.soort) {
    case 'getal':
      return k.breuk;
    case 'neg': {
      const a = constanteBreuk(k.a);
      return a && a.tegengestelde();
    }
    case '+':
    case '-':
    case '*':
    case '/': {
      const a = constanteBreuk(k.a);
      const b = constanteBreuk(k.b);
      if (!a || !b) return null;
      if (k.soort === '+') return a.plus(b);
      if (k.soort === '-') return a.min(b);
      if (k.soort === '*') return a.maal(b);
      return b.isNul() ? null : a.gedeeldDoor(b);
    }
    case '^': {
      const a = constanteBreuk(k.a);
      const b = constanteBreuk(k.b);
      if (!a || !b || !b.isGeheel() || b.teller > 20n || b.teller < -20n) return null;
      if (b.teken() < 0) return a.isNul() ? null : new Breuk(1n).gedeeldDoor(a.macht(-b.teller));
      return a.macht(b.teller);
    }
    default:
      return null;
  }
}

function reeleWortel(v, n) {
  if (Number.isInteger(n) && Math.abs(n % 2) === 1) return Math.sign(v) * Math.pow(Math.abs(v), 1 / n);
  return v < 0 ? Number.NaN : Math.pow(v, 1 / n);
}

const REKENFUNCTIES = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
};

/** Zet de boom om naar een snelle functie x → f(x) met reële rekenregels (NaN buiten het domein). */
export function compileer(k) {
  switch (k.soort) {
    case 'getal': {
      const w = k.breuk.naarGetal();
      return () => w;
    }
    case 'x':
      return (x) => x;
    case 'const': {
      const w = k.naam === 'pi' ? Math.PI : Math.E;
      return () => w;
    }
    case 'neg': {
      const a = compileer(k.a);
      return (x) => -a(x);
    }
    case '+': {
      const a = compileer(k.a);
      const b = compileer(k.b);
      return (x) => a(x) + b(x);
    }
    case '-': {
      const a = compileer(k.a);
      const b = compileer(k.b);
      return (x) => a(x) - b(x);
    }
    case '*': {
      const a = compileer(k.a);
      const b = compileer(k.b);
      return (x) => a(x) * b(x);
    }
    case '/': {
      const a = compileer(k.a);
      const b = compileer(k.b);
      return (x) => a(x) / b(x);
    }
    case '^': {
      const a = compileer(k.a);
      const exponent = constanteBreuk(k.b);
      if (exponent && !exponent.isGeheel() && exponent.noemer % 2n === 1n) {
        const p = Number(exponent.teller);
        const q = Number(exponent.noemer);
        return (x) => Math.pow(reeleWortel(a(x), q), p);
      }
      const b = compileer(k.b);
      return (x) => Math.pow(a(x), b(x));
    }
    case 'functie': {
      const args = k.args.map(compileer);
      if (k.naam === 'root') return (x) => reeleWortel(args[0](x), args[1](x));
      const fn = REKENFUNCTIES[k.naam];
      return (x) => fn(args[0](x));
    }
    default:
      throw new ExpressieFout(`Onbekende knoop ${k.soort}.`);
  }
}

const PRIORITEIT = { '+': 1, '-': 1, neg: 2, '*': 3, '^': 4, '/': 5 };

function prioriteit(k) {
  return PRIORITEIT[k.soort] ?? 6;
}

function begintMetGetal(k) {
  if (k.soort === 'getal') return true;
  if (k.soort === '*' || k.soort === '^') return begintMetGetal(k.a);
  return false;
}

function begintMetMin(k) {
  return k.soort === 'neg' || (k.soort === '*' && begintMetMin(k.a));
}

/** Rechterlid van een bewerking: haakjes rond een minteken, zodat er nooit "+ −" staat. */
function rechterOperand(k, minimum) {
  return begintMetMin(k) ? M.haakjes(mathmlKnoop(k)) : naarMathML(k, minimum);
}

/** MathML van de boom, met haakjes alleen waar ze nodig zijn. */
export function naarMathML(k, minimum = 0) {
  const binnen = mathmlKnoop(k);
  return prioriteit(k) < minimum ? M.haakjes(binnen) : binnen;
}

function mathmlKnoop(k) {
  switch (k.soort) {
    case 'getal':
      return M.n(k.tekst.replace('.', ','));
    case 'x':
      return X;
    case 'const':
      return M.i(k.naam === 'pi' ? 'π' : 'e');
    case 'neg':
      return M.rij(M.o(MIN), naarMathML(k.a, 3));
    case '+':
      return M.rij(naarMathML(k.a, 1), M.o('+'), rechterOperand(k.b, 1));
    case '-':
      return M.rij(naarMathML(k.a, 1), M.o(MIN), rechterOperand(k.b, 2));
    case '*': {
      const punt = begintMetGetal(k.b) ? M.o('·') : '';
      return M.rij(naarMathML(k.a, 2), punt, rechterOperand(k.b, 3.5));
    }
    case '/':
      return M.breuk(naarMathML(k.a), naarMathML(k.b));
    case '^':
      return M.macht(naarMathML(k.a, 5.5), naarMathML(k.b));
    case 'functie': {
      if (k.naam === 'sqrt') return M.wortel(naarMathML(k.args[0]));
      if (k.naam === 'root') return M.nwortel(naarMathML(k.args[0]), naarMathML(k.args[1]));
      if (k.naam === 'abs') return M.rij(M.o('|'), naarMathML(k.args[0]), M.o('|'));
      return M.rij(M.i(k.naam), M.haakjes(naarMathML(k.args[0])));
    }
    default:
      return M.tekst(ontsnap(k.soort));
  }
}
