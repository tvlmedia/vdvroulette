# Date Roulette – kaartdatabase

Deze map bevat de opgeschoonde, modulaire kaartdatabase voor de Date Roulette-webapp.

## Inhoud

- `chaos.js`
- `makeup.js`
- `blindfold.js`
- `cute.js`
- `flirty.js`
- `oohlala.js`
- `disney.js`
- `jacuzzi.js`
- `special.js`
- `index.js`
- `rules.js`

## Gebruik

```js
import { ALL_CARDS, CARD_COUNTS, validateCards } from "./cards/index.js";
import { GAME_RULES } from "./cards/rules.js";

console.log(CARD_COUNTS);
console.log(validateCards());
```

## Aantallen

- Totaal: 144
- Chaos: 13
- Make-up: 12
- Blinddoek: 16
- Cute: 19
- Flirty: 24
- Oohlala: 19
- Disney: 2
- Jacuzzi: 28
- Specials: 11

## Belangrijke metadata

- `level`: 1 t/m 5
- `timerSeconds`: compacte timer in de app
- `jacuzziAllowed`: gewone kaart mag in Jacuzzi-modus verschijnen
- `requiresJacuzzi`: kaart verschijnt alleen in Jacuzzi-modus
- `playerRestriction`: bijvoorbeeld `player_1`
- `specialType`: koppeling met speciale softwareflow
- `upgradeText`: spannendere variant
- `lighterText`: lichtere variant
- `safetyNote`: korte veiligheidsmelding
- `contentTags`: toekomstige filtering
- `intensity`: alleen bij Jacuzzi-kaarten

## Veiligheidsaanpassingen

Een paar opdrachten zijn bewust licht aangepast:
- geen zoenen onder water;
- niets om de nek aantrekken;
- geen stevig vastbinden of vastmaken aan meubels;
- geen kleine harde snoepjes zoeken met blinddoek;
- eten en make-up niet in de jacuzzi;
- ijs slechts kort en bewegend gebruiken;
- “alles doen” is vervangen door concrete, afgesproken handelingen.

De speelse bedoeling is behouden, maar de directe risico’s zijn verminderd.
