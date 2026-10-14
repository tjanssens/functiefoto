/**
 * Zet de analyse om naar HTML: de formule, de tekentabel met besluit en de stappen.
 * Alle tekst gaat door ontsnap(); MathML wordt door de pagina zelf opgebouwd.
 */
import { M, FX, ontsnap, breukMathML, decimaal } from './opmaak.js';
import { TEKEN } from './tabel.js';

const SYMBOOL = Object.freeze({
  [TEKEN.PLUS]: { tekst: '+', klasse: 'teken-plus', label: 'positief' },
  [TEKEN.MIN]: { tekst: '−', klasse: 'teken-min', label: 'negatief' },
  [TEKEN.NUL]: { tekst: '0', klasse: 'teken-nul', label: 'nul' },
  [TEKEN.NIET]: { tekst: '‖', klasse: 'teken-niet', label: 'bestaat niet in dit punt' },
  [TEKEN.BUITEN]: { tekst: '∄', klasse: 'teken-buiten', label: 'bestaat hier niet' },
});

export function toonFormule(houder, mathml) {
  houder.innerHTML = M.blok(mathml);
}

function cel(teken, extraKlasse = '') {
  const s = SYMBOOL[teken] ?? { tekst: '?', klasse: '', label: 'onbekend' };
  return `<td class="${s.klasse} ${extraKlasse}" aria-label="${s.label}">${s.tekst}</td>`;
}

/** Zoekt bij elk verschil van de controle de kolom in de f-rij. */
function verschilKolommen(punten, verschillen) {
  const kolommen = new Set();
  for (const v of verschillen) {
    const punt = punten.findIndex((p) => Math.abs(p.waarde - v.x) < 1e-7 * Math.max(1, Math.abs(v.x)));
    if (punt !== -1) {
      kolommen.add(2 * punt + 1);
      continue;
    }
    const interval = punten.filter((p) => p.waarde < v.x).length;
    kolommen.add(2 * interval);
  }
  return kolommen;
}

function tabelHTML(tabel, verschillen) {
  const metHerkomst = tabel.rijen.some((r) => r.herkomst);
  const aantal = tabel.f.length;
  const kop = [`<th scope="col" class="kolom-factor">${M.formule(M.i('x'))}</th>`];
  if (metHerkomst) kop.push('<th scope="col" class="kolom-herkomst">van</th>');
  for (let k = 0; k < aantal; k++) {
    if (k % 2 === 0) {
      kop.push('<th scope="col" class="interval" aria-label="interval"></th>');
    } else {
      const p = tabel.punten[(k - 1) / 2];
      const benadering = p.getal && !p.getal.isRationaal() ? `<span class="benadering">≈ ${ontsnap(decimaal(p.waarde))}</span>` : '';
      kop.push(`<th scope="col" class="punt">${M.regel(p.mathml)}${benadering}</th>`);
    }
  }
  const rijen = tabel.rijen.map((r) => {
    const cellen = r.tekens.map((t) => cel(t)).join('');
    const herkomst = metHerkomst ? `<td class="herkomst">${ontsnap(r.herkomst)}</td>` : '';
    return `<tr><th scope="row">${M.formule(r.mathml)}</th>${herkomst}${cellen}</tr>`;
  });
  const fout = verschilKolommen(tabel.punten, verschillen);
  const fCellen = tabel.f.map((t, k) => cel(t, fout.has(k) ? 'verschil' : '')).join('');
  const fHerkomst = metHerkomst ? '<td class="herkomst"></td>' : '';
  rijen.push(`<tr class="f-rij"><th scope="row">${M.formule(FX)}</th>${fHerkomst}${fCellen}</tr>`);
  return `<div class="tabel-schuif"><table class="tekentabel"><thead><tr>${kop.join('')}</tr></thead><tbody>${rijen.join('')}</tbody></table></div>`;
}

function legendeHTML(tabel) {
  const alle = [...tabel.f, ...tabel.rijen.flatMap((r) => r.tekens)];
  const delen = [];
  if (alle.includes(TEKEN.NIET)) delen.push('‖ f bestaat niet in dit punt');
  if (alle.includes(TEKEN.BUITEN)) delen.push('∄ f bestaat hier niet');
  return delen.length ? `<p class="legende">${delen.map(ontsnap).join(' &nbsp;·&nbsp; ')}</p>` : '';
}

export function toonTekentabel(houder, analyse, verschillen) {
  const delen = [];
  for (const opmerking of analyse.opmerkingen) delen.push(`<p class="opmerking">${ontsnap(opmerking)}</p>`);
  if (analyse.domein) delen.push(`<p class="domein">${M.formule(analyse.domein.mathml)}</p>`);
  if (verschillen.length) {
    delen.push('<p class="waarschuwing" role="alert">Opgelet: bij het nacontroleren vond de pagina een verschil in de gemarkeerde vakjes. Kijk die zelf extra na.</p>');
  }
  if (analyse.tabel) {
    delen.push(tabelHTML(analyse.tabel, verschillen));
    delen.push(legendeHTML(analyse.tabel));
    if (analyse.tabel.uitleg.length) {
      delen.push(`<ul class="uitleg">${analyse.tabel.uitleg.map((z) => `<li>${ontsnap(z)}</li>`).join('')}</ul>`);
    }
  }
  if (analyse.besluit.length) {
    delen.push('<h3 class="besluit-titel">Besluit</h3>');
    delen.push(`<ul class="besluit">${analyse.besluit.map((l) => `<li>${M.formule(l)}</li>`).join('')}</ul>`);
  }
  houder.innerHTML = delen.join('');
}

function hornerHTML(h) {
  const waarde = (b) => (b ? M.formule(breukMathML(b)) : '');
  const laatste = h.boven.length - 1;
  const rij = (lijst, klasse = '') => lijst
    .map((b, i) => `<td class="${i === laatste ? 'rest-kolom' : ''} ${klasse}">${waarde(b)}</td>`)
    .join('');
  return `<table class="horner" aria-label="Schema van Horner"><tbody>
    <tr><td class="deler"></td>${rij(h.boven)}</tr>
    <tr><td class="deler">${waarde(h.deler)}</td>${rij(h.midden)}</tr>
    <tr class="onder"><td class="deler"></td>${rij(h.onder)}</tr>
  </tbody></table>`;
}

function stappenHTML(stappen) {
  if (!stappen.length) return '<p class="leeg">Voor deze functie zijn er geen stappen.</p>';
  const items = stappen.map((s) => {
    const formules = (s.formules ?? []).map((f) => `<div class="formule-regel">${M.regel(f)}</div>`).join('');
    const horner = s.horner ? hornerHTML(s.horner) : '';
    const inhoud = formules || horner ? `<div class="stap-formules">${formules}${horner}</div>` : '';
    return `<li class="stap"><h4 class="stap-titel">${ontsnap(s.titel)}</h4>${inhoud}<p class="stap-uitleg">${ontsnap(s.uitleg)}</p></li>`;
  });
  return `<ol class="stappen">${items.join('')}</ol>`;
}

export function toonBerekening(houder, analyse) {
  const nulpunten = `${stappenHTML(analyse.nulpunten.stappen)}<p class="besluit-zin">${M.formule(analyse.nulpunten.besluit)}</p>`;
  houder.innerHTML = `
    <details open>
      <summary>Domein en nulpunten</summary>
      ${nulpunten}
    </details>
    <details>
      <summary>Asymptoten</summary>
      ${stappenHTML(analyse.asymptoten.stappen)}
    </details>`;
}
