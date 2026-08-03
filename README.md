# Date Roulette

Date Roulette is een mobile-first kaartspel voor twee spelers. Deze versie bevat de basisgame, LocalStorage-opslag, levelprogressie per speler, categorie-unlocks, timerkaarten, volledige Jacuzzi-modus, instellingen, statistieken, ontwikkelmodus, lokale speeltestexport, optionele kaartbeoordeling en een herbruikbare engine voor speciale kaarten.

Huidige appversie: `v1.3.4`.

## Bestandstructuur

- `index.html`: schermen voor home, spelers instellen, spel, instellingen, statistieken, level-unlockmodal en special-cardmodal.
- `styles.css`: mobiele premium-styling, glassmorphism, kaartflip, voortgangsbalken, chips, selectiemodals en special-flowstijlen.
- `app.js`: ES-module met spelengine, migratie, levelberekening, kaartselectie, Jacuzzi-logica, timers, special-cardengine, instellingen en statistieken.
- `cards/`: definitieve modulaire kaartdatabase met 144 kaarten, `CARD_COUNTS`, `validateCards()` en `GAME_RULES`.
- `manifest.webmanifest`: PWA-manifest voor installatie als standalone app.
- `service-worker.js`: offline cache en updateafhandeling met cacheversie `date-roulette-v1.3.4`.
- `icons/`: lokale SVG- en PNG-iconen voor Android, iOS en maskable PWA-installatie.
- `card-audit.md`: gegenereerd auditoverzicht van de huidige kaartdatabase.
- `BUGFIX_REPORT.md`: overzicht van opgeloste betrouwbaarheidspunten en testresultaten.
- `VISUAL_POLISH_REPORT.md`: overzicht van de visuele, mobiele en PWA-afwerkingslaag.
- `tests/run-tests.mjs`: lichte Node-test runner voor kernlogica.
- `package.json`: alleen voor `npm test`; de app heeft geen buildstap.
- `README.md`: projectuitleg en publicatie-instructies.

## Lokaal starten

Start een simpele lokale server vanuit deze map:

```bash
python3 -m http.server 8787
```

Open daarna:

```text
http://localhost:8787
```

Rechtstreeks dubbelklikken op `index.html` kan door browserbeveiliging rond ES-modules de kaartimports blokkeren. GitHub Pages werkt wel normaal.

## PWA-installatie en offline gebruik

De app is installeerbaar als Progressive Web App via `manifest.webmanifest`. Op Android/Chrome verschijnt waar ondersteund een subtiele eigen prompt: `Zet Date Roulette op je beginscherm`. Op iPhone Safari toont de app alleen een korte uitleg om via Delen naar `Zet op beginscherm` te gaan.

Na het eerste bezoek cachet `service-worker.js` de app-shell, kaartmodules, manifest en lokale iconen onder cacheversie `date-roulette-v1.3.4`. Navigatie gebruikt network-first, zodat online bezoeken verse HTML ophalen. Offline valt de app terug op de gecachte `index.html`; assets worden cache-first geladen en op de achtergrond bijgewerkt.

Bij een nieuwe service worker toont de app `Er is een update beschikbaar.` met een knop `Nu vernieuwen`. Vernieuwen gebeurt alleen na een tik en vraagt bevestiging als er nog een actieve ronde bezig is.

## Thema's, geluid en haptiek

In Instellingen staan twee thema's:

- Luxe donker: bordeaux, goud en roze, bedoeld als standaard partygame-look.
- Zacht romantisch: lichtere warme achtergrond met voldoende contrast.

Het gekozen thema wordt opgeslagen in LocalStorage. Geluid en trillingen zijn apart uit te schakelen. De korte geluiden worden via Web Audio gemaakt na een gebruikersinteractie; er zijn geen externe audiobestanden of muziek.

## Fullscreen en Wake Lock

Instellingen bevat `Fullscreenmodus` en `Scherm wakker houden tijdens spelen`. Fullscreen gebruikt de Fullscreen API wanneer de browser dit ondersteunt. Op iPhone is echte fullscreen beperkt; installeren op het beginscherm geeft daar meestal de beste ervaring.

