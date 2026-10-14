/**
 * Welk model leest de functie: eerst het snelle, en alleen als dat niet lukt het grondige.
 * Het grondige model probeert het opnieuw als het snelle model geen functie vindt, twijfelt
 * over een teken, iets teruggeeft dat de pagina niet kan lezen, of de afbeelding weigert of
 * onvolledig antwoordt. Kiezen tussen meerdere functies is geen twijfel: dat kan het grondige
 * model niet beter. Bij andere fouten (verbinding, sleutel, tegoed, te veel vragen, gestopt)
 * helpt een tweede model niet.
 */

export const POGING = Object.freeze({ SNEL: 'snel', GRONDIG: 'grondig' });

/** Soorten LeesFout waarbij het grondige model het nog mag proberen. */
const FOUTEN_VOOR_TWEEDE_POGING = new Set(['weigering', 'onleesbaar']);
const GESTOPT = 'geannuleerd';

/** Moet het grondige model het opnieuw proberen na dit resultaat van het snelle model? */
export function moetGrondigerLezen(resultaat, isLeesbaar) {
  if (!resultaat.gevonden || !resultaat.functie) return true;
  if (resultaat.twijfel) return true;
  return !isLeesbaar(resultaat.functie);
}

function isBruikbaar(resultaat, isLeesbaar) {
  return Boolean(resultaat?.gevonden && resultaat.functie && isLeesbaar(resultaat.functie));
}

/**
 * Leest met het snelle model en valt zo nodig terug op het grondige.
 * Lukt de tweede poging niet, dan blijft een leesbare lezing van het snelle model over,
 * met haar twijfel erbij: dat is beter dan een foutmelding.
 * @param {(poging: string) => Promise<{gevonden: boolean, functie: string, twijfel: string, keuze?: string}>} vraag
 * @param {{ isLeesbaar?: (functie: string) => boolean, bijTweedePoging?: () => void }} opties
 */
export async function leesMetTerugval(vraag, { isLeesbaar = () => true, bijTweedePoging } = {}) {
  let eerste = null;
  try {
    eerste = await vraag(POGING.SNEL);
    if (!moetGrondigerLezen(eerste, isLeesbaar)) return { ...eerste, poging: POGING.SNEL };
  } catch (fout) {
    if (!FOUTEN_VOOR_TWEEDE_POGING.has(fout?.soort)) throw fout;
    console.warn('Het snelle model kon de afbeelding niet lezen; het grondige model probeert het', fout);
  }
  bijTweedePoging?.();
  try {
    return { ...(await vraag(POGING.GRONDIG)), poging: POGING.GRONDIG };
  } catch (fout) {
    if (fout?.soort === GESTOPT || !isBruikbaar(eerste, isLeesbaar)) throw fout;
    console.warn('Het grondige model kon niet helpen; de lezing van het snelle model blijft', fout);
    return { ...eerste, poging: POGING.SNEL };
  }
}
