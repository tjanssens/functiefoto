/**
 * Verbindt de pagina: functie inlezen (typen, foto of tekenblad), analyseren, tekenen en tonen.
 */
import { ontleed, ExpressieFout } from './expressie.js';
import { analyseer } from './analyse.js';
import { controleerTabel, controleerAsymptoot } from './numeriek.js';
import { TEKEN } from './tabel.js';
import { decimaal } from './opmaak.js';
import { Grafiek, ZOOMSTAP } from './grafiek.js';
import { toonFormule, toonTekentabel, toonBerekening } from './weergave.js';
import { instellingen, isGeldigeSleutel, pasStijlToe, STIJLEN } from './instellingen.js';
import { leesFunctie, testSleutel, LeesFout } from './claude.js';
import { Tekenblad } from './tekenblad.js';

const VOORBEELD = '(2x^3 - 3x + 1)/(x^2 + 1)';

const $ = (id) => document.getElementById(id);
const el = {
  stijl: $('stijl'),
  foto: $('foto'),
  fotoVoorbeeld: $('foto-voorbeeld'),
  fotoStatus: $('foto-status'),
  annuleer: $('annuleer-lezen'),
  form: $('functie-form'),
  functie: $('functie'),
  functieFout: $('functie-fout'),
  formule: $('formule'),
  voorbeeld: $('voorbeeld-label'),
  tabel: $('tekentabel'),
  berekening: $('berekening'),
  dialoog: $('instellingen'),
  sleutel: $('api-sleutel'),
  sleutelStatus: $('sleutel-status'),
};

const grafiek = new Grafiek($('grafiek'), $('aflezing'));
const tekenblad = new Tekenblad($('tekenblad'), {
  onKlaar: (afbeelding) => leesAfbeelding(afbeelding, BRONNEN.tekenblad),
});
let lezen = null;
let fotoUrl = null;

function zetStatus(element, tekst, soort = '') {
  element.textContent = tekst;
  element.dataset.soort = soort;
  element.hidden = !tekst;
}

function markeringen(analyse) {
  const res = [];
  if (analyse.tabel) {
    analyse.tabel.punten.forEach((p, i) => {
      if (analyse.tabel.f[2 * i + 1] !== TEKEN.NUL) return;
      const label = p.getal && p.getal.isRationaal() ? p.tekst : decimaal(p.waarde);
      res.push({ x: p.waarde, y: 0, label });
    });
  }
  const y0 = analyse.f(0);
  if (Number.isFinite(y0) && !res.some((m) => m.x === 0)) res.push({ x: 0, y: y0, label: '' });
  return res;
}

/** Ontleedt, analyseert en toont een functie. Geeft false bij een schrijffout. */
function verwerk(tekst, { isVoorbeeld = false } = {}) {
  let boom;
  try {
    boom = ontleed(tekst);
  } catch (fout) {
    if (!(fout instanceof ExpressieFout)) throw fout;
    zetStatus(el.functieFout, fout.message, 'fout');
    el.functie.setAttribute('aria-invalid', 'true');
    return false;
  }
  zetStatus(el.functieFout, '');
  el.functie.removeAttribute('aria-invalid');

  const analyse = analyseer(boom);
  // Een numerieke tabel komt al uit invullen; nacontroleren heeft alleen zin bij een exacte tabel.
  const verschillen = analyse.tabel && analyse.soort !== 'numeriek' ? controleerTabel(analyse.tabel, analyse.f) : [];
  if (verschillen.length) console.warn('De controle van de tekentabel vond verschillen', { functie: tekst, verschillen });
  const asymptoten = analyse.asymptoten.lijst.filter((a) => controleerAsymptoot(a, analyse.f));
  if (asymptoten.length < analyse.asymptoten.lijst.length) {
    console.warn('Niet elke asymptoot doorstond de controle', { functie: tekst, lijst: analyse.asymptoten.lijst });
  }

  toonFormule(el.formule, analyse.functie);
  grafiek.toon({
    f: analyse.f,
    asymptoten,
    markeringen: markeringen(analyse),
    belangrijkeX: analyse.tabel ? analyse.tabel.punten.map((p) => p.waarde) : [],
  });
  toonTekentabel(el.tabel, analyse, verschillen);
  toonBerekening(el.berekening, analyse);
  el.voorbeeld.hidden = !isVoorbeeld;
  return true;
}

/** Waar de afbeelding vandaan komt bepaalt de meldingen en de miniatuur. */
const BRONNEN = Object.freeze({
  foto: {
    soort: 'foto',
    alt: 'Je foto van de functie',
    bezig: 'Claude leest de functie op je foto…',
    leeg: 'Op deze foto staat geen functie die ik kan lezen. Probeer een scherpere foto, of typ de functie.',
    vergelijk: 'je foto',
  },
  tekenblad: {
    soort: 'tekenblad',
    alt: 'Wat je op het tekenblad schreef',
    bezig: 'Claude leest de functie op je tekenblad…',
    leeg: 'Op het tekenblad staat geen functie die ik kan lezen. Schrijf ze wat groter en duidelijker, of typ de functie.',
    vergelijk: 'wat je schreef',
  },
});

function toonAfbeelding(afbeelding, bron) {
  if (fotoUrl) URL.revokeObjectURL(fotoUrl);
  fotoUrl = URL.createObjectURL(afbeelding);
  el.fotoVoorbeeld.src = fotoUrl;
  el.fotoVoorbeeld.alt = bron.alt;
  el.fotoVoorbeeld.dataset.bron = bron.soort;
  el.fotoVoorbeeld.hidden = false;
}

