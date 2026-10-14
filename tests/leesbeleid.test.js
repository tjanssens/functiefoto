import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leesMetTerugval, moetGrondigerLezen, POGING } from '../js/leesbeleid.js';
import { isLeesbaar } from '../js/expressie.js';

const goed = { gevonden: true, functie: '(x^2 - 1)/(x + 2)', twijfel: '' };

/** Een nagebootste Claude: geeft per poging een vast antwoord of gooit een fout. */
function nepClaude(antwoorden) {
  const gevraagd = [];
  const vraag = async (poging) => {
    gevraagd.push(poging);
    const a = antwoorden[poging];
    if (a instanceof Error) throw a;
    return a;
  };
  return { vraag, gevraagd };
}

function leesFout(soort) {
  return Object.assign(new Error(soort), { soort });
}

test('moetGrondigerLezen_alleenBijNietGevondenTwijfelOfOnleesbaar', () => {
  assert.equal(moetGrondigerLezen(goed, isLeesbaar), false);
  assert.equal(moetGrondigerLezen({ ...goed, gevonden: false }, isLeesbaar), true);
  assert.equal(moetGrondigerLezen({ ...goed, functie: '' }, isLeesbaar), true);
  assert.equal(moetGrondigerLezen({ ...goed, twijfel: 'De 4 kan ook een 6 zijn.' }, isLeesbaar), true);
  assert.equal(moetGrondigerLezen({ ...goed, functie: '(x^2 - 1' }, isLeesbaar), true);
});

test('leesMetTerugval_snelModelZekerEnLeesbaar_geenTweedePoging', async () => {
  const claude = nepClaude({ [POGING.SNEL]: goed, [POGING.GRONDIG]: goed });
  let tweede = false;
  const r = await leesMetTerugval(claude.vraag, { isLeesbaar, bijTweedePoging: () => { tweede = true; } });
  assert.deepEqual(claude.gevraagd, [POGING.SNEL]);
  assert.equal(r.poging, POGING.SNEL);
  assert.equal(tweede, false);
});

test('leesMetTerugval_snelModelTwijfelt_grondigModelNeemtOver', async () => {
  const grondig = { ...goed, functie: '(x^3 - 1)/(4x^3 + 4x^2 + x)' };
  const claude = nepClaude({ [POGING.SNEL]: { ...goed, twijfel: 'De 4 kan ook een 6 zijn.' }, [POGING.GRONDIG]: grondig });
  let tweede = false;
  const r = await leesMetTerugval(claude.vraag, { isLeesbaar, bijTweedePoging: () => { tweede = true; } });
  assert.deepEqual(claude.gevraagd, [POGING.SNEL, POGING.GRONDIG]);
  assert.equal(r.functie, grondig.functie);
  assert.equal(r.poging, POGING.GRONDIG);
  assert.equal(tweede, true);
});

test('leesMetTerugval_snelModelVindtNiets_grondigModelNeemtOver', async () => {
  const claude = nepClaude({ [POGING.SNEL]: { gevonden: false, functie: '', twijfel: '' }, [POGING.GRONDIG]: goed });
  const r = await leesMetTerugval(claude.vraag, { isLeesbaar });
  assert.equal(r.poging, POGING.GRONDIG);
});

test('leesMetTerugval_onleesbareFormule_grondigModelNeemtOver', async () => {
  const claude = nepClaude({ [POGING.SNEL]: { ...goed, functie: 'sqrt(2x+5' }, [POGING.GRONDIG]: goed });
  const r = await leesMetTerugval(claude.vraag, { isLeesbaar });
  assert.equal(r.poging, POGING.GRONDIG);
});

test('leesMetTerugval_weigeringOfOnvolledigAntwoord_grondigModelNeemtOver', async () => {
  for (const soort of ['weigering', 'onleesbaar']) {
    const claude = nepClaude({ [POGING.SNEL]: leesFout(soort), [POGING.GRONDIG]: goed });
    const r = await leesMetTerugval(claude.vraag, { isLeesbaar });
    assert.equal(r.poging, POGING.GRONDIG, soort);
  }
});

test('leesMetTerugval_sleutelVerbindingOfGestopt_geenTweedePoging', async () => {
  for (const soort of ['sleutel', 'verbinding', 'limiet', 'geannuleerd', 'tegoed', 'overbelast', 'onbekend']) {
    const claude = nepClaude({ [POGING.SNEL]: leesFout(soort), [POGING.GRONDIG]: goed });
    await assert.rejects(leesMetTerugval(claude.vraag, { isLeesbaar }), (fout) => fout.soort === soort);
    assert.deepEqual(claude.gevraagd, [POGING.SNEL], soort);
  }
});

test('leesMetTerugval_grondigModelTwijfeltOok_resultaatMetTwijfelWordtGetoond', async () => {
  const twijfel = { ...goed, twijfel: 'De wortelstreep kan ook korter zijn.' };
  const claude = nepClaude({ [POGING.SNEL]: twijfel, [POGING.GRONDIG]: twijfel });
  const r = await leesMetTerugval(claude.vraag, { isLeesbaar });
  assert.equal(r.twijfel, twijfel.twijfel);
  assert.deepEqual(claude.gevraagd, [POGING.SNEL, POGING.GRONDIG]);
});

test('leesMetTerugval_keuzeTussenFunctiesZonderTwijfel_geenTweedePoging', async () => {
  const claude = nepClaude({ [POGING.SNEL]: { ...goed, keuze: 'Er staan twee functies; ik nam f.' }, [POGING.GRONDIG]: goed });
  const r = await leesMetTerugval(claude.vraag, { isLeesbaar });
  assert.deepEqual(claude.gevraagd, [POGING.SNEL]);
  assert.equal(r.keuze, 'Er staan twee functies; ik nam f.');
});

test('leesMetTerugval_grondigModelFaalt_leesbareLezingVanSnelModelBlijft', async () => {
  const twijfel = { ...goed, twijfel: 'De 4 kan ook een 6 zijn.' };
  const claude = nepClaude({ [POGING.SNEL]: twijfel, [POGING.GRONDIG]: leesFout('overbelast') });
  const r = await leesMetTerugval(claude.vraag, { isLeesbaar });
  assert.equal(r.poging, POGING.SNEL);
  assert.equal(r.twijfel, twijfel.twijfel);
});

test('leesMetTerugval_grondigModelFaaltEnSnelModelOnbruikbaar_foutGaatDoor', async () => {
  const claude = nepClaude({ [POGING.SNEL]: { gevonden: false, functie: '', twijfel: '' }, [POGING.GRONDIG]: leesFout('overbelast') });
  await assert.rejects(leesMetTerugval(claude.vraag, { isLeesbaar }), (fout) => fout.soort === 'overbelast');
});

test('leesMetTerugval_gestoptTijdensTweedePoging_foutGaatDoor', async () => {
  const claude = nepClaude({ [POGING.SNEL]: { ...goed, twijfel: 'Onzeker teken.' }, [POGING.GRONDIG]: leesFout('geannuleerd') });
  await assert.rejects(leesMetTerugval(claude.vraag, { isLeesbaar }), (fout) => fout.soort === 'geannuleerd');
});

test('isLeesbaar_geldigOfOngeldigVoorschrift', () => {
  assert.equal(isLeesbaar('sqrt(2x + 5) - x - 1'), true);
  assert.equal(isLeesbaar('(x^2 - 1'), false);
  assert.equal(isLeesbaar(''), false);
});
