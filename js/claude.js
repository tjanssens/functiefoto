/**
 * De enige plek waar AI gebruikt wordt: Claude leest de functie van een foto of van het tekenblad.
 * De afbeelding gaat met de API-sleutel van dit toestel rechtstreeks naar de Claude API.
 */
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.129.0/+esm';
const MODEL = 'claude-opus-5-5';
/** Langste zijde van een afbeelding voor Claude, in pixels. */
export const MAX_ZIJDE = 1568;
const JPEG_KWALITEIT = 0.88;
const MAX_TOKENS = 8000;

const SCHEMA = {
  type: 'object',
  properties: {
    gevonden: { type: 'boolean' },
    functie: { type: 'string' },
    twijfel: { type: 'string' },
  },
  required: ['gevonden', 'functie', 'twijfel'],
  additionalProperties: false,
};

const OPDRACHT = `Op deze afbeelding staat wiskunde van een leerling uit het secundair onderwijs in Vlaanderen: een foto uit een schrift of handboek, of iets dat met een pen of vinger op een tablet geschreven is. Een foto kan gedraaid, scheef of wat onscherp zijn.

Zoek het functievoorschrift. Het staat er bijvoorbeeld als f: x ↦ …, als f(x) = …, of als een losse breuk of uitdrukking in x. Staan er ook berekeningen bij, neem dan het functievoorschrift en niet een tussenstap.

Schrijf het voorschrift, zonder "f(x) =", in deze schrijfwijze:
- x is de enige variabele
- ^ voor machten, bijvoorbeeld x^3
- sqrt(…) voor een vierkantswortel, met alles wat onder de wortelstreep staat tussen de haakjes
- root(…, n) voor een n-de machtswortel
- abs(…), sin(…), cos(…), tan(…), ln(…), log(…) en exp(…) voor die functies
- vermenigvuldigen mag zonder teken: 2x en 3(x + 1)
- een breukstreep als /, met haakjes rond de volledige teller en de volledige noemer, bijvoorbeeld (x^3 - 1)/(4x^3 + 4x^2 + x)
- een punt als decimaalteken

Vul in:
- gevonden: true als je een functievoorschrift ziet, anders false
- functie: het voorschrift in die schrijfwijze, of een lege tekst
- twijfel: één korte Nederlandse zin als je een teken niet zeker kon lezen (welk teken en wat het anders zou kunnen zijn), of als er meerdere functies op de afbeelding staan (welke je nam). Anders een lege tekst.`;

export class LeesFout extends Error {
  /** @param {'geannuleerd'|'sleutel'|'limiet'|'tegoed'|'overbelast'|'verbinding'|'weigering'|'onleesbaar'|'onbekend'} soort */
  constructor(soort, bericht) {
    super(bericht);
    this.name = 'LeesFout';
    this.soort = soort;
  }
}

let sdk = null;

async function laadSdk() {
  if (!sdk) {
    try {
      sdk = (await import(SDK_URL)).default;
    } catch (fout) {
      console.error('De Anthropic SDK kon niet geladen worden', fout);
      throw new LeesFout('verbinding', 'Geen verbinding met Claude. Controleer het internet en probeer opnieuw.');
    }
  }
  return sdk;
}

function naarBase64(blob) {
  return new Promise((resolve, reject) => {
    const lezer = new FileReader();
    lezer.onload = () => resolve(String(lezer.result).split(',')[1]);
    lezer.onerror = () => reject(lezer.error);
    lezer.readAsDataURL(blob);
  });
}

/** Verkleint de afbeelding tot hoogstens MAX_ZIJDE pixels en maakt er een JPEG van. */
async function verkleinAfbeelding(bestand) {
  const beeld = await createImageBitmap(bestand, { imageOrientation: 'from-image' });
  try {
    const schaal = Math.min(1, MAX_ZIJDE / Math.max(beeld.width, beeld.height));
    const doek = document.createElement('canvas');
    doek.width = Math.round(beeld.width * schaal);
    doek.height = Math.round(beeld.height * schaal);
    doek.getContext('2d').drawImage(beeld, 0, 0, doek.width, doek.height);
    const blob = await new Promise((resolve) => doek.toBlob(resolve, 'image/jpeg', JPEG_KWALITEIT));
    if (!blob) throw new LeesFout('onleesbaar', 'Deze afbeelding kan niet gelezen worden. Probeer een andere foto of schrijf de functie opnieuw.');
    return naarBase64(blob);
  } finally {
    beeld.close();
  }
}