Wake Lock gebruikt `navigator.wakeLock.request("screen")` wanneer beschikbaar. De app vraagt Wake Lock alleen aan tijdens actieve gameplay, laat hem los buiten het spelscherm of bij achtergrondgebruik en probeert opnieuw wanneer de app terugkomt.

## Speeltesttools

In Instellingen staat `Kaarten beoordelen tijdens spelen`. Deze optie staat standaard uit. Wanneer hij aanstaat, verschijnt bij een actieve kaart een klein menu `Kaart beoordelen` met lokale keuzes: leuk, matig, niet leuk, werkte niet en onduidelijk.

Alle ratings blijven lokaal in `dateRoulette.cardRatings`. Er is geen analytics, backend of cloudopslag.

Bij iedere actieve normale kaart staat ook `Report kaart`. Hiermee kan lokaal een probleem en verbeterde kaarttekst worden ingevuld; de app maakt een JSON-payload die in Codex of ChatGPT geplakt kan worden om de juiste kaart in `cards/` te corrigeren.

Instellingen bevat ook:

- `Exporteer speeltest`: downloadt lokaal JSON met appversie, datum, speeltijd, kaartgeschiedenis, niet-gedaan kaarten, kusjes, ratings, levelprogressie, Jacuzzi-gebruik, Specials, notities en instellingen.
- `Exporteer leesbaar rapport`: downloadt lokaal Markdown met leukste kaarten, minst leuke kaarten, vaakst niet gedaan, praktisch/onduidelijk gemarkeerde kaarten, meest gespeelde categorie, kaarten per level en eindnotities.

Op het eindscherm staat een klein notitieveld voor de volgende speeltest. Dit wordt lokaal opgeslagen bij de ronde en meegenomen in de export.

## Iconen vervangen

De huidige iconen zijn lokaal gegenereerde eigen assets:

- `icons/icon.svg`
- `icons/icon-192.png`
- `icons/icon-512.png`
- `icons/maskable-192.png`
- `icons/maskable-512.png`
- `icons/apple-touch-icon.png`

Vervang deze bestanden met dezelfde namen en formaten als je later een definitief logo wilt gebruiken. Houd het icoon zonder kleine tekst, zodat het leesbaar blijft op homescreens.

## Publiceren via GitHub Pages

1. Zet deze bestanden in een GitHub repository.
2. Ga in GitHub naar `Settings`.
3. Open `Pages`.
4. Kies bij `Build and deployment` voor `Deploy from a branch`.
5. Selecteer de branch, meestal `main`, en de root-folder.
6. Sla op. GitHub Pages publiceert daarna de statische app.

Er is geen backend, buildstap of framework nodig.

Voor GitHub Pages moet `start_url` in het manifest op `./` blijven staan. De service worker gebruikt relatieve paden, waardoor publicatie vanuit de repository-root werkt zonder extra buildconfiguratie.

## Tests draaien

De app blijft statisch, maar de kernlogica kan lokaal worden getest met:

```bash
npm test
```

De test-runner laadt `cards/` en `app.js` met lichte browser-stubs en controleert onder andere leveldrempels, kaartvalidatie, Jacuzzi-filters, player restrictions, Roulette, Perfecte Run, migratie en statistiekherstel.

## Nieuwe kaarten toevoegen

Voeg kaarten toe aan het juiste categoriebestand in `cards/` en exporteer ze via `cards/index.js`.

```js
{
  id: "flirty_001",
  category: "flirty",
  emoji: "😏",
  title: "Dicht bij elkaar",
  text: "De ander kiest hoe jullie de komende vijf minuten knuffelen.",
  level: 2,
  timerSeconds: 300,
  jacuzziAllowed: true,
  requiresJacuzzi: false,
  repeatable: false,
  upgradeText: null,
  lighterText: null,
  specialType: null,
  playerRestriction: null
}
```

Elke kaart heeft een unieke `id` nodig. De app bewaart gebruikte kaart-ID's per spel, zodat kaarten niet dubbel verschijnen voordat er opnieuw wordt geschud.

Bij het instellen van spelers wordt naast de naam ook `gender` opgeslagen als `vrouw` of `man`. Kaarten met `playerRestriction: "vrouw"` verschijnen alleen bij spelers die als vrouw zijn ingesteld; `playerRestriction: "man"` werkt hetzelfde voor man.

