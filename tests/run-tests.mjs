import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function createStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

async function loadDateRoulette() {
  globalThis.window = globalThis;
  globalThis.localStorage = createStorage();
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
    vibrate() {
      return true;
    },
    userActivation: {
      isActive: true,
      hasBeenActive: true
    }
    }
  });
  globalThis.document = {
    addEventListener() {}
  };
  globalThis.requestAnimationFrame = (callback) => callback();

  await import(`${pathToFileURL(path.join(rootDir, "app.js")).href}?test=${Date.now()}`);
  return {
    deck: globalThis.DateRouletteDeck,
    hooks: globalThis.DateRouletteTestHooks
  };
}

function players(completedOne, completedTwo) {
  return [
    { id: "player_1", name: "Winnie", completedCards: completedOne, lipstickKisses: 0 },
    { id: "player_2", name: "Tijgertje", completedCards: completedTwo, lipstickKisses: 0 }
  ];
}

async function run(name, testFn) {
  try {
    await testFn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const { deck, hooks } = await loadDateRoulette();

await run("validateCards returns no schema errors", () => {
  const validation = hooks.validateCards();
  assert.equal(validation.errors.length, 0, validation.errors.join("\n"));
  assert.equal(new Set(deck.cards.map((card) => card.id)).size, deck.cards.length);
  assert.equal(deck.cards.length, 196);
  assert.deepEqual(deck.cardCounts.byCategory, {
    chaos: 34,
    makeup: 18,
    blindfold: 21,
    cute: 23,
    flirty: 30,
    oohlala: 27,
    disney: 3,
    jacuzzi: 29,
    special: 11
  });
  assert.deepEqual(deck.cardCounts.byLevel, {
    1: 85,
    2: 43,
    3: 18,
    4: 38,
    5: 12
  });
});

await run("calculateEarnedLevel follows shared-player thresholds", () => {
  assert.equal(hooks.calculateEarnedLevel(players(3, 3)), 1);
  assert.equal(hooks.calculateEarnedLevel(players(4, 3)), 1);
  assert.equal(hooks.calculateEarnedLevel(players(4, 4)), 2);
  assert.equal(hooks.calculateEarnedLevel(players(8, 7)), 2);
  assert.equal(hooks.calculateEarnedLevel(players(8, 8)), 3);
  assert.equal(hooks.calculateEarnedLevel(players(9, 9)), 3);
  assert.equal(hooks.calculateEarnedLevel(players(10, 10)), 4);
  assert.equal(hooks.calculateEarnedLevel(players(16, 16)), 5);
});

await run("isCardEligible respects levels", () => {
  const state = { levelSystemEnabled: true, currentLevel: 1, jacuzziMode: false };
  const player = { id: "player_1", name: "Winnie" };
  assert.equal(hooks.isCardEligible(hooks.getCardById("chaos_001"), state, player), true);
  assert.equal(hooks.isCardEligible(hooks.getCardById("makeup_001"), state, player), false);
  state.currentLevel = 2;
  assert.equal(hooks.isCardEligible(hooks.getCardById("makeup_001"), state, player), true);
  assert.equal(hooks.isCardEligible(hooks.getCardById("blindfold_001"), state, player), false);
  state.currentLevel = 3;
  assert.equal(hooks.isCardEligible(hooks.getCardById("blindfold_001"), state, player), true);
  state.currentLevel = 4;
  assert.equal(hooks.isCardEligible(hooks.getCardById("oohlala_001"), state, player), false);
  assert.equal(hooks.isCardEligible(hooks.getCardById("oohlala_003"), state, player), false);
  state.currentLevel = 5;
  assert.equal(hooks.isCardEligible(hooks.getCardById("oohlala_001"), state, player), false);
  assert.equal(hooks.isCardEligible(hooks.getCardById("oohlala_003"), state, player), false);
  state.levelOverride = 4;
  assert.equal(hooks.isCardEligible(hooks.getCardById("oohlala_001"), state, player), true);
  assert.equal(hooks.isCardEligible(hooks.getCardById("oohlala_003"), state, player), false);
  state.levelOverride = 5;
  assert.equal(hooks.isCardEligible(hooks.getCardById("oohlala_001"), state, player), true);
  assert.equal(hooks.isCardEligible(hooks.getCardById("oohlala_003"), state, player), true);
});

await run("spice level override raises the playable level cap", () => {
  const game = hooks.createNewGame("Winnie", "Tijgertje");
  const player = game.players[0];
  game.levelSystemEnabled = true;
  game.currentLevel = 1;

  assert.equal(hooks.getEffectiveLevel(game), 1);
  assert.equal(hooks.isCardEligible(hooks.getCardById("chaos_001"), game, player), true);
  assert.equal(hooks.isCardEligible(hooks.getCardById("oohlala_021"), game, player), false);
  assert.equal(hooks.isCardEligible(hooks.getCardById("oohlala_022"), game, player), false);

  game.levelOverride = 4;
  assert.equal(hooks.getEffectiveLevel(game), 4);
  assert.equal(hooks.isCardEligible(hooks.getCardById("chaos_001"), game, player), true);
  assert.equal(hooks.isCardEligible(hooks.getCardById("oohlala_021"), game, player), true);
  assert.equal(hooks.isCardEligible(hooks.getCardById("oohlala_022"), game, player), false);

  game.levelOverride = 5;
  assert.equal(hooks.getEffectiveLevel(game), 5);
  assert.equal(hooks.isCardEligible(hooks.getCardById("chaos_001"), game, player), true);
  assert.equal(hooks.isCardEligible(hooks.getCardById("oohlala_021"), game, player), true);
  assert.equal(hooks.isCardEligible(hooks.getCardById("oohlala_022"), game, player), true);

  game.currentLevel = 5;
  game.levelOverride = 4;
  assert.equal(hooks.getEffectiveLevel(game), 4);
  assert.equal(hooks.isCardEligible(hooks.getCardById("oohlala_021"), game, player), true);
  assert.equal(hooks.isCardEligible(hooks.getCardById("oohlala_022"), game, player), false);
});

await run("spice level draw pools contain cards up to the selected level", () => {
  const normalHighProgressGame = hooks.createNewGame("Winnie", "Tijgertje");
  normalHighProgressGame.levelSystemEnabled = true;
  normalHighProgressGame.currentLevel = 5;
  const normalCards = hooks.getAvailableCards({
    includeUsed: true,
    ignoreTemporaryRejected: true,
    ignoreRecentSimilar: true,
    state: normalHighProgressGame,
    player: normalHighProgressGame.players[0]
  });
  assert.ok(normalCards.length > 0);
  assert.equal(normalCards.every((card) => Number(card.level) <= 3), true);

  const levelFourGame = hooks.createNewGame("Winnie", "Tijgertje");
  levelFourGame.levelSystemEnabled = true;
  levelFourGame.currentLevel = 1;
  levelFourGame.levelOverride = 4;
  hooks.setTestState(levelFourGame);
  const levelFourCards = hooks.getAvailableCards({ includeUsed: true, ignoreTemporaryRejected: true, ignoreRecentSimilar: true });
  const levelFourPoolLevels = new Set(levelFourCards.map((card) => Number(card.level)));
  assert.ok(levelFourCards.length > 0);
  assert.equal(levelFourCards.every((card) => Number(card.level) <= 4), true);
  assert.equal(levelFourPoolLevels.has(1), true);
  assert.equal(levelFourPoolLevels.has(4), true);
  assert.equal(levelFourPoolLevels.has(5), false);

  const levelFiveGame = hooks.createNewGame("Winnie", "Tijgertje");
  levelFiveGame.levelSystemEnabled = true;
  levelFiveGame.currentLevel = 1;
  levelFiveGame.levelOverride = 5;
  hooks.setTestState(levelFiveGame);
  const levelFiveCards = hooks.getAvailableCards({ includeUsed: true, ignoreTemporaryRejected: true, ignoreRecentSimilar: true });
  const levelFivePoolLevels = new Set(levelFiveCards.map((card) => Number(card.level)));
  assert.ok(levelFiveCards.length > 0);
  assert.equal(levelFiveCards.every((card) => Number(card.level) <= 5), true);
  assert.equal(levelFivePoolLevels.has(1), true);
  assert.equal(levelFivePoolLevels.has(4), true);
  assert.equal(levelFivePoolLevels.has(5), true);
});

await run("stale spicy current card is cleared when spice buttons are off", () => {
  const staleGame = hooks.createNewGame("Winnie", "Tijgertje");
  staleGame.levelSystemEnabled = true;
  staleGame.players.forEach((player) => {
    player.completedCards = 10;
  });
  staleGame.currentLevel = 4;
  staleGame.levelOverride = null;
  staleGame.currentCardId = "oohlala_001";
  staleGame.usedCardIds = ["oohlala_001"];
  hooks.setTestState(staleGame);

  assert.equal(hooks.getGame().currentLevel, 4);
  assert.equal(hooks.getGame().currentCardId, "oohlala_001");
  assert.equal(hooks.clearIneligibleCurrentCard(), true);
  assert.equal(hooks.getGame().currentCardId, null);
  assert.equal(hooks.getGame().usedCardIds.includes("oohlala_001"), false);
});

await run("wild card requires the level 4 spice button", () => {
  const game = hooks.createNewGame("Winnie", "Tijgertje");
  const player = game.players[0];
  const wildCard = hooks.getCardById("special_wild_001");
  game.levelSystemEnabled = true;

  game.currentLevel = 3;
  assert.equal(wildCard.level, 4);
  assert.equal(hooks.isCardEligible(wildCard, game, player), false);

  game.currentLevel = 4;
  assert.equal(hooks.isCardEligible(wildCard, game, player), false);

  game.levelOverride = 4;
  assert.equal(hooks.isCardEligible(wildCard, game, player), true);
});

await run("golden card requires the level 4 spice button", () => {
  const game = hooks.createNewGame("Winnie", "Tijgertje");
  const player = game.players[0];
  const goldenCard = hooks.getCardById("special_golden_001");
  game.levelSystemEnabled = true;

  game.currentLevel = 3;
  assert.equal(goldenCard.level, 4);
  assert.equal(hooks.isCardEligible(goldenCard, game, player), false);

  game.currentLevel = 4;
  assert.equal(hooks.isCardEligible(goldenCard, game, player), false);

  game.levelOverride = 4;
  assert.equal(hooks.isCardEligible(goldenCard, game, player), true);
});

await run("player choice specials require level 4 and 5 spice buttons", () => {
  const game = hooks.createNewGame("Kyra", "Timo");
  const player = game.players[0];
  const levelFourChoice = hooks.getCardById("special_winnie_001");
  const levelFiveChoice = hooks.getCardById("special_tigger_001");
  game.levelSystemEnabled = true;

  assert.equal(levelFourChoice.level, 4);
  assert.equal(levelFiveChoice.level, 5);

  game.currentLevel = 3;
  assert.equal(hooks.isCardEligible(levelFourChoice, game, player), false);
  assert.equal(hooks.isCardEligible(levelFiveChoice, game, player), false);

  game.currentLevel = 4;
  assert.equal(hooks.isCardEligible(levelFourChoice, game, player), false);
  assert.equal(hooks.isCardEligible(levelFiveChoice, game, player), false);
  game.levelOverride = 4;
  assert.equal(hooks.isCardEligible(levelFourChoice, game, player), true);
  assert.equal(hooks.isCardEligible(levelFiveChoice, game, player), false);

  game.currentLevel = 5;
  game.levelOverride = null;
  assert.equal(hooks.isCardEligible(levelFourChoice, game, player), false);
  assert.equal(hooks.isCardEligible(levelFiveChoice, game, player), false);
  game.levelOverride = 5;
  assert.equal(hooks.isCardEligible(levelFourChoice, game, player), true);
  assert.equal(hooks.isCardEligible(levelFiveChoice, game, player), true);
});

await run("Jacuzzi filter includes regular jacuzziAllowed cards", () => {
  const player = { id: "player_1", name: "Winnie" };
  const state = { levelSystemEnabled: false, currentLevel: 5, jacuzziMode: false };
  assert.equal(hooks.isCardEligible(hooks.getCardById("jacuzzi_fun_001"), state, player), false);
  assert.equal(hooks.isCardEligible(hooks.getCardById("jacuzzi_bubble_001"), state, player), false);
  state.jacuzziMode = true;
  assert.equal(hooks.isCardEligible(hooks.getCardById("jacuzzi_fun_001"), state, player), true);
  assert.equal(hooks.isCardEligible(hooks.getCardById("jacuzzi_bubble_001"), state, player), true);
  assert.equal(hooks.isCardEligible(hooks.getCardById("jacuzzi_special_001"), state, player), true);
  assert.equal(hooks.isCardEligible(hooks.getCardById("makeup_001"), state, player), false);
  assert.equal(hooks.isCardEligible(hooks.getCardById("chaos_002"), state, player), true);
  assert.equal(hooks.isCardEligible(hooks.getCardById("flirty_001"), state, player), true);
});

await run("Jacuzzi draw includes regular jacuzziAllowed cards", () => {
  const game = hooks.createNewGame("Winnie", "Tijgertje");
  game.levelSystemEnabled = false;
  game.currentLevel = 5;
  game.jacuzziMode = true;
  game.usedCardIds = deck.cards
    .filter((card) => card.id !== "flirty_001")
    .map((card) => card.id);
  hooks.setTestState(game, {}, { levelSystemEnabled: false });
  assert.equal(hooks.pickRandomCard().id, "flirty_001");
});

await run("make-up cards use reduced draw weight", () => {
  assert.equal(hooks.getCardWeight(hooks.getCardById("makeup_001")), 0.65);
  assert.equal(hooks.getCardWeight(hooks.getCardById("cute_001")), 1);
});

await run("flirty_020 is male-only and targets the female player name", () => {
  const restrictedCard = hooks.getCardById("flirty_020");
  const game = hooks.createNewGame("Kyra", "Timo", "vrouw", "man");
  game.levelSystemEnabled = false;
  game.currentLevel = 5;
  game.currentPlayerIndex = 1;

  assert.equal(restrictedCard.playerRestriction, "man");
  assert.equal(restrictedCard.level, 5);
  assert.equal(hooks.isCardEligible(restrictedCard, game, game.players[1]), true);
  assert.equal(hooks.isCardEligible(restrictedCard, game, game.players[0]), false);
  assert.equal(hooks.getDisplayCardTitle(restrictedCard, game, 1), "Voetmassage voor Kyra");
  assert.equal(hooks.getDisplayCardText(restrictedCard, game, 1), "Geef Kyra vijf minuten een voetmassage.");

  const noFemaleGame = hooks.createNewGame("Timo", "Sam", "man", "man");
  noFemaleGame.levelSystemEnabled = false;
  noFemaleGame.currentLevel = 5;
  assert.equal(hooks.isCardEligible(restrictedCard, noFemaleGame, noFemaleGame.players[0]), false);
});

await run("display card text personalizes partner references", () => {
  const game = hooks.createNewGame("Kyra", "Timo", "vrouw", "man");
  game.levelSystemEnabled = false;
  game.currentLevel = 5;

  assert.equal(
    hooks.getDisplayCardText(hooks.getCardById("flirty_001"), game, 0),
    "Geef Timo vijf minuten een massage."
  );
  assert.equal(
    hooks.getDisplayCardText(hooks.getCardById("flirty_002"), game, 0),
    "Timo kiest hoe jullie de komende vijf minuten knuffelen."
  );
  assert.equal(
    hooks.getDisplayCardText(hooks.getCardById("special_roulette_001"), game, 0),
    "Timo krijgt tien kaarten te zien en kiest drie opdrachten die jij achter elkaar moet proberen."
  );
  assert.equal(
    hooks.getDisplayCardText(hooks.getCardById("chaos_006"), game, 1),
    "Wissel vijf minuten van persoonlijkheid: jij speelt Kyra en Kyra speelt jou."
  );
  assert.equal(
    hooks.getDisplayCardSafetyNote({ safetyNote: "Blijf uit de buurt van de ander." }, game, 1),
    "Blijf uit de buurt van Kyra."
  );
});

await run("playerRestriction can target player gender", () => {
  assert.equal(hooks.isPlayerAllowed({ playerRestriction: "vrouw" }, { id: "player_1", name: "Alex", gender: "vrouw" }), true);
  assert.equal(hooks.isPlayerAllowed({ playerRestriction: "vrouw" }, { id: "player_2", name: "Sam", gender: "man" }), false);
  assert.equal(hooks.isPlayerAllowed({ playerRestriction: "male" }, { id: "player_2", name: "Sam", gender: "man" }), true);

  const validation = deck.validateCards([
    ...deck.cards,
    {
      ...hooks.getCardById("cute_001"),
      id: "test_gender_restricted_card",
      playerRestriction: "vrouw"
    }
  ]);
  assert.equal(validation.errors.length, 0, validation.errors.join("\n"));
});

await run("reported cute_005 text is corrected", () => {
  const card = hooks.getCardById("cute_005");
  assert.equal(card.title, "Spontane Slowdance");
  assert.equal(card.text, "Doe een sensuele dans voor de ander");
});

await run("reported cute_014 text is corrected", () => {
  const card = hooks.getCardById("cute_014");
  assert.equal(card.title, "Hotelshop Missie");
  assert.equal(card.text, "Ga naar het hotelwinkeltje en koop iets lekkers. De ander heeft ondertussen even tijd voor zichzelf of om zich om te kleden.");
});

await run("reported flirty_022 is removed", () => {
  assert.equal(hooks.getCardById("flirty_022"), null);
});

await run("reported chaos_012 text is corrected", () => {
  const card = hooks.getCardById("chaos_012");
  assert.equal(card.title, "Dichterbij");
  assert.equal(card.text, "Leg een sjaal, stropdas, panty of badjasriem losjes over de schouders van de ander en trek diegene rustig dichterbij voor een kus of knuffel.");
  assert.equal(card.safetyNote, "Niet om de nek leggen en trek niet hard.");
});

await run("reported chaos_010 text is corrected", () => {
  const card = hooks.getCardById("chaos_010");
  assert.equal(card.title, "Drie Lagen Extra");
  assert.equal(card.text, "De ander kiest drie extra kledingstukken of accessoires uit. Draag de complete combinatie twintig minuten.");
  assert.equal(card.safetyNote, null);
});

await run("reported blindfold_005 text is corrected", () => {
  const card = hooks.getCardById("blindfold_005");
  assert.equal(card.title, "Make-upkwast Challenge");
  assert.equal(card.text, "Blijf geblinddoekt. De ander mag met een zachte make-upkwast langzaam langs je lichaam strijken en je speels kietelen op afgesproken plekken.");
});

await run("reported oohlala_011 text is corrected", () => {
  const card = hooks.getCardById("oohlala_011");
  assert.equal(card.title, "Voetenkietel");
  assert.equal(card.text, "De ander bindt je enkels losjes vast en kietelt je maximaal dertig seconden onder je voeten. Stopwoord: WALIBI.");
  assert.equal(card.level, 5);
  assert.equal(card.timerSeconds, 30);
  assert.equal(card.safetyNote, "Alleen met iets dat direct los kan. Stop meteen bij WALIBI.");
});

await run("reported follow-up card edits are applied", () => {
  assert.equal(hooks.getCardById("chaos_018").timerSeconds, 300);
  assert.equal(hooks.getCardById("flirty_028").timerSeconds, 10);
  assert.equal(hooks.getCardById("oohlala_010").text.includes("stropdas, panty"), true);
  assert.equal(hooks.getCardById("oohlala_014").title, "Polsen Vast");
  assert.equal(hooks.getCardById("makeup_011").playerRestriction, "vrouw");
  assert.equal(hooks.getCardById("makeup_011").level, 4);
});

await run("dance cards are woman-only", () => {
  const danceCards = deck.cards.filter((card) => card.contentTags?.includes("dance"));
  assert.ok(danceCards.length >= 1);
  assert.equal(danceCards.every((card) => card.playerRestriction === "vrouw"), true);
});

await run("reported oohlala_013 text is corrected", () => {
  const card = hooks.getCardById("oohlala_013");
  assert.equal(card.title, "Donkere Knuffel");
  assert.equal(card.text, "Dim de lichten en knuffel en kus vijf minuten samen op bed.");
  assert.equal(card.safetyNote, null);
});

await run("new whipped cream cards are available", () => {
  const blindfoldCard = hooks.getCardById("blindfold_017");
  const oohlalaCard = hooks.getCardById("oohlala_020");
  assert.equal(blindfoldCard.title, "Blinde Smaaktest");
  assert.equal(blindfoldCard.contentTags.includes("food"), true);
  assert.equal(oohlalaCard.title, "Slagroom-Kus");
  assert.equal(oohlalaCard.safetyNote.includes("verslikken"), true);
});

await run("new requested date-night cards are imported with metadata", () => {
  const clothingTwist = hooks.getCardById("chaos_030");
  const makeUpQuiz = hooks.getCardById("makeup_017");
  const jacuzziFreeze = hooks.getCardById("jacuzzi_oohlala_009");
  const soundBarrier = hooks.getCardById("oohlala_027");
  const blindCream = hooks.getCardById("blindfold_020");

  assert.equal(clothingTwist.title, "Kledingruil Twist");
  assert.equal(clothingTwist.level, 4);
  assert.equal(makeUpQuiz.playerRestriction, "man");
  assert.equal(makeUpQuiz.text.includes("Kyra"), false);
  assert.equal(jacuzziFreeze.requiresJacuzzi, true);
  assert.equal(jacuzziFreeze.level, 5);
  assert.equal(soundBarrier.timerSeconds, 60);
  assert.equal(blindCream.level, 5);

  const game = hooks.createNewGame("Kyra", "Timo", "vrouw", "man");
  game.levelSystemEnabled = false;
  game.currentLevel = 5;
  game.currentPlayerIndex = 1;
  assert.equal(hooks.isCardEligible(makeUpQuiz, game, game.players[1]), true);
  assert.equal(hooks.isCardEligible(makeUpQuiz, game, game.players[0]), false);
  assert.equal(
    hooks.getDisplayCardText(makeUpQuiz, game, 1),
    "Kyra laat jou drie willekeurige make-upproducten zien. Raad waar elk product voor dient. Voor elk fout antwoord mag zij met een kwastje of potlood een stip op je gezicht zetten."
  );
});

await run("reported oohlala kissing cards are moved to flirty level 2", () => {
  const slowKiss = hooks.getCardById("oohlala_025");
  const soundBarrier = hooks.getCardById("oohlala_027");

  assert.equal(slowKiss.title, "Slow-Motion Kus");
  assert.equal(slowKiss.category, "flirty");
  assert.equal(slowKiss.emoji, "😏");
  assert.equal(slowKiss.level, 2);
  assert.equal(soundBarrier.title, "Geluidsbarrière");
  assert.equal(soundBarrier.category, "flirty");
  assert.equal(soundBarrier.emoji, "😏");
  assert.equal(soundBarrier.level, 2);
});

await run("reported chaos_009 text is corrected", () => {
  const card = hooks.getCardById("chaos_009");
  assert.equal(card.title, "Slok en Kus");
  assert.equal(card.text, "Eén van jullie neemt een klein slokje, zet het glas weg en geeft het drankje met een kus door. Wissel daarna. Probeer niet te knoeien.");
  assert.equal(card.safetyNote, null);
});

await run("getAvailableCards excludes used cards", () => {
  const game = hooks.createNewGame("Winnie", "Tijgertje");
  game.levelSystemEnabled = false;
  game.currentLevel = 5;
  game.usedCardIds = ["chaos_001"];
  hooks.setTestState(game, {}, { levelSystemEnabled: false });
  const availableIds = hooks.getAvailableCards({ excludeSpecial: true }).map((card) => card.id);
  assert.equal(availableIds.includes("chaos_001"), false);
});

await run("getAvailableCards spreads similar recent cards when alternatives exist", () => {
  const game = hooks.createNewGame("Winnie", "Tijgertje");
  game.levelSystemEnabled = false;
  game.currentLevel = 5;
  game.cardHistory = [
    { cardId: "flirty_019", result: "completed", variant: "normal", playerIndex: 0 }
  ];
  hooks.setTestState(game, {}, { levelSystemEnabled: false });
  const availableIds = hooks.getAvailableCards({ includeUsed: true, ignoreTemporaryRejected: true }).map((card) => card.id);
  assert.equal(availableIds.includes("chaos_033"), false);
  assert.equal(availableIds.includes("chaos_001"), true);
});

await run("getAvailableCards falls back when only similar cards remain", () => {
  const game = hooks.createNewGame("Winnie", "Tijgertje");
  game.levelSystemEnabled = false;
  game.currentLevel = 5;
  game.usedCardIds = deck.cards
    .filter((card) => card.id !== "chaos_033")
    .map((card) => card.id);
  game.cardHistory = [
    { cardId: "flirty_019", result: "completed", variant: "normal", playerIndex: 0 }
  ];
  hooks.setTestState(game, {}, { levelSystemEnabled: false });
  assert.deepEqual(hooks.getAvailableCards().map((card) => card.id), ["chaos_033"]);
});

await run("getAvailableCards can spread from a replaced current card", () => {
  const game = hooks.createNewGame("Winnie", "Tijgertje");
  game.levelSystemEnabled = false;
  game.currentLevel = 5;
  game.usedCardIds = ["flirty_019"];
  hooks.setTestState(game, {}, { levelSystemEnabled: false });
  const availableIds = hooks.getAvailableCards({
    additionalSimilarityCardIds: ["flirty_019"],
    ignoreTemporaryRejected: true
  }).map((card) => card.id);
  assert.equal(availableIds.includes("chaos_033"), false);
});

await run("addLipstickKiss adds exactly one kiss event", () => {
  const game = hooks.createNewGame("Winnie", "Tijgertje");
  hooks.setTestState(game);
  hooks.addLipstickKiss(0, "test_skip");
  const updated = hooks.getGame();
  assert.equal(updated.players[0].lipstickKisses, 1);
  assert.equal(updated.lipstickEvents.length, 1);
});

await run("switchTurn toggles active player", () => {
  const game = hooks.createNewGame("Winnie", "Tijgertje");
  hooks.setTestState(game);
  hooks.switchTurn();
  assert.equal(hooks.getGame().currentPlayerIndex, 1);
  hooks.switchTurn();
  assert.equal(hooks.getGame().currentPlayerIndex, 0);
});

await run("Roulette candidates are ordinary eligible cards", () => {
  const game = hooks.createNewGame("Winnie", "Tijgertje");
  game.levelSystemEnabled = false;
  game.currentLevel = 5;
  hooks.setTestState(game, {}, { levelSystemEnabled: false });
  hooks.handleSpecialCard(hooks.getCardById("special_roulette_001"), hooks.getGame());
  const session = hooks.getGame().specialSession;
  assert.equal(session.type, "roulette");
  assert.equal(session.requiredCount, 3);
  assert.ok(session.candidateCardIds.length <= 10);
  assert.ok(session.candidateCardIds.length >= 3);
  assert.equal(session.candidateCardIds.some((id) => hooks.isSpecialCard(hooks.getCardById(id))), false);
});

await run("Flirty-keuze excludes previously played cards when alternatives exist", () => {
  const game = hooks.createNewGame("Winnie", "Tijgertje");
  game.levelSystemEnabled = false;
  game.currentLevel = 5;
  game.completedCardIds = ["flirty_001"];
  game.cardHistory = [
    { cardId: "flirty_001", result: "completed", variant: "normal", playerIndex: 0 }
  ];
  hooks.setTestState(game, {}, { levelSystemEnabled: false });
  hooks.handleSpecialCard(hooks.getCardById("special_flirty_choice_001"), hooks.getGame());
  const session = hooks.getGame().specialSession;
  assert.equal(session.type, "flirtyChoice");
  assert.equal(session.candidateCardIds.includes("flirty_001"), false);
});

await run("player choice specials use the active player name", () => {
  const game = hooks.createNewGame("Kyra", "Timo");
  game.currentPlayerIndex = 1;
  hooks.setTestState(game, {}, { levelSystemEnabled: false });
  const card = hooks.getCardById("special_tigger_001");
  assert.equal(hooks.getDisplayCardTitle(card, hooks.getGame(), 1), "Timo’s keuze");
  assert.equal(hooks.getDisplayCardText(card, hooks.getGame(), 1), "Timo bepaalt wat er de komende vijf minuten gebeurt.");
});

await run("Perfecte Run creates a bounded normal-card sequence", () => {
  const game = hooks.createNewGame("Winnie", "Tijgertje");
  game.levelSystemEnabled = false;
  game.currentLevel = 5;
  hooks.setTestState(game, {}, { levelSystemEnabled: false });
  hooks.handleSpecialCard(hooks.getCardById("special_perfect_run_001"), hooks.getGame());
  const session = hooks.getGame().specialSession;
  assert.equal(session.type, "perfectRun");
  assert.ok(session.selectedCardIds.length > 0);
  assert.ok(session.selectedCardIds.length <= 5);
  assert.equal(session.selectedCardIds.some((id) => hooks.isSpecialCard(hooks.getCardById(id))), false);
});

await run("migrateGameState filters unknown card IDs safely", () => {
  const migrated = hooks.migrateGameState({
    activeGame: true,
    players: players(4, 4),
    usedCardIds: ["unknown_card", "chaos_001"],
    completedCardIds: ["missing_completed"],
    skippedCardIds: ["flirty_001", "missing_skipped"],
    currentCardId: "missing_current",
    specialSession: { parentCardId: "missing_special", phase: "task", selectedCardIds: ["chaos_001"] },
    cardHistory: [
      { cardId: "missing_history", result: "completed", variant: "normal" },
      { cardId: "custom_golden", result: "completed", variant: "golden", note: "Eigen opdracht" }
    ]
  });
  assert.deepEqual(Array.from(migrated.usedCardIds), ["chaos_001"]);
  assert.deepEqual(Array.from(migrated.completedCardIds), []);
  assert.deepEqual(Array.from(migrated.skippedCardIds), ["flirty_001"]);
  assert.equal(migrated.currentCardId, null);
  assert.equal(migrated.specialSession, null);
  assert.equal(migrated.cardHistory.length, 1);
  assert.equal(migrated.cardHistory[0].variant, "golden");
});

await run("migrateGameState resumes resolved cards without running timers", () => {
  const migrated = hooks.migrateGameState({
    activeGame: true,
    players: players(1, 0),
    currentPlayerIndex: 0,
    currentCardId: "cute_012",
    cardResolved: true,
    timer: {
      cardId: "cute_012",
      remainingSeconds: 90,
      isRunning: true,
      startedAt: Date.now()
    }
  });
  assert.equal(migrated.pendingTurnAdvance, true);
  assert.equal(migrated.timer.remainingSeconds, 0);
  assert.equal(migrated.timer.isRunning, false);
});

await run("completePendingTurnAdvance safely finishes a saved turn", () => {
  const game = hooks.createNewGame("Winnie", "Tijgertje");
  game.currentCardId = "cute_001";
  game.cardResolved = true;
  game.pendingTurnAdvance = true;
  game.turnAdvanceDueAt = Date.now() - 1;
  hooks.setTestState(game);
  assert.equal(hooks.completePendingTurnAdvance(), true);
  const updated = hooks.getGame();
  assert.equal(updated.currentPlayerIndex, 1);
  assert.equal(updated.currentCardId, null);
  assert.equal(updated.pendingTurnAdvance, false);
});

await run("recalculateStatsFromHistory rebuilds key counters", () => {
  const rebuilt = hooks.recalculateStatsFromHistory({
    players: players(2, 1),
    unlockedLevels: [1, 2],
    usedCardIds: ["cute_002"],
    cardHistory: [
      { cardId: "chaos_001", result: "completed", variant: "normal", playerIndex: 0 },
      { cardId: "flirty_001", result: "skipped", variant: "roulette", playerIndex: 1 }
    ]
  }, {
    jacuzziUseCount: 2,
    jacuzziTimeSeconds: 12
  });
  assert.equal(rebuilt.doneCount, 1);
  assert.equal(rebuilt.notDoneCount, 1);
  assert.equal(rebuilt.rouletteSubtasksSkipped, 1);
  assert.equal(rebuilt.totalDrawn, 3);
  assert.equal(rebuilt.completedByPlayer.player_1, 2);
  assert.equal(rebuilt.completedByPlayer.player_2, 1);
  assert.equal(rebuilt.jacuzziUseCount, 2);
});

await run("running card timers keep real-second pace", () => {
  const originalNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;

  try {
    const game = hooks.createNewGame("Winnie", "Tijgertje");
    game.currentCardId = "flirty_001";
    game.timer = {
      cardId: "flirty_001",
      remainingSeconds: 60,
      isRunning: true,
      startedAt: now
    };
    hooks.setTestState(game);

    assert.equal(hooks.getTimerRemainingSeconds(), 60);
    now += 250;
    assert.equal(hooks.getTimerRemainingSeconds(), 60);
    now += 750;
    assert.equal(hooks.getTimerRemainingSeconds(), 59);
    now += 1000;
    assert.equal(hooks.getTimerRemainingSeconds(), 58);
  } finally {
    Date.now = originalNow;
  }
});

await run("done running card timer becomes an active timer", () => {
  const originalNow = Date.now;
  let now = 2_000_000;
  Date.now = () => now;
  hooks.setRandomSource(() => 0.12345);

  try {
    const game = hooks.createNewGame("Winnie", "Tijgertje");
    game.currentCardId = "flirty_001";
    game.timer = {
      cardId: "flirty_001",
      remainingSeconds: 300,
      isRunning: true,
      startedAt: now
    };
    hooks.setTestState(game);
    hooks.stopTimerForResolvedCard({ persist: true });
    hooks.stopActiveTimerInterval();

    const activeTimer = hooks.getGame().activeTimers[0];
    assert.equal(hooks.getGame().activeTimers.length, 1);
    assert.equal(activeTimer.cardId, "flirty_001");
    assert.equal(activeTimer.playerName, "Winnie");
    assert.equal(activeTimer.endsAt, 2_300_000);

    now += 120_000;
    assert.equal(hooks.getActiveTimerRemainingSeconds(activeTimer), 180);
  } finally {
    hooks.stopActiveTimerInterval();
    hooks.resetRandomSource();
    Date.now = originalNow;
  }
});

await run("card report payload includes original and suggested fix", () => {
  const card = hooks.getCardById("makeup_001");
  const payload = hooks.createCardReportPayload(card, {
    problem: "Vraag klopt niet.",
    title: "Nieuwe titel",
    text: "Nieuwe kloppende opdracht.",
    safetyNote: "Nieuwe veiligheidsnotitie."
  });

  assert.equal(payload.type, "date_roulette_card_report");
  assert.equal(payload.targetFile, "cards/makeup.js");
  assert.equal(payload.original.id, "makeup_001");
  assert.equal(payload.original.title, card.title);
  assert.equal(payload.suggested.title, "Nieuwe titel");
  assert.equal(payload.suggested.text, "Nieuwe kloppende opdracht.");
  assert.deepEqual(payload.changedFields.sort(), ["safetyNote", "text", "title"]);
});

await run("lipstick penalty copy names the partner", () => {
  const game = hooks.createNewGame("Kyra", "Timo", "vrouw", "man");
  game.currentPlayerIndex = 0;
  assert.equal(hooks.getLipstickPenaltyTask(game, 0), "Laat Timo een lippenstiftafdruk achterlaten.");
});

await run("local card ratings are included in playtest export", () => {
  const game = hooks.createNewGame("Winnie", "Tijgertje");
  game.currentCardId = "cute_001";
  hooks.setTestState(game, {}, { cardRatingsEnabled: true });
  hooks.rateCurrentCard("liked");
  const ratings = hooks.getCardRatings();
  assert.equal(ratings.cute_001.ratings.liked, 1);
  const exported = hooks.createPlaytestExportData();
  assert.equal(exported.appVersion, "v1.3.36");
  assert.equal(exported.ratings.cute_001.ratings.liked, 1);
});

console.log("All Date Roulette tests passed.");
