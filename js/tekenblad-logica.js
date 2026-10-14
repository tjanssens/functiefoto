/**
 * Rekenwerk van het tekenblad, los van de pagina: lijndikte, omhullende rechthoek,
 * gom (raakt de gom een streep?), inpassen na een andere schermmaat, ongedaan maken
 * en de maat van de afbeelding voor Claude.
 * Een streep is { punten: [{ x, y, druk }], pen: boolean }, in CSS-pixels.
 */

export const BASIS_DIKTE = 3.2;
const MIDDELSTE_DRUK = 0.5;
const MAX_STAPPEN_ONGEDAAN = 200;

/** Lijndikte: bij een pen volgt ze de druk, bij een vinger is ze vast. */
export function lijnDikte(druk, isPen) {
  if (!isPen) return BASIS_DIKTE;
  const d = Number.isFinite(druk) && druk > 0 ? Math.min(druk, 1) : MIDDELSTE_DRUK;
  return BASIS_DIKTE * (0.45 + d * 1.1);
}

/** De kleinste rechthoek rond alle strepen, met de lijndikte erbij; null als er niets staat. */
export function omhullende(strepen) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of strepen) {
    for (const p of s.punten) {
      const half = lijnDikte(p.druk, s.pen) / 2;
      x0 = Math.min(x0, p.x - half);
      y0 = Math.min(y0, p.y - half);
      x1 = Math.max(x1, p.x + half);
      y1 = Math.max(y1, p.y + half);
    }
  }
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null;
}

function afstandTotLijnstuk(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengte2 = dx * dx + dy * dy;
  const t = lengte2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengte2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Raakt een gom met deze straal in punt p de streep? */
export function raaktStreep(streep, p, straal) {
  const punten = streep.punten;
  if (punten.length === 0) return false;
  if (punten.length === 1) return Math.hypot(p.x - punten[0].x, p.y - punten[0].y) <= straal;
  for (let i = 1; i < punten.length; i++) {
    if (afstandTotLijnstuk(p, punten[i - 1], punten[i]) <= straal) return true;
  }
  return false;
}

/**
 * Past de strepen in een vel van breedte x hoogte, bijvoorbeeld na het draaien van de iPad.
 * Valt alles al binnen het vel, dan blijven de strepen ongewijzigd. Anders wordt de tekening
 * zo nodig verkleind en naar binnen geschoven, met marge tot de rand.
 */
export function pasStrepenIn(strepen, breedte, hoogte, marge) {
  const o = omhullende(strepen);
  if (!o || breedte <= 2 * marge || hoogte <= 2 * marge) return strepen;
  if (o.x0 >= 0 && o.y0 >= 0 && o.x1 <= breedte && o.y1 <= hoogte) return strepen;
  const schaal = Math.min(1, (breedte - 2 * marge) / (o.x1 - o.x0), (hoogte - 2 * marge) / (o.y1 - o.y0));
  const nieuweBreedte = (o.x1 - o.x0) * schaal;
  const nieuweHoogte = (o.y1 - o.y0) * schaal;
  const doelX = Math.min(Math.max(o.x0, marge), breedte - marge - nieuweBreedte);
  const doelY = Math.min(Math.max(o.y0, marge), hoogte - marge - nieuweHoogte);
  return strepen.map((s) => ({
    ...s,
    punten: s.punten.map((p) => ({ ...p, x: doelX + (p.x - o.x0) * schaal, y: doelY + (p.y - o.y0) * schaal })),
  }));
}

/** De vorige toestanden van het blad, zodat elke handeling (ook gommen en wissen) ongedaan kan. */
export class Geschiedenis {
  constructor(maximum = MAX_STAPPEN_ONGEDAAN) {
    this.maximum = maximum;
    this.stapel = [];
  }

  /** Bewaart de toestand van vóór een handeling. */
  bewaar(strepen) {
    this.stapel.push([...strepen]);
    if (this.stapel.length > this.maximum) this.stapel.shift();
  }

  /** De toestand van vóór de laatste handeling, of null als er niets ongedaan te maken is. */
  ongedaan() {
    return this.stapel.pop() ?? null;
  }

  wis() {
    this.stapel = [];
  }
}

/**
 * Hoe groot de afbeelding voor Claude wordt: de langste zijde hoogstens maxZijde,
 * en kleine tekeningen hoogstens maxVergroting keer vergroot.
 */
export function exportMaat(breedte, hoogte, maxZijde, maxVergroting = 3) {
  const schaal = Math.min(maxVergroting, maxZijde / Math.max(breedte, hoogte, 1));
  return { schaal, breedte: Math.max(1, Math.round(breedte * schaal)), hoogte: Math.max(1, Math.round(hoogte * schaal)) };
}