Timerkaarten tellen af op echte seconden. Als een lopende timerkaart met `Gedaan` wordt afgerond, blijft de timer doorlopen in `Lopende timers` met resterende tijd, speler, opdracht en eindtijd. Deze timers blijven ook na de volgende opdracht of een refresh zichtbaar totdat ze klaar zijn of handmatig worden weggehaald.

Gebruik in ontwikkelmodus de knop `Kaartvalidator draaien` om schemafouten en waarschuwingen in de console te zien. De huidige validator controleert onder andere unieke IDs, categorieen, levels, timers, booleanvelden, player restrictions, Jacuzzi-metadata, Special-types, dubbele opdrachtteksten, mogelijke HTML en tijdelijke testdatabase-markers.

## Kaartvelden

- `id`: unieke technische naam van de kaart.
- `category`: categorie-ID, bijvoorbeeld `chaos`, `cute`, `makeup`, `flirty`, `blindfold`, `oohlala`, `disney`, `jacuzzi` of `special`.
- `emoji`: emoji die groot op de kaart wordt getoond.
- `title`: korte titel van de kaart.
- `text`: opdrachttekst voor de speler.
- `level`: minimumlevel waarop de kaart beschikbaar wordt.
- `timerSeconds`: optionele timer in seconden. Gebruik `null` als er geen timer nodig is.
- `jacuzziAllowed`: Jacuzzi-geschiktheidsmetadata uit de kaartdatabase; `false` betekent nooit gebruiken in Jacuzzi-gerelateerde selectie.
- `requiresJacuzzi`: `true` als de kaart alleen in Jacuzzi-modus mag verschijnen.
- `repeatable`: toekomstige markering voor kaarten die vaker terug mogen komen.
- `upgradeText`: tekst voor een spannendere variant, gebruikt door `doubleSpicy`.
- `lighterText`: tekst voor een lichtere variant, gebruikt door `lighterVersion`.
- `specialType`: optioneel type voor speciale spelregels.
- `contentTags`: tags voor filtering en audits.
- `intensity`: optionele Jacuzzi-intensiteit, bijvoorbeeld `fun`, `cute`, `flirty` of `oohlala`.
- `safetyNote`: korte veiligheidsmelding die subtiel op de kaart wordt getoond.
- `playerRestriction`: optioneel. Mogelijke waarden: `null`, `player_1`, `player_2`, `winnie`, `tijgertje`, `man`, `vrouw` en aliases zoals `male` of `female`.

## Special Types

De centrale functie `handleSpecialCard(card, gameState)` start de juiste flow op basis van `specialType`.

Ondersteunde waarden:

- `gift`: cadeautje met knuffel, kus of massage.
- `golden`: eigen opdracht met optionele timer.
- `wild`: attribuut uit de tas, daarna eigen opdracht vastleggen.
- `winnieChoice`: player_1/Winnie-rol bepaalt vijf minuten.
- `tijgertjeChoice`: player_2/Tijgertje-rol bepaalt vijf minuten.
- `flirtyChoice`: kies één beschikbare Flirty-kaart.
- `playWithTension`: kies een eerder geweigerde opdracht.
- `lighterVersion`: kies een eerder geweigerde kaart met `lighterText`.
- `roulette`: andere speler kiest drie opdrachten uit maximaal tien gewone kaarten.
- `perfectRun`: vijf gewone kaarten achter elkaar, stop bij één keer niet gedaan.
- `doubleSpicy`: kies een voltooide kaart met `upgradeText`.

Special-levels:

- Level 1: `gift`, `golden`, `wild`.
- Level 2: `winnieChoice`, `tijgertjeChoice`.
- Level 3: `flirtyChoice`.
- Level 4: `playWithTension`, `lighterVersion`.
- Level 5: `roulette`, `perfectRun`, `doubleSpicy`.

## Game State

De huidige state gebruikt `stateVersion: 6`. Oude opslag uit versie 1, 2, 3, 4 en 5 wordt bij openen automatisch gemigreerd.

Belangrijke velden:

