/**
 * Het tekenblad: een wit vel over het hele scherm om de functie met pen of vinger te schrijven.
 * Met een Apple Pencil tekent alleen de pen, zodat een hand op het scherm geen strepen maakt.
 */
import { lijnDikte, omhullende, raaktStreep, exportMaat, pasStrepenIn, Geschiedenis } from './tekenblad-logica.js';
import { MAX_ZIJDE } from './claude.js';

const INKT = '#14171c';
const GOM_STRAAL = 14;
const MARGE = 28;
const MODUS = Object.freeze({ PEN: 'pen', GOM: 'gom' });
const WIJZER = Object.freeze({ PEN: 'pen', VINGER: 'touch' });
const MELDING_VINGER = 'Je schrijft met de pen, dus een vinger tekent nu niet. Sluit en open het blad om met je vinger te tekenen.';

export class Tekenblad {
  /**
   * @param {HTMLDialogElement} dialoog
   * @param {{ onKlaar: (afbeelding: Blob) => void }} opties
   */
  constructor(dialoog, { onKlaar }) {
    this.dialoog = dialoog;
    this.doek = dialoog.querySelector('canvas');
    this.ctx = this.doek.getContext('2d');
    this.hint = dialoog.querySelector('.tekenblad-hint');
    this.melding = dialoog.querySelector('.tekenblad-melding');
    this.knop = (naam) => dialoog.querySelector(`[data-actie="${naam}"]`);
    this.onKlaar = onKlaar;
    this.strepen = [];
    this.geschiedenis = new Geschiedenis();
    this.gebaar = null;
    this.modus = MODUS.PEN;
    this.penGezien = false;
    this.vingerGemeld = false;
    this.bezigMetOmzetten = false;
    this.maat = { breedte: 0, hoogte: 0 };
    new ResizeObserver(() => this.pasGrootteAan()).observe(this.doek);
    this.koppelKnoppen();
    this.koppelWijzers();
  }

  open() {
    this.toonMelding('');
    this.penGezien = false;
    this.vingerGemeld = false;
    this.dialoog.showModal();
    this.pasGrootteAan();
  }

  sluit() {
    this.beeindigGebaar();
    this.dialoog.close();
  }

  heeftInhoud() {
    return this.strepen.length > 0;
  }

  koppelKnoppen() {
    this.knop('sluit').addEventListener('click', () => this.sluit());
    this.knop(MODUS.PEN).addEventListener('click', () => this.zetModus(MODUS.PEN));
    this.knop(MODUS.GOM).addEventListener('click', () => this.zetModus(MODUS.GOM));
    this.knop('ongedaan').addEventListener('click', () => {
      this.beeindigGebaar();
      const vorige = this.geschiedenis.ongedaan();
      if (vorige) this.zetStrepen(vorige);
    });
    this.knop('wis').addEventListener('click', () => {
      this.beeindigGebaar();
      if (!this.heeftInhoud()) return;
      this.geschiedenis.bewaar(this.strepen);
      this.zetStrepen([]);
      this.toonMelding('Het blad is leeg. Met Ongedaan maken komt alles terug.');
    });
    this.knop('klaar').addEventListener('click', () => this.rondAf());
    this.dialoog.addEventListener('close', () => this.beeindigGebaar());
  }

  zetModus(modus) {
    this.beeindigGebaar();
    this.modus = modus;
    this.knop(MODUS.PEN).setAttribute('aria-pressed', String(modus === MODUS.PEN));
    this.knop(MODUS.GOM).setAttribute('aria-pressed', String(modus === MODUS.GOM));
    this.doek.dataset.modus = modus;
  }

  zetStrepen(strepen) {
    this.strepen = strepen;
    this.tekenAlles();
  }

  toonMelding(tekst) {
    this.melding.textContent = tekst;
  }

  async rondAf() {
    if (this.bezigMetOmzetten) return;
    this.beeindigGebaar();
    if (!this.heeftInhoud()) {
      this.toonMelding('Schrijf eerst een functie op het blad.');
      return;
    }
    this.bezigMetOmzetten = true;
    try {
      const afbeelding = await this.naarAfbeelding();
      if (!this.dialoog.open) return;
      if (!afbeelding) {
        this.toonMelding('Het blad kon niet omgezet worden naar een afbeelding. Probeer opnieuw.');
        return;
      }
      this.sluit();
      this.onKlaar(afbeelding);
    } finally {
      this.bezigMetOmzetten = false;
    }
  }

