/**
 * De grafiek als SVG: neutraal van kleur, met verschuiven (slepen), zoomen
 * (knijpen, scrollwiel of knoppen) en aflezen (tikken of muis).
 */
import { bouwPaden, domeinGaten, kiesVenster, mooieStap } from './numeriek.js';
import { decimaal, ontsnap } from './opmaak.js';

const KLEUR = Object.freeze({
  raster: '#e7e9ec',
  as: '#3b4048',
  tekst: '#5b626b',
  curve: '#1c64c8',
  asymptoot: '#d9480f',
  domein: '#f2f3f5',
  kruis: '#9aa1aa',
});
const MARGE = Object.freeze({ links: 46, rechts: 12, boven: 12, onder: 28 });
const MIN_HOOGTE = 280;
const MAX_HOOGTE = 560;
const TIK_AFSTAND = 6;
const ZOOMSTAP = 1.6;

export class Grafiek {
  constructor(houder, aflezing) {
    this.houder = houder;
    this.aflezing = aflezing;
    this.f = null;
    this.venster = null;
    this.beginVenster = null;
    this.asymptoten = [];
    this.markeringen = [];
    this.midden = 0;
    this.kruisX = null;
    this.wijzers = new Map();
    this.knijp = null;
    this.breedte = 0;
    this.hoogte = 0;
    new ResizeObserver(() => {
      if (Math.max(houder.clientWidth, 200) !== this.breedte) this.teken();
    }).observe(houder);
    this.koppelInvoer();
  }

  /** Toont een nieuwe functie met haar asymptoten en gemarkeerde punten. */
  toon({ f, asymptoten = [], markeringen = [], belangrijkeX = [] }) {
    this.f = f;
    this.asymptoten = asymptoten;
    this.markeringen = markeringen;
    this.midden = belangrijkeX.length ? (Math.min(...belangrijkeX) + Math.max(...belangrijkeX)) / 2 : 0;
    this.beginVenster = kiesVenster(f, [...belangrijkeX, ...asymptoten.filter((a) => a.soort === 'VA').map((a) => a.x)]);
    this.venster = { ...this.beginVenster };
    this.kruisX = null;
    this.toonAflezing();
    this.teken();
  }

  terug() {
    if (!this.beginVenster) return;
    this.venster = { ...this.beginVenster };
    this.teken();
  }

  /** Zoomt rond een punt (in data-coördinaten); factor > 1 zoomt uit. */
  zoom(factor, cx, cy) {
    if (!this.venster) return;
    const v = this.venster;
    const mx = cx ?? (v.x0 + v.x1) / 2;
    const my = cy ?? (v.y0 + v.y1) / 2;
    const nieuweBreedte = (v.x1 - v.x0) * factor;
    if (nieuweBreedte < 1e-6 || nieuweBreedte > 1e6) return;
    this.venster = {
      x0: mx - (mx - v.x0) * factor,
      x1: mx + (v.x1 - mx) * factor,
      y0: my - (my - v.y0) * factor,
      y1: my + (v.y1 - my) * factor,
    };
    this.teken();
  }

  naarPixelX(x) {
    const v = this.venster;
    return MARGE.links + ((x - v.x0) / (v.x1 - v.x0)) * (this.breedte - MARGE.links - MARGE.rechts);
  }

  naarPixelY(y) {
    const v = this.venster;
    return MARGE.boven + ((v.y1 - y) / (v.y1 - v.y0)) * (this.hoogte - MARGE.boven - MARGE.onder);
  }

  naarDataX(px) {
    const v = this.venster;
    return v.x0 + ((px - MARGE.links) / (this.breedte - MARGE.links - MARGE.rechts)) * (v.x1 - v.x0);
  }

  naarDataY(py) {
    const v = this.venster;
    return v.y1 - ((py - MARGE.boven) / (this.hoogte - MARGE.boven - MARGE.onder)) * (v.y1 - v.y0);
  }