- `players`: spelers met `id`, `name`, `gender`, `completedCards` en `lipstickKisses`.
- `currentPlayerIndex`: speler die aan de beurt is.
- `currentLevel`: het verdiende level op basis van spelerprogressie.
- `unlockedLevels`: levels waarvan de unlockmelding al is verwerkt.
- `levelSystemEnabled`: bepaalt of levels actief filteren.
- `jacuzziMode` en `jacuzziModeStartedAt`: status en tijdmeting voor Jacuzzi-modus.
- `usedCardIds`: getrokken kaarten die niet opnieuw mogen verschijnen.
- `completedCardIds` en `skippedCardIds`: afgeronde en niet-gedane kaart-ID's.
- `temporaryRejectedCardIds`: tijdelijk vervangen Jacuzzi-kaarten binnen dezelfde beurt.
- `specialSession`: actieve special-flow, inclusief type, gekozen kaarten, huidige stap, resultaten en timer.
- `cardHistory`: rijke geschiedenis van afgeronde, geweigerde en vervangen kaarten.
- `activePerfectRun`: korte mirror van de actieve Perfecte Run voor herstel en debugging.
- `activeTimers`: timers die na een afgeronde opdracht doorlopen, inclusief eindtijd.
- `lipstickEvents`: log van lippenstiftstraffen met reason.
- `pendingTurnAdvance` en `turnAdvanceDueAt`: herstellen een geplande beurtwissel veilig na refresh.
- `roundNotes`: optionele lokale speeltestnotitie van maximaal 2.000 tekens.
- `statistics`: samenvatting van getrokken kaarten, unlocks, Jacuzzi-tijd en vervangingen.

Beschadigde JSON in LocalStorage wordt niet meer stil genegeerd. De app zet de corrupte raw data eerst apart onder `dateRoulette_corruptBackup_[timestamp]` en bouwt daarna een veilige fallback-state op.

Voorbeeld van `specialSession`:

```js
{
  type: "roulette",
  parentCardId: "special_roulette_001",
  playerIndex: 0,
  selectedCardIds: ["cute_001", "flirty_001", "chaos_002"],
  currentStep: 1,
  results: ["completed"],
  startedAt: 0
}
```

Voorbeeld van `cardHistory`:

```js
{
  cardId: "flirty_001",
  parentSpecialCardId: null,
  playerIndex: 0,
  result: "completed",
  variant: "normal",
  timestamp: 0
}
```

Varianten zijn `normal`, `roulette`, `perfectRun`, `redemption`, `upgrade`, `lighter`, `golden` en `wild`. Resultaten zijn `completed`, `skipped` en `replaced`.

## Levels

Levelprogressie wordt bepaald door de speler met de laagste voortgang.

```js
const levelRequirements = {
  1: 0,
  2: 4,
  3: 8,
  4: 10,
  5: 16
};
```

Voorbeeld: Level 3 is pas actief wanneer beide spelers minimaal 8 kaarten hebben afgerond. Level 4 opent bij 10 kaarten per speler. Als Winnie 12 kaarten heeft afgerond en Tijgertje 7, blijft het spel op Level 2.

Een kaart telt als afgerond bij zowel `Gedaan` als `Niet gedaan`. Bij een nieuw level verschijnt een unlockmodal eenmalig. Als het levelsysteem uitstaat, behandelt de kaartselectie het effectieve level als Level 5, maar de persoonlijke voortgang blijft intern doorlopen.

## Jacuzzi-selectie

Wanneer Jacuzzi-modus uitstaat:

- kaarten met `requiresJacuzzi: true` verschijnen niet;
- gewone kaarten volgen het huidige level;
- `jacuzziAllowed` is dan niet relevant.

Wanneer Jacuzzi-modus aanstaat:

- kaarten met `requiresJacuzzi: true` mogen verschijnen;
- Bubble Cards en `Wellness of Chaos` worden meegenomen via hun metadata;
- gewone kaarten zonder `requiresJacuzzi` verschijnen niet in de hoofd-Jacuzzi-modus;
- kaarten met een te hoog level blijven geblokkeerd;
- player restrictions blijven gelden.

De knop `Niet handig in de jacuzzi` trekt een andere geschikte kaart zonder kusje, beurtwissel of voortgang. De vervangen kaart wordt niet definitief als gebruikt opgeslagen en kan later opnieuw terugkomen.

Special-kaarten gebruiken dezelfde eligibility-filters. Roulette, Flirty-keuze en Perfecte Run trekken dus geen kaarten die door level, Jacuzzi-modus, spelerrol of geslacht via `playerRestriction` ongeschikt zijn.