  /** De strepen als PNG: alleen het beschreven stuk, op wit, groot genoeg om te lezen. */
  naarAfbeelding() {
    const o = omhullende(this.strepen);
    const x0 = o.x0 - MARGE;
    const y0 = o.y0 - MARGE;
    const maat = exportMaat(o.x1 - o.x0 + 2 * MARGE, o.y1 - o.y0 + 2 * MARGE, MAX_ZIJDE);
    const uit = document.createElement('canvas');
    uit.width = maat.breedte;
    uit.height = maat.hoogte;
    const ctx = uit.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, uit.width, uit.height);
    ctx.setTransform(maat.schaal, 0, 0, maat.schaal, -x0 * maat.schaal, -y0 * maat.schaal);
    for (const s of this.strepen) this.tekenStreep(ctx, s);
    return new Promise((resolve) => uit.toBlob(resolve, 'image/png'));
  }

  /** Past de bitmap aan de schermmaat aan en houdt de tekening zichtbaar na draaien. */
  pasGrootteAan() {
    const breedte = this.doek.clientWidth;
    const hoogte = this.doek.clientHeight;
    if (!breedte || !hoogte) return;
    const dpr = window.devicePixelRatio || 1;
    if (this.doek.width !== Math.round(breedte * dpr) || this.doek.height !== Math.round(hoogte * dpr)) {
      this.doek.width = Math.round(breedte * dpr);
      this.doek.height = Math.round(hoogte * dpr);
    }
    if (breedte !== this.maat.breedte || hoogte !== this.maat.hoogte) {
      this.beeindigGebaar();
      this.strepen = pasStrepenIn(this.strepen, breedte, hoogte, MARGE);
      this.maat = { breedte, hoogte };
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.tekenAlles();
  }

  tekenAlles() {
    this.ctx.clearRect(0, 0, this.doek.clientWidth, this.doek.clientHeight);
    for (const s of this.strepen) this.tekenStreep(this.ctx, s);
    this.hint.hidden = this.heeftInhoud();
  }

  tekenStreep(ctx, streep, vanaf = 0) {
    ctx.strokeStyle = INKT;
    ctx.fillStyle = INKT;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const p = streep.punten;
    if (p.length === 1) {
      ctx.beginPath();
      ctx.arc(p[0].x, p[0].y, lijnDikte(p[0].druk, streep.pen) / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    for (let i = Math.max(1, vanaf); i < p.length; i++) {
      ctx.lineWidth = lijnDikte((p[i - 1].druk + p[i].druk) / 2, streep.pen);
      ctx.beginPath();
      ctx.moveTo(p[i - 1].x, p[i - 1].y);
      ctx.lineTo(p[i].x, p[i].y);
      ctx.stroke();
    }
  }

  punt(e) {
    const r = this.doek.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, druk: e.pressure };
  }

  /** Stopt een lopende streep of gombeweging, bijvoorbeeld als er op een knop getikt wordt. */
  beeindigGebaar() {
    if (!this.gebaar) return;
    if (this.doek.hasPointerCapture?.(this.gebaar.id)) this.doek.releasePointerCapture(this.gebaar.id);
    this.gebaar = null;
  }

  gom(p) {
    const over = this.strepen.filter((s) => !raaktStreep(s, p, GOM_STRAAL));
    if (over.length === this.strepen.length) return;
    if (!this.gebaar.gewijzigd) {
      this.geschiedenis.bewaar(this.strepen);
      this.gebaar.gewijzigd = true;
    }
    this.zetStrepen(over);
  }

  begin(e) {
    try {
      this.doek.setPointerCapture(e.pointerId);
    } catch (fout) {
      // Zonder vastzetten werkt tekenen nog, alleen stopt de streep aan de rand van het blad.
      console.warn('De wijzer kon niet vastgezet worden op het tekenblad', fout);
    }
    const p = this.punt(e);
    this.gebaar = { id: e.pointerId, soort: e.pointerType, modus: this.modus, streep: null, gewijzigd: false };
    this.toonMelding('');
    if (this.gebaar.modus === MODUS.GOM) {
      this.gom(p);
      return;
    }
    this.geschiedenis.bewaar(this.strepen);
    this.gebaar.streep = { punten: [p], pen: e.pointerType === WIJZER.PEN };
    this.strepen = [...this.strepen, this.gebaar.streep];
    this.hint.hidden = true;
    this.tekenStreep(this.ctx, this.gebaar.streep);
  }

  /** Een vinger- of handpalmstreep die net voor de pen begon, verdwijnt weer. */
  vervangVingerDoorPen() {
    const vinger = this.gebaar;
    this.beeindigGebaar();
    if (vinger.streep) {
      const vorige = this.geschiedenis.ongedaan();
      this.zetStrepen(vorige ?? this.strepen.filter((s) => s !== vinger.streep));
    }
  }

  koppelWijzers() {
    const doek = this.doek;
    doek.addEventListener('pointerdown', (e) => {
      const isPen = e.pointerType === WIJZER.PEN;
      if (isPen) this.penGezien = true;
      if (this.penGezien && e.pointerType === WIJZER.VINGER) {
        if (!this.gebaar && !this.vingerGemeld) {
          this.toonMelding(MELDING_VINGER);
          this.vingerGemeld = true;
        }
        return;
      }
      if (this.gebaar) {
        if (!isPen || this.gebaar.soort !== WIJZER.VINGER) return;
        this.vervangVingerDoorPen();
      }
      e.preventDefault();
      this.begin(e);
    });
    doek.addEventListener('pointermove', (e) => {
      if (!this.gebaar || e.pointerId !== this.gebaar.id) return;
      e.preventDefault();
      const gebeurtenissen = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      const reeks = gebeurtenissen.length ? gebeurtenissen : [e];
      if (this.gebaar.modus === MODUS.GOM) {
        reeks.forEach((g) => this.gom(this.punt(g)));
        return;
      }
      const streep = this.gebaar.streep;
      const vanaf = streep.punten.length;
      reeks.forEach((g) => streep.punten.push(this.punt(g)));
      this.tekenStreep(this.ctx, streep, vanaf);
    });
    doek.addEventListener('pointerup', (e) => {
      if (this.gebaar && e.pointerId === this.gebaar.id) this.beeindigGebaar();
    });
    // Een systeemgebaar (bv. vegen vanaf de rand) breekt de streep af: die halve streep telt niet.
    doek.addEventListener('pointercancel', (e) => {
      if (!this.gebaar || e.pointerId !== this.gebaar.id) return;
      const streep = this.gebaar.streep;
      this.beeindigGebaar();
      if (streep) {
        const vorige = this.geschiedenis.ongedaan();
        this.zetStrepen(vorige ?? this.strepen.filter((s) => s !== streep));
      }
    });
  }
}
