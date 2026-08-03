# Date Roulette Bugfix Report

Datum: 2026-08-03

## Gevonden En Opgeloste Punten

| Nummer | Probleem | Oorzaak | Oplossing | Testresultaat |
|---:|---|---|---|---|
| 1 | De app gebruikte nog de tijdelijke `cards.js` kaartdatabase. | De definitieve modulaire map stond los naast de app. | `date-roulette-cards` is geintegreerd als `cards/`; `app.js` importeert nu `ALL_CARDS`, `CARD_COUNTS`, `validateCards` en `GAME_RULES`. | `npm test` bevestigt 144 kaarten en nul validatorfouten. |
| 2 | Er was geen app-brede kaartvalidator in ontwikkelmodus. | De oude deck-laag exposeerde geen stresstestcontrole. | Validator-wrapper toegevoegd met schema-, metadata-, duplicate-, HTML-, Special- en `flirty_020` checks. | Validator geeft 0 fouten. |
| 3 | Safety notes waren niet zichtbaar op kaarten. | Er was geen DOM- of renderpad voor `safetyNote`. | Safety-note rendering toegevoegd aan gewone kaarten en Special-subkaarten. | Browser smoke test geslaagd; 32 kaarten hebben safetyNote. |
| 4 | Stats konden niet opnieuw opgebouwd worden na oudere dubbele of missende counters. | Statistieken werden alleen incrementeel opgeslagen. | Ontwikkelknop `Statistieken opnieuw berekenen` en `recalculateStatsFromHistory()` toegevoegd. | Automatische test controleert herberekening. |
| 5 | Beschadigde LocalStorage werd stil genegeerd. | `loadJson()` viel terug op defaults zonder backup of melding. | Corrupte raw storage wordt apart gezet onder `dateRoulette_corruptBackup_[timestamp]`. | Browser smoke test controleert corrupt-storage herstel. |
| 6 | Oude states konden onbekende kaart-ID's vasthouden. | Migratie filterde strings niet tegen de actieve kaartdatabase. | `filterKnownCardIds()` toegevoegd voor used/completed/skipped/temporaryRejected en Special Sessions. | Automatische migratietest geslaagd. |
| 7 | Actieve Special Sessions met ontbrekende parentkaart konden blijven bestaan. | `normalizeSpecialSession()` valideerde parent/candidates niet. | Kapotte Special Sessions worden bij migratie veilig gewist. | Automatische migratietest geslaagd. |
| 8 | Golden/Wild/keuze-Specials konden lege tekst starten. | `startCustomSpecialTask()` had geen lege-invoer guard. | Lege input wordt geblokkeerd voordat de actie-lock start. | Browser smoke test controleert Golden-empty guard. |
| 9 | Golden en Wild kwamen als `normal` in history. | Custom special history gebruikte een vaste variant. | `golden` en `wild` worden nu als eigen history-variant opgeslagen. | Testhooks en recalc ondersteunen de varianten. |
| 10 | Level-unlockmodal kon bij herstelde edge-state boven een actieve Special komen. | `renderLevelModal()` keek niet naar `specialSession`. | Unlockmodal blijft verborgen zolang een Special actief is. | Codepad en tests blijven groen. |
| 11 | Kernlogica was lastig automatisch te testen. | Browserglobals waren niet bereikbaar in Node. | `window.DateRouletteTestHooks` en `tests/run-tests.mjs` toegevoegd. | `npm test` draait 12 kernscenario's succesvol. |

## Testresultaten

- `node --check app.js`: geslaagd
- `node --check tests/run-tests.mjs`: geslaagd
- `node --check cards/*.js`: geslaagd
- `npm test`: geslaagd
- Browser smoke test op 320 px: geslaagd

## Automatische Tests

De test-runner controleert:

- `validateCards()` met 144 kaarten
- leveldrempels voor 3/3, 4/3, 4/4, 8/7, 8/8, 12/12 en 16/16
- `isCardEligible()` per level
- Jacuzzi-filter
- `playerRestriction` voor `flirty_020`
- kaartselectie zonder gebruikte kaart
- precies een lippenstiftkus-event
- beurtwissel
- Roulette-candidates zonder Specials
- Perfecte Run-state
- migratie met onbekende kaart-ID's
- statistieken opnieuw berekenen uit `cardHistory`

## Kaartvalidatie

- Validatiefouten: 0
- Totaal kaarten: 144
- Per categorie: chaos 13, makeup 12, blindfold 16, cute 19, flirty 24, oohlala 19, disney 2, jacuzzi 28, special 11
- Per level: level 1: 65, level 2: 38, level 3: 17, level 4: 21, level 5: 3
- Zie `card-audit.md` voor details.

## Bekende Resterende Beperkingen

- Vier Jacuzzi-kaarten gebruiken Jacuzzi-specifieke `specialType`-metadata die niet door de Special-engine wordt uitgevoerd. Dat is bewust veilig: alleen `category: special` start een Special Session.
- Volledige fysieke iOS/Android-achtergrondtests blijven handmatig; de herstelpaden zijn lokaal via browser smoke test gecontroleerd.

## Mobiele Testchecklist

- Test 320, 375, 390, 430 en 768 px breedte.
- Start nieuw spel, trek kaart, gebruik `Gedaan`, `Niet gedaan` en snelle dubbele taps.
- Zet Jacuzzi-modus aan/uit tijdens een beurt.
- Start Roulette, Perfecte Run, Golden en Wild via Ontwikkelmodus/testhooks.
- Refresh tijdens gewone kaart, actieve timer en Special-modal.
- Controleer dat safety notes zichtbaar blijven zonder knoppen te bedekken.

## Tests Lokaal Draaien

```bash
npm test
```

De app blijft GitHub Pages-compatibel: er is geen buildstap nodig; `package.json` is alleen voor lokale tests.