  teken() {
    this.breedte = Math.max(this.houder.clientWidth, 200);
    this.hoogte = Math.round(Math.min(MAX_HOOGTE, Math.max(MIN_HOOGTE, this.breedte * 0.62)));
    if (!this.f || !this.venster) {
      this.houder.innerHTML = '';
      return;
    }
    const v = this.venster;
    const W = this.breedte;
    const H = this.hoogte;
    const px = (x) => this.naarPixelX(x).toFixed(1);
    const py = (y) => this.naarPixelY(y).toFixed(1);
    const delen = [];
    const binnenL = MARGE.links;
    const binnenR = W - MARGE.rechts;
    const binnenB = MARGE.boven;
    const binnenO = H - MARGE.onder;

    delen.push(`<defs><clipPath id="grafiek-clip"><rect x="${binnenL}" y="${binnenB}" width="${binnenR - binnenL}" height="${binnenO - binnenB}"/></clipPath></defs>`);
    delen.push(`<rect width="${W}" height="${H}" fill="#fff"/>`);

    const gaten = domeinGaten(this.f, v);
    for (const [a, b] of gaten) {
      delen.push(`<rect x="${px(a)}" y="${binnenB}" width="${(this.naarPixelX(b) - this.naarPixelX(a)).toFixed(1)}" height="${binnenO - binnenB}" fill="${KLEUR.domein}"/>`);
    }

    const stapX = mooieStap(v.x1 - v.x0, Math.max(4, W / 90));
    const stapY = mooieStap(v.y1 - v.y0, Math.max(4, H / 55));
    const labels = [];
    for (let x = Math.ceil(v.x0 / stapX) * stapX; x <= v.x1; x += stapX) {
      const xx = px(x);
      delen.push(`<line x1="${xx}" x2="${xx}" y1="${binnenB}" y2="${binnenO}" stroke="${KLEUR.raster}"/>`);
      labels.push(`<text x="${xx}" y="${H - 9}" text-anchor="middle">${ontsnap(decimaal(Math.abs(x) < stapX / 1e6 ? 0 : x))}</text>`);
    }
    for (let y = Math.ceil(v.y0 / stapY) * stapY; y <= v.y1; y += stapY) {
      const yy = py(y);
      delen.push(`<line x1="${binnenL}" x2="${binnenR}" y1="${yy}" y2="${yy}" stroke="${KLEUR.raster}"/>`);
      labels.push(`<text x="${binnenL - 6}" y="${(Number(yy) + 4).toFixed(1)}" text-anchor="end">${ontsnap(decimaal(Math.abs(y) < stapY / 1e6 ? 0 : y))}</text>`);
    }
    if (v.y0 <= 0 && v.y1 >= 0) delen.push(`<line x1="${binnenL}" x2="${binnenR}" y1="${py(0)}" y2="${py(0)}" stroke="${KLEUR.as}" stroke-width="1.5"/>`);
    if (v.x0 <= 0 && v.x1 >= 0) delen.push(`<line x1="${px(0)}" x2="${px(0)}" y1="${binnenB}" y2="${binnenO}" stroke="${KLEUR.as}" stroke-width="1.5"/>`);

    const binnen = [];
    for (const a of this.asymptoten) binnen.push(this.asymptootSVG(a));
    for (const pad of bouwPaden(this.f, v, Math.round(W * 2))) {
      const d = pad.map(([x, y], i) => `${i ? 'L' : 'M'}${px(x)} ${py(y)}`).join('');
      binnen.push(`<path d="${d}" fill="none" stroke="${KLEUR.curve}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`);
    }
    binnen.push(...this.markeringenSVG());
    if (this.kruisX !== null) binnen.push(this.kruisSVG());
    delen.push(`<g clip-path="url(#grafiek-clip)">${binnen.join('')}</g>`);
    delen.push(`<g fill="${KLEUR.tekst}" font-size="12" font-family="system-ui, -apple-system, Segoe UI, sans-serif">${labels.join('')}</g>`);

    this.houder.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafiek van de functie">${delen.join('')}</svg>`;
  }

  asymptootSVG(a) {
    const v = this.venster;
    const stijl = `stroke="${KLEUR.asymptoot}" stroke-width="1.5" stroke-dasharray="7 5"`;
    if (a.soort === 'VA') {
      const x = this.naarPixelX(a.x).toFixed(1);
      return `<line x1="${x}" x2="${x}" y1="0" y2="${this.hoogte}" ${stijl}/>`;
    }
    let van = v.x0;
    let tot = v.x1;
    if (a.kant === 'rechts') van = Math.max(v.x0, this.midden);
    if (a.kant === 'links') tot = Math.min(v.x1, this.midden);
    if (tot <= van) return '';
    const y = (x) => a.m * x + a.q;
    return `<line x1="${this.naarPixelX(van).toFixed(1)}" y1="${this.naarPixelY(y(van)).toFixed(1)}" x2="${this.naarPixelX(tot).toFixed(1)}" y2="${this.naarPixelY(y(tot)).toFixed(1)}" ${stijl}/>`;
  }

  markeringenSVG() {
    const res = [];
    let vorigeX = -Infinity;
    let omhoog = false;
    const gesorteerd = [...this.markeringen].sort((a, b) => a.x - b.x);
    for (const m of gesorteerd) {
      const x = this.naarPixelX(m.x);
      const y = this.naarPixelY(m.y);
      if (x < 0 || x > this.breedte || y < 0 || y > this.hoogte) continue;
      omhoog = x - vorigeX < 52 ? !omhoog : false;
      vorigeX = x;
      res.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${KLEUR.curve}" stroke="#fff" stroke-width="2"/>`);
      if (m.label) {
        const ly = omhoog ? y - 12 : y + 20;
        res.push(`<text x="${x.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="13" font-weight="600" fill="#1f2328" stroke="#fff" stroke-width="4" paint-order="stroke" font-family="system-ui, -apple-system, Segoe UI, sans-serif">${ontsnap(m.label)}</text>`);
      }
    }
    return res;
  }

