/**
 * Wat dit toestel onthoudt: de API-sleutel en de gekozen stijl (in localStorage).
 */
const OPSLAG_SLEUTEL = 'functiefoto.apiSleutel';
const OPSLAG_STIJL = 'functiefoto.stijl';
const SLEUTEL_BEGIN = 'sk-ant-';
const LETTERTYPES = 'https://fonts.googleapis.com/css2?display=swap&family=';

export const STIJLEN = Object.freeze({
  athene: {
    naam: 'Athene',
    lettertypes: `${LETTERTYPES}Gentium+Book+Plus:ital,wght@0,400;0,700;1,400&family=Tenor+Sans`,
    themaKleur: '#ebe6dc',
  },
  minecraft: {
    naam: 'Minecraft',
    lettertypes: `${LETTERTYPES}Pixelify+Sans:wght@400;600`,
    themaKleur: '#5d9b2f',
  },
  galileo: {
    naam: 'Galileo',
    lettertypes: `${LETTERTYPES}EB+Garamond:ital,wght@0,400;0,600;1,400&family=IM+Fell+English+SC`,
    themaKleur: '#1d2340',
  },
  escher: {
    naam: 'Escher',
    lettertypes: `${LETTERTYPES}Federo&family=Spectral:ital,wght@0,400;0,600;1,400`,
    themaKleur: '#fbfaf6',
  },
});

export const STANDAARD_STIJL = 'athene';

function lees(sleutel) {
  try {
    return localStorage.getItem(sleutel);
  } catch (fout) {
    console.warn(`Lezen van "${sleutel}" uit de opslag lukt niet`, fout);
    return null;
  }
}

function schrijf(sleutel, waarde) {
  try {
    if (waarde === null) localStorage.removeItem(sleutel);
    else localStorage.setItem(sleutel, waarde);
    return true;
  } catch (fout) {
    console.warn(`Bewaren van "${sleutel}" in de opslag lukt niet`, fout);
    return false;
  }
}

export function isGeldigeSleutel(tekst) {
  return typeof tekst === 'string' && tekst.trim().startsWith(SLEUTEL_BEGIN) && tekst.trim().length > SLEUTEL_BEGIN.length + 10;
}

export const instellingen = {
  apiSleutel: () => lees(OPSLAG_SLEUTEL),
  bewaarApiSleutel: (sleutel) => schrijf(OPSLAG_SLEUTEL, sleutel.trim()),
  wisApiSleutel: () => schrijf(OPSLAG_SLEUTEL, null),
  stijl: () => {
    const stijl = lees(OPSLAG_STIJL);
    return stijl && Object.hasOwn(STIJLEN, stijl) ? stijl : STANDAARD_STIJL;
  },
  bewaarStijl: (stijl) => schrijf(OPSLAG_STIJL, stijl),
};

/** Zet de stijl op de pagina: data-stijl, lettertypes en de kleur van de statusbalk. */
export function pasStijlToe(stijl) {
  const gekozen = STIJLEN[stijl] ?? STIJLEN[STANDAARD_STIJL];
  document.documentElement.dataset.stijl = Object.hasOwn(STIJLEN, stijl) ? stijl : STANDAARD_STIJL;
  const link = document.getElementById('stijl-lettertypes');
  if (link && link.href !== gekozen.lettertypes) link.href = gekozen.lettertypes;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', gekozen.themaKleur);
}
