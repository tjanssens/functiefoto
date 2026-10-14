# Functiefoto

Webpagina voor Mil (secundair onderwijs, Vlaanderen): een foto van een functie wordt door Claude gelezen; de pagina rekent zelf de grafiek, de tekentabel, de nulpunten (met stappen) en de asymptoten uit. Draait als statische site op GitHub Pages en wordt op een iPad aan het beginscherm toegevoegd.

Volg ook de globale codekwaliteitsregels uit `~/.claude/CLAUDE.md`.

## Commando's

- Tests: `npm test` (Node 20+, gebruikt `node --test`, geen dependencies)
- Lokaal bekijken: `python gereedschap/server.py` en open http://localhost:8123 (server zonder cache)
- Iconen opnieuw maken: `python gereedschap/maak_iconen.py` (vereist Pillow)
- Publiceren: push naar `main`; GitHub Pages serveert de map zoals ze is (geen build)

## Opbouw

Gewone ES-modules zonder bundler; alles in het Nederlands benoemd.

| Bestand | Rol |
|---|---|
| `js/getal.js` | Exacte breuken (BigInt) en wortelgetallen a + b·√d |
| `js/opmaak.js` | MathML-bouwstenen en Vlaamse getalnotatie (komma, echt minteken) |
| `js/expressie.js` | Invoer normaliseren, ontleden tot een boom, compileren naar x → f(x), MathML |
| `js/veelterm.js` | Veeltermen: rekenen, staartdeling, Horner, opmaak |
| `js/factoren.js` | Ontbinden in factoren van graad 1 en 2, met de stappen uit de klas |
| `js/symbolisch.js` | Herkent P/Q (rationaal) en C·√A + B (wortelfunctie) |
| `js/tabel.js` | Tekens per kolom, intervallen, besluit |
| `js/asymptoten.js` | VA, HA en SA met uitleg |
| `js/analyse.js` | Volledige analyse per soort: veelterm, rationaal, wortel, anders numeriek |
| `js/numeriek.js` | Nulpunten zoeken, tabel nacontroleren, venster en lijnstukken van de grafiek |
| `js/grafiek.js` | SVG-grafiek met slepen, knijpen, Ctrl+wiel en aflezen |
| `js/weergave.js` | HTML voor formule, tekentabel en stappen |
| `js/claude.js` | Enige AI-aanroep: foto → functievoorschrift (Anthropic SDK via jsDelivr) |
| `js/instellingen.js` | API-sleutel en stijl in localStorage |
| `js/app.js` | Koppelt alles aan de pagina |
| `css/basis.css` | Opbouw en neutrale onderdelen |
| `css/stijlen.css` | De vier stijlen: Athene, Minecraft, Galileo, Escher |

## Afspraken

- **AI leest alleen.** Claude levert enkel het voorschrift; alle wiskunde gebeurt in de pagina. Geen analyse naar Claude verplaatsen.
- **Exact waar het kan.** Nulpunten blijven exacte `Getal`-waarden; alleen als er geen rationaal nulpunt is, wordt benaderd (en dat staat er dan bij).
- **Tekentabel:** enkel rijen van graad 1 of 2, telkens met de herkomst (teller, noemer, onder de wortel, buiten de wortel, na kwadrateren). De f-rij wordt exact afgeleid en daarna numeriek nagecontroleerd (`controleerTabel`); een verschil wordt in de pagina gemarkeerd.
- **Stappen:** elke stap heeft een titel, formules en precies één zin uitleg. Schoolnotatie: BV, KV, ]a, b[, decimale komma.
- **Stijlen** kleuren alleen het scherm rond het "papier"; grafiek, tabel en berekening blijven neutraal. Een nieuwe stijl = tokens + versiering in `css/stijlen.css` en een item in `STIJLEN` (`js/instellingen.js`).
- **Geen sleutels in de code.** De API-sleutel wordt op het toestel ingevuld en blijft in localStorage.
- Nederlandse teksten zonder gedachtestreepjes.