## Upgrade en Lichter

`upgradeText` is de daadwerkelijke opdracht voor `doubleSpicy`. De modal toont de oorspronkelijke kaart en de spannendere variant.

`lighterText` is de daadwerkelijke opdracht voor `lighterVersion`. De oorspronkelijke weigering blijft historisch bewaard; de lichtere versie wordt apart in `cardHistory` vastgelegd met variant `lighter`.

Roulette laat de andere speler drie opdrachten kiezen uit maximaal tien gewone geschikte kaarten. Flirty-keuze probeert eerst eerder gespeelde Flirty-kaarten te vermijden en valt alleen terug op de gewone selectie als er geen verse alternatieven zijn.

## Lippenstiftregels

Alle straffen lopen via `addLipstickKiss(playerIndex, reason)`. Daardoor krijgt één klik precies één kusje, ook binnen Roulette, Perfecte Run, Golden Card, Wild Card, upgrades en lichtere varianten. De zichtbare melding is `💋 Lippenstiftstraf!`.

Gebruikte reason-waarden zijn onder andere `normal_skip`, `roulette_skip`, `perfect_run_failed`, `tension_repeat_skip`, `upgrade_skip`, `lighter_version_skip`, `golden_skip` en `wild_skip`.

## Ontwikkelmodus

In Instellingen staat een standaard uitgeschakelde ontwikkelmodus. Hiermee kun je tijdelijk:

- afgeronde kaarten per speler verhogen;
- levelprogressie resetten;
- alle levels vrijspelen;
- het Jacuzzi-deck resetten;
- de volledige game state in de console tonen;
- drie niet-gedaan voorbeelden toevoegen;
- drie voorbeeld-completions met `upgradeText` toevoegen;
- Roulette, Perfecte Run, Spelen met spanning en Dubbel zo spannend direct starten;
- een actieve `specialSession` wissen;
- `cardHistory` in de console tonen;
- de kaartvalidator draaien;
- statistieken opnieuw berekenen uit `cardHistory`.

Deze knoppen zijn alleen bedoeld om de engine te testen.

## Huidige kaartdatabase-status

De huidige database bevat 144 definitieve kaarten. De validator meldt nul fouten.

Categorie-aantallen:

- Chaos: 13
- Make-up: 12
- Blinddoek: 16
- Cute: 19
- Flirty: 24
- Oohlala: 19
- Disney: 2
- Jacuzzi: 28
- Specials: 11

Zie `card-audit.md` voor de volledige audit.

## Handmatige testchecklist

- Start een nieuw spel en controleer dat beide spelers op Level 1 beginnen.
- Zet Ontwikkelmodus aan en test 3/3, 5/3 en 4/4 afgeronde kaarten.
- Controleer dat Level 2 pas bij 4/4 verschijnt en maar een keer wordt gemeld.
- Zet Levelsysteem uit en controleer dat hogere categorieen beschikbaar worden.
- Zet Jacuzzi-modus uit en controleer dat Jacuzzi-kaarten niet verschijnen.
- Zet Jacuzzi-modus aan en controleer dat alleen geschikte kaarten verschijnen.
- Gebruik `Niet handig in de jacuzzi` en controleer dat er geen kus, voortgang of beurtwissel komt.
- Speel alle Jacuzzi-kaarten op en controleer de lege-deckmelding.
- Herlaad de pagina en controleer dat spelers, level, voortgang en Jacuzzi-status blijven staan.
- Start Roulette via Ontwikkelmodus en selecteer precies drie kaarten.
- Controleer dat Roulette-opdrachten achter elkaar komen en de beurt pas daarna wisselt.
- Herlaad tijdens Roulette en controleer dat dezelfde stap terugkomt.
- Klik twee keer snel op `Niet gedaan` en controleer dat er maar één kusje bijkomt.
- Start Perfecte Run en test zowel vijf keer `Gedaan` als direct `Niet gedaan`.
- Voeg niet-gedaan voorbeelden toe en test `Spelen met spanning` en `Lichtere versie`.
- Voeg voorbeeld-completions toe en test `Dubbel zo spannend`.
- Zet Jacuzzi-modus aan en controleer dat selecties alleen kaarten uit de Jacuzzi-bron gebruiken.
