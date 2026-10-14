/**
 * Een verborgen verrassing: wie op het embleem tikt, ziet de beweging uit de kop meteen,
 * bijvoorbeeld de knipoog van de uil of het vraagtekenblok dat opwipt.
 * Welke stijlen meedoen, staat alleen in css/stijlen.css (regels met .embleem.tik).
 * Er is bewust geen aanwijzing: geen handje, geen hover en geen tekst.
 */
const KLASSE_TIK = 'tik';
const KLASSE_STIL = 'stil';

function eenmaligeAnimaties(embleem) {
  return embleem
    .getAnimations({ subtree: true })
    .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime));
}

/**
 * De animatie bij een tik heeft dezelfde naam als de herhalende animatie. Zonder een
 * moment stilstand zou de browser ze niet herstarten maar verder rekenen op de oude klok.
 */
function herstart(embleem) {
  embleem.classList.remove(KLASSE_TIK);
  embleem.classList.add(KLASSE_STIL);
  void getComputedStyle(embleem, '::after').animationName;
  void getComputedStyle(embleem, '::before').animationName;
  embleem.classList.remove(KLASSE_STIL);
  embleem.classList.add(KLASSE_TIK);
}

async function speel(embleem) {
  herstart(embleem);
  try {
    await Promise.all(eenmaligeAnimaties(embleem).map((a) => a.finished));
  } catch (fout) {
    // Een nieuwe tik breekt de vorige animatie af; die nieuwe tik ruimt zelf op.
    if (fout?.name === 'AbortError') return;
    console.warn('De animatie van het embleem liep mis', fout);
  }
  embleem.classList.remove(KLASSE_TIK);
}

export function koppelVerrassing(embleem) {
  embleem?.addEventListener('click', () => speel(embleem));
}