async function leesAfbeelding(afbeelding, bron) {
  const sleutel = instellingen.apiSleutel();
  if (!sleutel) {
    zetStatus(el.fotoStatus, 'Vul eerst de API-sleutel in bij Instellingen. Daarna kan Claude de functie lezen.', 'fout');
    openInstellingen();
    return;
  }
  toonAfbeelding(afbeelding, bron);
  // Een nieuwe lezing vervangt een lopende; alleen de nieuwste mag nog meldingen tonen.
  lezen?.abort();
  const dezeLezing = new AbortController();
  lezen = dezeLezing;
  const isActueel = () => lezen === dezeLezing;
  el.annuleer.hidden = false;
  zetStatus(el.fotoStatus, bron.bezig, 'bezig');
  try {
    const resultaat = await leesFunctie(afbeelding, sleutel, dezeLezing.signal);
    if (!isActueel()) return;
    if (!resultaat.gevonden || !resultaat.functie) {
      zetStatus(el.fotoStatus, resultaat.twijfel || bron.leeg, 'fout');
      return;
    }
    el.functie.value = resultaat.functie;
    const gelukt = verwerk(resultaat.functie);
    if (!gelukt) {
      zetStatus(el.fotoStatus, 'De gelezen formule klopt niet helemaal. Pas ze aan en kies Teken.', 'let-op');
    } else if (resultaat.twijfel) {
      zetStatus(el.fotoStatus, `Gelezen, maar kijk dit na: ${resultaat.twijfel}`, 'let-op');
    } else {
      zetStatus(el.fotoStatus, `Gelezen. Vergelijk de formule hieronder nog even met ${bron.vergelijk}.`, 'ok');
    }
  } catch (fout) {
    if (!(fout instanceof LeesFout)) console.error('Onverwachte fout bij het lezen van de functie', fout);
    if (!isActueel()) return;
    if (fout instanceof LeesFout) {
      zetStatus(el.fotoStatus, fout.message, fout.soort === 'geannuleerd' ? '' : 'fout');
    } else {
      zetStatus(el.fotoStatus, 'Er liep iets mis bij het lezen van de functie. Probeer opnieuw.', 'fout');
    }
  } finally {
    if (isActueel()) {
      el.annuleer.hidden = true;
      lezen = null;
    }
  }
}

function toonSleutelStatus() {
  const sleutel = instellingen.apiSleutel();
  zetStatus(
    el.sleutelStatus,
    sleutel ? `Er is een sleutel bewaard die eindigt op …${sleutel.slice(-4)}.` : 'Er is nog geen sleutel bewaard.',
    sleutel ? 'ok' : '',
  );
}

function openInstellingen() {
  el.sleutel.value = '';
  toonSleutelStatus();
  el.dialoog.showModal();
}

function koppelInstellingen() {
  $('open-instellingen').addEventListener('click', openInstellingen);
  $('sluit-instellingen').addEventListener('click', () => el.dialoog.close());
  $('sleutel-bewaar').addEventListener('click', () => {
    const tekst = el.sleutel.value;
    if (!isGeldigeSleutel(tekst)) {
      zetStatus(el.sleutelStatus, 'Dit lijkt geen API-sleutel. Een sleutel begint met sk-ant-.', 'fout');
      return;
    }
    if (!instellingen.bewaarApiSleutel(tekst)) {
      zetStatus(el.sleutelStatus, 'Bewaren lukt niet op dit toestel. Kijk of de browser websitegegevens mag bewaren.', 'fout');
      return;
    }
    el.sleutel.value = '';
    toonSleutelStatus();
  });
  $('sleutel-test').addEventListener('click', async () => {
    const sleutel = el.sleutel.value.trim() || instellingen.apiSleutel();
    if (!sleutel) {
      zetStatus(el.sleutelStatus, 'Vul eerst een sleutel in.', 'fout');
      return;
    }
    zetStatus(el.sleutelStatus, 'De sleutel wordt getest…', 'bezig');
    try {
      await testSleutel(sleutel);
      zetStatus(el.sleutelStatus, 'De sleutel werkt.', 'ok');
    } catch (fout) {
      if (!(fout instanceof LeesFout)) console.error('Onverwachte fout bij het testen van de sleutel', fout);
      zetStatus(el.sleutelStatus, fout instanceof LeesFout ? fout.message : 'Het testen liep mis. Probeer opnieuw.', 'fout');
    }
  });
  $('sleutel-wis').addEventListener('click', () => {
    instellingen.wisApiSleutel();
    toonSleutelStatus();
  });
}

function koppelStijl() {
  const stijl = instellingen.stijl();
  pasStijlToe(stijl);
  el.stijl.innerHTML = Object.entries(STIJLEN).map(([sleutel, s]) => `<option value="${sleutel}">${s.naam}</option>`).join('');
  el.stijl.value = stijl;
  el.stijl.addEventListener('change', () => {
    pasStijlToe(el.stijl.value);
    instellingen.bewaarStijl(el.stijl.value);
  });
}

function start() {
  koppelStijl();
  koppelInstellingen();
  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    verwerk(el.functie.value);
  });
  el.functie.addEventListener('input', () => zetStatus(el.functieFout, ''));
  el.foto.addEventListener('change', () => {
    const bestand = el.foto.files?.[0];
    el.foto.value = '';
    if (bestand) leesAfbeelding(bestand, BRONNEN.foto);
  });
  $('open-tekenblad').addEventListener('click', () => tekenblad.open());
  el.annuleer.addEventListener('click', () => lezen?.abort());
  $('zoom-in').addEventListener('click', () => grafiek.zoom(1 / ZOOMSTAP));
  $('zoom-uit').addEventListener('click', () => grafiek.zoom(ZOOMSTAP));
  $('zoom-terug').addEventListener('click', () => grafiek.terug());
  el.functie.value = VOORBEELD;
  verwerk(VOORBEELD, { isVoorbeeld: true });
}

start();