  kruisSVG() {
    const x = this.naarPixelX(this.kruisX).toFixed(1);
    const y = this.f(this.kruisX);
    const lijn = `<line x1="${x}" x2="${x}" y1="0" y2="${this.hoogte}" stroke="${KLEUR.kruis}" stroke-dasharray="3 3"/>`;
    if (!Number.isFinite(y)) return lijn;
    return `${lijn}<circle cx="${x}" cy="${this.naarPixelY(y).toFixed(1)}" r="5" fill="#fff" stroke="${KLEUR.curve}" stroke-width="2.5"/>`;
  }

  toonAflezing() {
    if (!this.aflezing) return;
    if (this.kruisX === null) {
      this.aflezing.textContent = 'Tik op de grafiek om een waarde af te lezen.';
      return;
    }
    const y = this.f(this.kruisX);
    const fx = Number.isNaN(y) ? 'bestaat niet' : `= ${decimaal(y)}`;
    this.aflezing.textContent = `x = ${decimaal(this.kruisX)}  ·  f(x) ${fx}`;
  }

  zetKruis(clientX) {
    const r = this.houder.getBoundingClientRect();
    const x = this.naarDataX(clientX - r.left);
    this.kruisX = x;
    this.toonAflezing();
    this.teken();
  }

  koppelInvoer() {
    const h = this.houder;
    h.addEventListener('pointerdown', (e) => {
      if (!this.venster) return;
      h.setPointerCapture(e.pointerId);
      this.wijzers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY });
      if (this.wijzers.size === 2) this.knijp = this.knijpBegin();
    });
    h.addEventListener('pointermove', (e) => {
      if (!this.venster) return;
      const w = this.wijzers.get(e.pointerId);
      if (!w) {
        if (e.pointerType === 'mouse') this.zetKruis(e.clientX);
        return;
      }
      if (this.wijzers.size === 2 && this.knijp) {
        w.x = e.clientX;
        w.y = e.clientY;
        this.knijpVerder();
        return;
      }
      const dx = e.clientX - w.x;
      const dy = e.clientY - w.y;
      w.x = e.clientX;
      w.y = e.clientY;
      const v = this.venster;
      const perPixelX = (v.x1 - v.x0) / (this.breedte - MARGE.links - MARGE.rechts);
      const perPixelY = (v.y1 - v.y0) / (this.hoogte - MARGE.boven - MARGE.onder);
      this.venster = { x0: v.x0 - dx * perPixelX, x1: v.x1 - dx * perPixelX, y0: v.y0 + dy * perPixelY, y1: v.y1 + dy * perPixelY };
      this.teken();
    });
    const einde = (e) => {
      const w = this.wijzers.get(e.pointerId);
      if (!w) return;
      const verplaatst = Math.hypot(e.clientX - w.startX, e.clientY - w.startY);
      this.wijzers.delete(e.pointerId);
      if (this.wijzers.size < 2) this.knijp = null;
      if (e.type === 'pointerup' && verplaatst < TIK_AFSTAND && this.wijzers.size === 0) this.zetKruis(e.clientX);
    };
    h.addEventListener('pointerup', einde);
    h.addEventListener('pointercancel', einde);
    h.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && !this.wijzers.size && this.kruisX !== null) {
        this.kruisX = null;
        this.toonAflezing();
        this.teken();
      }
    });
    h.addEventListener('wheel', (e) => {
      // Zonder Ctrl scrolt het wiel gewoon de pagina; knijpen op een trackpad stuurt Ctrl mee.
      if (!this.venster || !e.ctrlKey) return;
      e.preventDefault();
      const r = h.getBoundingClientRect();
      const factor = Math.exp(e.deltaY * 0.0015);
      this.zoom(factor, this.naarDataX(e.clientX - r.left), this.naarDataY(e.clientY - r.top));
    }, { passive: false });
  }

  knijpBegin() {
    const [a, b] = [...this.wijzers.values()];
    const r = this.houder.getBoundingClientRect();
    return {
      afstand: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      venster: { ...this.venster },
      midden: { x: this.naarDataX((a.x + b.x) / 2 - r.left), y: this.naarDataY((a.y + b.y) / 2 - r.top) },
    };
  }

  knijpVerder() {
    const [a, b] = [...this.wijzers.values()];
    const factor = this.knijp.afstand / (Math.hypot(a.x - b.x, a.y - b.y) || 1);
    const { venster: v, midden: m } = this.knijp;
    this.venster = {
      x0: m.x - (m.x - v.x0) * factor,
      x1: m.x + (v.x1 - m.x) * factor,
      y0: m.y - (m.y - v.y0) * factor,
      y1: m.y + (v.y1 - m.y) * factor,
    };
    this.teken();
  }
}

export { ZOOMSTAP };
