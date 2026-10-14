/**
 * Verborgen verrassingen in de kop. Er is bewust geen aanwijzing: geen handje, geen hover en geen tekst.
 * 1. Wie op het embleem tikt, ziet de beweging uit de kop meteen, bijvoorbeeld de knipoog van de uil
 *    of het vraagtekenblok dat opwipt. Welke stijlen meedoen, staat in css/stijlen.css (.embleem.tik).
 * 2. Wie op de kop zelf tikt, krijgt in sommige stijlen nog iets extra, bijvoorbeeld een vallende ster
 *    in Galileo. Een stijl zet daarvoor --kop-verrassing op :root; de vorm staat ook in stijlen.css.
 */
const KLASSE_TIK = 'tik';
const KLASSE_STIL = 'stil';
const KLASSE_VALLENDE_STER = 'vallende-ster';
const KOP_VERRASSING = '--kop-verrassing';
const VALLENDE_STER = 'vallende-ster';
const INTERACTIEF = 'a, button, input, label, select, textarea';

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

function tussen(willekeurig, van, tot) {
  return van + willekeurig() * (tot - van);
}

/**
 * Kiest een willekeurige vallende ster in een vlak van breedte x hoogte: ze start in de
 * bovenste helft, valt schuin naar links of rechts naar beneden en blijft grotendeels in beeld.
 * Hoeken in graden, met y naar beneden; 0 is naar rechts.
 */
export function kiesVallendeSter(breedte, hoogte, willekeurig = Math.random) {
  const naarRechts = willekeurig() < 0.5;
  const dalen = tussen(willekeurig, 12, 32);
  const hoek = naarRechts ? dalen : 180 - dalen;
  const gewensteAfstand = Math.max(160, tussen(willekeurig, 0.35, 0.6) * breedte);
  const x0 = (naarRechts ? tussen(willekeurig, 0.12, 0.5) : tussen(willekeurig, 0.5, 0.88)) * breedte;
  const y0 = tussen(willekeurig, 0.08, 0.45) * hoogte;
  const rad = (hoek * Math.PI) / 180;
  // Een brede maar lage kop: de ster valt niet verder dan de onderrand, anders zie je haar niet doven.
  const afstand = Math.min(gewensteAfstand, (hoogte - y0) / Math.sin(rad));
  return {
    x0,
    y0,
    dx: Math.cos(rad) * afstand,
    dy: Math.sin(rad) * afstand,
    hoek,
    lengte: tussen(willekeurig, 70, 130),
    duur: tussen(willekeurig, 650, 1050),
  };
}

function speelVallendeSter(kop) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const { width, height } = kop.getBoundingClientRect();
  const s = kiesVallendeSter(width, height);
  const ster = document.createElement('span');
  ster.className = KLASSE_VALLENDE_STER;
  ster.setAttribute('aria-hidden', 'true');
  // De kop van de ster ligt op het draaipunt (rechts); de staart groeit erachter.
  ster.style.width = `${s.lengte}px`;
  ster.style.left = `${-s.lengte}px`;
  kop.append(ster);
  const stand = (deel, schaal) => `translate(${s.x0 + s.dx * deel}px, ${s.y0 + s.dy * deel}px) rotate(${s.hoek}deg) scaleX(${schaal})`;
  const animatie = ster.animate([
    { transform: stand(0, 0.2), opacity: 0 },
    { transform: stand(0.15, 1), opacity: 1, offset: 0.15 },
    { transform: stand(1, 0.6), opacity: 0 },
  ], { duration: s.duur, easing: 'cubic-bezier(.2, .6, .4, 1)' });
  // Na de vlucht verdwijnt de ster. Wisselt de stijl tijdens de vlucht, dan verbergt basis.css haar meteen.
  animatie.finished
    .catch((fout) => {
      if (fout?.name !== 'AbortError') console.warn('De vallende ster liep mis', fout);
    })
    .finally(() => ster.remove());
}

function kopVerrassing() {
  return getComputedStyle(document.documentElement).getPropertyValue(KOP_VERRASSING).trim();
}

/** Koppelt de verrassingen aan het embleem en aan de kop waarin het staat. */
export function koppelVerrassing(embleem) {
  embleem?.addEventListener('click', () => speel(embleem));
  const kop = embleem?.closest('.kop');
  kop?.addEventListener('click', (e) => {
    if (e.target.closest(INTERACTIEF)) return;
    if (kopVerrassing() === VALLENDE_STER) speelVallendeSter(kop);
  });
}
