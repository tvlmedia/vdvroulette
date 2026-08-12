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

- Totaal: 196
- Chaos: 33
- Make-up: 18
- Blinddoek: 21
- Cute: 23
- Flirty: 31
- Oohlala: 27
- Disney: 3
- Jacuzzi: 29
- Specials: 11

## Belangrijke metadata

- `level`: 1 t/m 5
- `timerSeconds`: compacte timer in de app
- `jacuzziAllowed`: Jacuzzi-geschiktheidsmetadata; `false` betekent nooit gebruiken in Jacuzzi-gerelateerde selectie
- `requiresJacuzzi`: kaart verschijnt alleen in Jacuzzi-modus
- `playerRestriction`: bijvoorbeeld `player_1`, `man`, `vrouw`, `male` of `female`
- `specialType`: koppeling met speciale softwareflow
- `upgradeText`: spannendere variant
- `lighterText`: lichtere variant
- `safetyNote`: korte veiligheidsmelding
- `enabled`: optioneel, `false` schakelt een kaart tijdelijk uit zonder hem te verwijderen
- `weight`: optioneel, 0 t/m 2 voor lokale zeldzaamheid
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