function maakClient(Anthropic, apiSleutel) {
  return new Anthropic({ apiKey: apiSleutel, dangerouslyAllowBrowser: true, maxRetries: 1 });
}

function vertaalFout(Anthropic, fout) {
  if (fout instanceof LeesFout) return fout;
  if (fout instanceof Anthropic.APIUserAbortError) return new LeesFout('geannuleerd', 'Lezen gestopt.');
  if (fout instanceof Anthropic.AuthenticationError) return new LeesFout('sleutel', 'De API-sleutel klopt niet. Kijk hem na bij Instellingen.');
  if (fout instanceof Anthropic.PermissionDeniedError) return new LeesFout('sleutel', 'Deze API-sleutel mag het model niet gebruiken. Kijk de sleutel na bij Instellingen.');
  if (fout instanceof Anthropic.RateLimitError) return new LeesFout('limiet', 'Even te veel vragen na elkaar. Wacht een minuut en probeer opnieuw.');
  if (fout instanceof Anthropic.BadRequestError) {
    console.error('Claude weigerde de vraag (400)', fout);
    return new LeesFout('tegoed', 'Claude kon de vraag niet verwerken. Kijk na of er nog tegoed op het API-account staat.');
  }
  if (fout instanceof Anthropic.InternalServerError) return new LeesFout('overbelast', 'Claude is even overbelast. Probeer het zo opnieuw.');
  if (fout instanceof Anthropic.APIConnectionError) return new LeesFout('verbinding', 'Geen verbinding met Claude. Controleer het internet en probeer opnieuw.');
  if (fout instanceof Anthropic.APIError) return new LeesFout('onbekend', `Claude gaf een onverwachte fout (${fout.status ?? 'zonder code'}). Probeer opnieuw.`);
  return fout;
}

/**
 * Leest de functie van een afbeelding (foto of tekenblad).
 * @returns {Promise<{gevonden: boolean, functie: string, twijfel: string}>}
 */
export async function leesFunctie(bestand, apiSleutel, signal) {
  const Anthropic = await laadSdk();
  const afbeelding = await verkleinAfbeelding(bestand);
  const client = maakClient(Anthropic, apiSleutel);
  let antwoord;
  try {
    antwoord = await client.beta.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: afbeelding } },
          { type: 'text', text: OPDRACHT },
        ],
      }],
    }, { signal });
  } catch (fout) {
    throw vertaalFout(Anthropic, fout);
  }
  if (antwoord.stop_reason === 'refusal') {
    throw new LeesFout('weigering', 'Claude wilde deze afbeelding niet lezen. Probeer opnieuw of typ de functie.');
  }
  const tekst = antwoord.content.find((blok) => blok.type === 'text')?.text;
  let resultaat;
  try {
    resultaat = JSON.parse(tekst ?? '');
  } catch (fout) {
    console.warn('Het antwoord van Claude was geen geldige JSON', { stop_reason: antwoord.stop_reason, tekst }, fout);
    throw new LeesFout('onleesbaar', 'Het antwoord van Claude was onvolledig. Probeer opnieuw.');
  }
  return {
    gevonden: resultaat.gevonden === true,
    functie: typeof resultaat.functie === 'string' ? resultaat.functie.trim() : '',
    twijfel: typeof resultaat.twijfel === 'string' ? resultaat.twijfel.trim() : '',
  };
}

/** Controleert of de sleutel werkt, zonder een afbeelding te versturen. */
export async function testSleutel(apiSleutel) {
  const Anthropic = await laadSdk();
  try {
    await maakClient(Anthropic, apiSleutel).models.retrieve(MODEL);
  } catch (fout) {
    throw vertaalFout(Anthropic, fout);
  }
}
