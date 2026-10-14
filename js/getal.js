/**
 * Exacte getallen voor de analyse: breuken (met BigInt) en kwadratische
 * wortelgetallen van de vorm a + b·√d, zoals (−1 − √3)/2.
 */

function ggdGeheel(a, b) {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

export function kgvGeheel(a, b) {
  if (a === 0n || b === 0n) return 0n;
  const product = a * b;
  return (product < 0n ? -product : product) / ggdGeheel(a, b);
}

export function absGeheel(a) {
  return a < 0n ? -a : a;
}

export class Breuk {
  constructor(teller, noemer = 1n) {
    let t = BigInt(teller);
    let n = BigInt(noemer);
    if (n === 0n) throw new RangeError('De noemer van een breuk mag niet 0 zijn.');
    if (n < 0n) {
      t = -t;
      n = -n;
    }
    const g = ggdGeheel(t, n);
    this.teller = g > 1n ? t / g : t;
    this.noemer = g > 1n ? n / g : n;
    Object.freeze(this);
  }

  /** Leest een decimaal getal zoals "12", "0.25" of ".5" exact in. */
  static uitTekst(tekst) {
    const m = /^(\d*)(?:\.(\d*))?$/.exec(tekst);
    if (!m || (m[1] === '' && !m[2])) throw new RangeError(`"${tekst}" is geen geldig getal.`);
    const decimalen = m[2] ?? '';
    return new Breuk(BigInt((m[1] || '0') + decimalen), 10n ** BigInt(decimalen.length));
  }

  static geheel(n) {
    return new Breuk(BigInt(n), 1n);
  }

  plus(b) {
    return new Breuk(this.teller * b.noemer + b.teller * this.noemer, this.noemer * b.noemer);
  }

  min(b) {
    return new Breuk(this.teller * b.noemer - b.teller * this.noemer, this.noemer * b.noemer);
  }

  maal(b) {
    return new Breuk(this.teller * b.teller, this.noemer * b.noemer);
  }

  gedeeldDoor(b) {
    if (b.isNul()) throw new RangeError('Delen door 0.');
    return new Breuk(this.teller * b.noemer, this.noemer * b.teller);
  }

  tegengestelde() {
    return new Breuk(-this.teller, this.noemer);
  }

  macht(exponent) {
    const k = BigInt(exponent);
    return new Breuk(this.teller ** k, this.noemer ** k);
  }

  absoluut() {
    return this.teller < 0n ? this.tegengestelde() : this;
  }

  isNul() {
    return this.teller === 0n;
  }

  isGeheel() {
    return this.noemer === 1n;
  }

  /** −1, 0 of 1. */
  teken() {
    if (this.teller > 0n) return 1;
    return this.teller < 0n ? -1 : 0;
  }

  vergelijk(b) {
    const verschil = this.teller * b.noemer - b.teller * this.noemer;
    if (verschil > 0n) return 1;
    return verschil < 0n ? -1 : 0;
  }

  gelijkAan(b) {
    return this.teller === b.teller && this.noemer === b.noemer;
  }

  naarGetal() {
    return Number(this.teller) / Number(this.noemer);
  }
}

export const NUL = new Breuk(0n);
export const EEN = new Breuk(1n);
export const MIN_EEN = new Breuk(-1n);

/** Splitst n > 0 als buiten² · binnen, met binnen kwadraatvrij (12 → 2² · 3). */
export function splitsKwadraat(n) {
  let buiten = 1n;
  let binnen = 1n;
  let rest = n;
  for (let p = 2n; p * p <= rest; p++) {
    while (rest % (p * p) === 0n) {
      rest /= p * p;
      buiten *= p;
    }
    if (rest % p === 0n) {
      rest /= p;
      binnen *= p;
    }
  }
  return { buiten, binnen: binnen * rest };
}

/** Een getal a + b·√d met a, b breuken en d een kwadraatvrij geheel getal. */
export class Getal {
  constructor(rationaal, wortelCoef = NUL, radicand = 1n) {
    if (wortelCoef.isNul() || radicand === 1n) {
      this.a = radicand === 1n ? rationaal.plus(wortelCoef) : rationaal;
      this.b = NUL;
      this.d = 1n;
    } else {
      this.a = rationaal;
      this.b = wortelCoef;
      this.d = radicand;
    }
    Object.freeze(this);
  }

  static van(breuk) {
    return new Getal(breuk);
  }

  /** √(breuk), vereenvoudigd: √12 → 2√3, √(1/2) → √2/2. */
  static wortelVan(breuk) {
    if (breuk.teken() < 0) throw new RangeError('Geen reële wortel van een negatief getal.');
    const { buiten, binnen } = splitsKwadraat(breuk.teller * breuk.noemer);
    return new Getal(NUL, new Breuk(buiten, breuk.noemer), binnen);
  }

  isRationaal() {
    return this.b.isNul();
  }

  plus(g) {
    if (!this.isRationaal() && !g.isRationaal() && this.d !== g.d) {
      throw new RangeError('Wortels met een verschillend getal onder de wortel kan ik niet optellen.');
    }
    const d = this.isRationaal() ? g.d : this.d;
    return new Getal(this.a.plus(g.a), this.b.plus(g.b), d);
  }

  maalBreuk(k) {
    return new Getal(this.a.maal(k), this.b.maal(k), this.d);
  }

  naarGetal() {
    return this.a.naarGetal() + this.b.naarGetal() * Math.sqrt(Number(this.d));
  }

  /** Schrijft het getal als één breuk (t1 + t2·√d) / n met gehele t1, t2 en n > 0. */
  alsEenBreuk() {
    const n = this.isRationaal() ? this.a.noemer : kgvGeheel(this.a.noemer, this.b.noemer);
    return {
      t1: this.a.teller * (n / this.a.noemer),
      t2: this.b.teller * (n / this.b.noemer),
      d: this.d,
      n,
    };
  }
}
