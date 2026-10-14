/**
 * Numerieke hulpmiddelen: nulpunten en polen zoeken, de tekentabel nacontroleren
 * en het venster en de lijnstukken van de grafiek bepalen.
 */
import { TEKEN, tekenVan } from './tabel.js';

const NUL_GRENS = 1e-6;
const POOL_GRENS = 1e3;

function bisectie(f, a, b, iteraties = 80) {
  let links = a;
  let rechts = b;
  let fLinks = f(links);
  for (let i = 0; i < iteraties; i++) {
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

/** Zoekt de grens tussen waar f bestaat (eindig) en waar niet (NaN). */
function randBisectie(f, a, b) {
  let links = a;
  let rechts = b;
  const bestaatLinks = !Number.isNaN(f(links));
  for (let i = 0; i < 80; i++) {
    const midden = (links + rechts) / 2;
    if (!Number.isNaN(f(midden)) === bestaatLinks) links = midden;
    else rechts = midden;
  }
  return bestaatLinks ? links : rechts;
}

function voegToe(lijst, x) {
  if (!lijst.some((y) => Math.abs(y - x) <= 1e-7 * Math.max(1, Math.abs(x)))) lijst.push(x);
}

/** Nulpunten, polen en domeinranden van f tussen van en tot. */
export function zoekBijzonderePunten(f, van, tot, stappen = 20000) {
  const nulpunten = [];
  const polen = [];
  const randen = [];
  const h = (tot - van) / stappen;
  let x0 = van;
  let y0 = f(x0);
  for (let i = 1; i <= stappen; i++) {
    const x1 = van + i * h;
    const y1 = f(x1);
    if (y0 === 0) voegToe(nulpunten, x0);
    else if (!Number.isFinite(y0) && !Number.isNaN(y0)) voegToe(polen, x0);
    if (Number.isNaN(y0) !== Number.isNaN(y1)) {
      voegToe(randen, randBisectie(f, x0, x1));
    } else if (Number.isFinite(y0) && Number.isFinite(y1) && y0 * y1 < 0) {
      const x = bisectie(f, x0, x1);
      const y = Math.abs(f(x));
      if (y < NUL_GRENS) voegToe(nulpunten, x);
      else if (y > POOL_GRENS || !Number.isFinite(y)) voegToe(polen, x);
    }
    x0 = x1;
    y0 = y1;
  }
  if (y0 === 0) voegToe(nulpunten, x0);
  const sorteer = (l) => l.sort((a, b) => a - b);
  return { nulpunten: sorteer(nulpunten), polen: sorteer(polen), randen: sorteer(randen) };
}

function intervalTests(links, rechts) {
  if (links === null && rechts === null) return [-7.3, -0.41, 0.37, 6.9];
  if (links === null) return [rechts - 0.37, rechts - 2.9, rechts - 23];
  if (rechts === null) return [links + 0.37, links + 2.9, links + 23];
  return [0.21, 0.5, 0.79].map((t) => links + t * (rechts - links));
}

function zelfdeTeken(verwacht, gevonden) {
  if (verwacht === gevonden) return true;
  return verwacht === TEKEN.NIET && gevonden === TEKEN.BUITEN;
}

/**
 * Controleert de tekentabel door f zelf in te vullen. Geeft een lijst verschillen;
 * een lege lijst betekent dat de controle niets vond.
 */
export function controleerTabel(tabel, f) {
  const verschillen = [];
  const { punten, f: tekens } = tabel;
  for (let i = 0; i <= punten.length; i++) {
    const links = i === 0 ? null : punten[i - 1].waarde;
    const rechts = i === punten.length ? null : punten[i].waarde;
    const verwacht = tekens[2 * i];
    for (const x of intervalTests(links, rechts)) {
      const gevonden = tekenVan(f(x));
      if (!zelfdeTeken(verwacht, gevonden)) {
        verschillen.push({ x, verwacht, gevonden });
        break;
      }
    }
    if (i < punten.length) {
      const verwachtPunt = tekens[2 * i + 1];
      if (verwachtPunt === TEKEN.NIET || verwachtPunt === TEKEN.BUITEN) continue;
      const x = punten[i].waarde;
      const gevonden = tekenVan(f(x), 1e2);
      if (!zelfdeTeken(verwachtPunt, gevonden)) verschillen.push({ x, verwacht: verwachtPunt, gevonden });
    }
  }
  // Is f op een heel interval 0, dan zijn er oneindig veel nulpunten en valt er niets na te tellen.
  const nulOpInterval = tekens.some((t, k) => k % 2 === 0 && t === TEKEN.NUL);
  const { nulpunten } = nulOpInterval ? { nulpunten: [] } : zoekBijzonderePunten(f, -50, 50, 40000);
  for (const z of nulpunten) {
    const index = punten.findIndex((p) => Math.abs(p.waarde - z) < 1e-5 * Math.max(1, Math.abs(z)));
    if (index === -1 || tekens[2 * index + 1] !== TEKEN.NUL) {
      verschillen.push({ x: z, verwacht: index === -1 ? 'geen punt' : tekens[2 * index + 1], gevonden: TEKEN.NUL });
    }
  }
  return verschillen;
}

/** Controleert of een asymptoot uit de analyse ook numeriek klopt. */
export function controleerAsymptoot(a, f) {
  if (a.soort === 'VA') {
    return [-1, 1].some((s) => {
      const dichtbij = Math.abs(f(a.x + s * 1e-9));
      const verder = Math.abs(f(a.x + s * 1e-3));
      return Number.isFinite(verder) ? dichtbij - verder > 5 || !Number.isFinite(dichtbij) : false;
    });
  }
  const kanten = a.kant === 'links' ? [-1] : a.kant === 'rechts' ? [1] : [-1, 1];
  return kanten.every((s) => {
    const x = s * 1e5;
    const y = f(x);
    return Number.isFinite(y) && Math.abs(y - (a.m * x + a.q)) < 1e-2 * Math.max(1, Math.abs(a.q));
  });
}

/** Een mooie stap voor de rasterlijnen: 1, 2 of 5 maal een macht van 10. */
export function mooieStap(bereik, doel = 8) {
  const ruw = bereik / doel;
  const macht = Math.pow(10, Math.floor(Math.log10(ruw)));
  const f = ruw / macht;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * macht;
}

/** Een beginvenster dat de belangrijke punten toont en uitschieters negeert. */
export function kiesVenster(f, belangrijkeX = []) {
  const binnen = belangrijkeX.filter((x) => Number.isFinite(x) && Math.abs(x) <= 50);
  const xs = [0, ...binnen];
  let x0 = Math.min(...xs) - 2;
  let x1 = Math.max(...xs) + 2;
  if (x1 - x0 < 8) {
    const m = (x0 + x1) / 2;
    x0 = m - 4;
    x1 = m + 4;
  }
  const ys = [];
  for (let i = 0; i <= 800; i++) {
    const y = f(x0 + ((x1 - x0) * i) / 800);
    if (Number.isFinite(y)) ys.push(y);
  }
  if (ys.length === 0) return { x0, x1, y0: -5, y1: 5 };
  ys.sort((a, b) => a - b);
  const kwantiel = (p) => ys[Math.min(ys.length - 1, Math.floor(p * ys.length))];
  let y0 = Math.min(kwantiel(0.08), 0);
  let y1 = Math.max(kwantiel(0.92), 0);
  const marge = Math.max((y1 - y0) * 0.25, 1);
  y0 -= marge;
  y1 += marge;
  const breedte = x1 - x0;
  if (y1 - y0 < breedte * 0.4) {
    const m = (y0 + y1) / 2;
    y0 = m - breedte * 0.2;
    y1 = m + breedte * 0.2;
  }
  return { x0, x1, y0, y1 };
}

/** Lijnstukken van de grafiek binnen het venster, onderbroken bij polen en buiten het domein. */
export function bouwPaden(f, v, stappen = 1200) {
  const hoogte = v.y1 - v.y0;
  const boven = v.y1 + 2 * hoogte;
  const onder = v.y0 - 2 * hoogte;
  const paden = [];
  let huidig = null;
  let vorige = null;
  for (let i = 0; i <= stappen; i++) {
    const x = v.x0 + ((v.x1 - v.x0) * i) / stappen;
    const y = f(x);
    if (!Number.isFinite(y)) {
      huidig = null;
      vorige = null;
      continue;
    }
    const sprong = vorige !== null && (
      (vorige > boven && y < onder) || (vorige < onder && y > boven)
      || (Math.sign(vorige) !== Math.sign(y) && Math.abs(y - vorige) > hoogte)
    );
    if (!huidig || sprong) {
      huidig = [];
      paden.push(huidig);
    }
    huidig.push([x, Math.min(boven, Math.max(onder, y))]);
    vorige = y;
  }
  return paden.filter((p) => p.length > 1);
}

/** Stukken van het venster waar f niet bestaat (om grijs te kleuren). */
export function domeinGaten(f, v, stappen = 600) {
  const gaten = [];
  let start = null;
  for (let i = 0; i <= stappen; i++) {
    const x = v.x0 + ((v.x1 - v.x0) * i) / stappen;
    const bestaatNiet = Number.isNaN(f(x));
    if (bestaatNiet && start === null) start = x;
    if ((!bestaatNiet || i === stappen) && start !== null) {
      gaten.push([start, x]);
      start = null;
    }
  }
  return gaten;
}
