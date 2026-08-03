# Visual Polish Report

## Overzicht

Deze update werkt bovenop de bestaande Date Roulette-engine. Kaartteksten, kaart-ID's, levels en spelregels zijn niet gewijzigd.

Toegevoegd:

- centrale categorieconfiguratie met labels, emoji's, kleuren en CSS-classnames;
- luxe donkere stijl plus zacht romantisch thema;
- verbeterde kaartstapel, kaartflip, category accents en scrollbare kaartinhoud;
- lippenstiftkus-overlay met naam van de speler;
- mobiele bottom bar met Spel, Statistieken en Instellingen;
- bottom bar buiten het spelscherm, zodat de kaart en spelacties op mobiel niet worden afgedekt;
- onboarding van drie stappen en compact uitlegscherm;
- eindscherm met ronde-samenvatting en `Nog een ronde`;
- PWA-manifest, service worker en lokale iconen;
- installprompt, updateprompt, offline cache;
- fullscreen- en Wake Lock-instellingen;
- korte Web Audio-geluiden en haptische patronen;
- expliciete reduced-motion fallback.

## Animaties

De kaartflip blijft rond 620 ms en gebruikt transform/opacity. Actieknoppen blijven disabled zolang de flip-lock actief is. Reduced motion vervangt de 3D-flip door een korte fade en schakelt decoratieve highlights en bubbels uit.

Categorie-effecten:

- Chaos: korte shake op emoji.
- Make-up: subtiele glitterpunten in de kaart.
- Blinddoek: korte fade-to-dark.
- Cute: kleine float op de emoji.
- Flirty: zachte pulse.
- Oohlala: warme glow.
- Disney en Special: sparkle/glans.
- Jacuzzi: blauwe gloed en rustige Bubble Meter.

## PWA en Offline

`manifest.webmanifest` gebruikt `display: standalone`, relatieve `start_url: ./` en lokale iconen. `service-worker.js` gebruikt cacheversie `date-roulette-v1.1.0`.

Strategie:

- install: cache app-shell, kaartmodules, manifest en iconen;
- activate: verwijder oude cacheversies;
- navigatie: network-first met offline fallback naar `index.html`;
- assets: cache-first met achtergrondrefresh;
- updates: toon prompt en vernieuw alleen na gebruikeractie.

## Performancekeuzes

Er zijn geen particle libraries, externe fonts, externe audio of analytics toegevoegd. Animaties gebruiken CSS transforms, opacity en lichte pseudo-elementen. Wake Lock wordt alleen tijdens actieve gameplay gevraagd en losgelaten buiten het spelscherm.

## Browserfuncties

Ondersteund waar beschikbaar:

- PWA-installatie via `beforeinstallprompt`;
- iOS Safari-uitleg voor `Zet op beginscherm`;
- Fullscreen API;
- Screen Wake Lock API;
- Web Audio na gebruikersinteractie;
- `navigator.vibrate`;
- Service Worker offline cache.

Bekende beperkingen:

- iPhone Safari ondersteunt geen standaard `beforeinstallprompt`;
- iPhone fullscreen werkt vooral goed vanuit een homescreen-installatie;
- Wake Lock is niet in elke browser beschikbaar;
- Lighthouse is niet automatisch gemeten in deze omgeving.

## Testresultaten

Automatische tests:

- `node --check app.js`: geslaagd.
- `node --check service-worker.js`: geslaagd.
- `npm test`: geslaagd, alle bestaande Date Roulette-tests groen.

Handmatige/browser-smoke:

- Chrome/CDP op 320 px breedte: 144 kaarten geladen.
- Onboarding is in een vers profiel getoond en daarna als voltooid opgeslagen.
- Kaartflip: `Gedaan` en `Niet gedaan` blijven disabled tijdens de flip en worden daarna actief.
- Dubbele klik op `Niet gedaan`: precies één kus en één lipstick event.
- Thema wisselen naar `Zacht romantisch`: direct zichtbaar en persistent na refresh.
- Service worker: `navigator.serviceWorker.ready` actief.
- Offline reload na eerste bezoek: app titel en 144-kaartendeck blijven beschikbaar.
- Mobiele screenshots gecontroleerd voor home/installprompt en game-header/meta/kaart.

Nog niet automatisch gemeten:

- Lighthouse-scores. De app is lokaal smoke-getest, maar Lighthouse is niet in deze omgeving uitgevoerd.
