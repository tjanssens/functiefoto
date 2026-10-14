# Functiefoto

Neem een foto van een functie uit je schrift, of schrijf ze met je pen of vinger op het tekenblad, en krijg meteen:

- de **grafiek**, met nulpunten en asymptoten, om in te zoomen en waarden af te lezen;
- de **tekentabel**, met enkel factoren van de eerste en tweede graad en bij elke rij of ze uit de teller, de noemer of de wortel komt;
- de **berekening** van het domein, de nulpunten (BV, KV, Horner, discriminant) en de asymptoten, met één zin uitleg per stap.

Alleen het lezen van de foto of van het tekenblad gebeurt door Claude. Al het rekenwerk doet de pagina zelf, op het toestel.

## Het tekenblad

- Tik op **Tekenblad**: er komt een wit vel over het hele scherm.
- Schrijf de functie met de Apple Pencil of met je vinger. Met de pen tekent een hand op het scherm niet mee.
- **Gom** veegt een hele streep weg. **Ongedaan maken** zet elke handeling terug, ook gommen en **Alles wissen**.
- Tik op **Lees de functie**. Claude leest alleen het beschreven stuk, de ruitjes gaan niet mee.
- De tekening blijft bewaard. Klopt de gelezen formule niet, open dan het tekenblad opnieuw en verbeter ze.

## Op de iPad zetten

1. Open de pagina in Safari.
2. Tik op het deelicoon en kies **Zet op beginscherm**.
3. Open Functiefoto via het nieuwe icoon en kies **Instellingen**.
4. Plak de API-sleutel, tik op **Bewaren** en daarna op **Testen**.

De sleutel moet in de app op het beginscherm ingevuld worden: die bewaart haar gegevens los van Safari.

## De API-sleutel

- Maak een sleutel aan op [console.anthropic.com](https://console.anthropic.com), bij voorkeur in een eigen workspace met een maandlimiet van een paar euro.
- De sleutel blijft alleen op het toestel waar ze ingevuld is. Wie dat toestel gebruikt, kan ze wel achterhalen; daarom die limiet.
- Een foto of tekenblad lezen kost ongeveer 1 à 2 cent.

## Welke functies?

| Soort | Wat je krijgt |
|---|---|
| Veeltermfuncties | Exacte nulpunten (proberen, Horner, discriminant), tekentabel per factor |
| Rationale functies P/Q | BV, domein, nulpunten, tekentabel met teller- en noemerfactoren, VA, HA of SA, perforaties |
| Wortelfuncties a·√(…) + … | BV, KV, kwadrateren, valse oplossingen, tekentabel, HA of SA bij een tweedegraadsveelterm onder de wortel |
| Andere functies (sin x, 2ˣ, …) | Grafiek en een benaderde tekentabel tussen −10 en 10, zonder stappen |

## Stijlen

Kies rechtsboven een stijl: **Athene**, **Minecraft**, **Galileo**, **Escher** of **Mario**. De stijl kleurt alleen het scherm; de grafiek en de tabel blijven neutraal.

## Voor ontwikkelaars

Zie [CLAUDE.md](CLAUDE.md) voor de opbouw en de commando's.
