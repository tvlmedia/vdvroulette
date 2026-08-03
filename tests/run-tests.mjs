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
  assert.equal(deck.cards.length, 144);
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
  assert.equal(hooks.isCardEligible(hooks.getCardById("oohlala_001"), state, player), true);
  assert.equal(hooks.isCardEligible(hooks.getCardById("oohlala_003"), state, player), false);
  state.currentLevel = 5;
  assert.equal(hooks.isCardEligible(hooks.getCardById("oohlala_003"), state, player), true);
});

await run("Jacuzzi filter uses only Jacuzzi source cards", () => {
  const player = { id: "player_1", name: "Winnie" };
  const state = { levelSystemEnabled: false, currentLevel: 5, jacuzziMode: false };
  assert.equal(hooks.isCardEligible(hooks.getCardById("jacuzzi_fun_001"), state, player), false);
  assert.equal(hooks.isCardEligible(hooks.getCardById("jacuzzi_bubble_001"), state, player), false);
  state.jacuzziMode = true;
  assert.equal(hooks.isCardEligible(hooks.getCardById("jacuzzi_fun_001"), state, player), true);
  assert.equal(hooks.isCardEligible(hooks.getCardById("jacuzzi_bubble_001"), state, player), true);
  assert.equal(hooks.isCardEligible(hooks.getCardById("jacuzzi_special_001"), state, player), true);
  assert.equal(hooks.isCardEligible(hooks.getCardById("makeup_001"), state, player), false);
  assert.equal(hooks.isCardEligible(hooks.getCardById("chaos_002"), state, player), false);
  assert.equal(hooks.isCardEligible(hooks.getCardById("flirty_001"), state, player), false);
});

await run("Jacuzzi draw excludes regular jacuzziAllowed cards", () => {
  const game = hooks.createNewGame("Winnie", "Tijgertje");
  game.levelSystemEnabled = false;
  game.currentLevel = 5;
  game.jacuzziMode = true;
  game.usedCardIds = deck.cards
    .filter((card) => !["jacuzzi_fun_001", "flirty_001"].includes(card.id))
    .map((card) => card.id);
  hooks.setTestState(game, {}, { levelSystemEnabled: false });
  assert.equal(hooks.pickRandomCard().id, "jacuzzi_fun_001");
});

await run("flirty_020 is male-only and targets the female player name", () => {
  const restrictedCard = hooks.getCardById("flirty_020");
  const game = hooks.createNewGame("Kyra", "Timo", "vrouw", "man");
  game.levelSystemEnabled = false;
  game.currentLevel = 5;
  game.currentPlayerIndex = 1;

  assert.equal(restrictedCard.playerRestriction, "man");
  assert.equal(hooks.isCardEligible(restrictedCard, game, game.players[1]), true);
  assert.equal(hooks.isCardEligible(restrictedCard, game, game.players[0]), false);
  assert.equal(hooks.getDisplayCardTitle(restrictedCard, game, 1), "Voetmassage voor Kyra");
  assert.equal(hooks.getDisplayCardText(restrictedCard, game, 1), "Geef Kyra vijf minuten een voetmassage.");

  const noFemaleGame = hooks.createNewGame("Timo", "Sam", "man", "man");
  noFemaleGame.levelSystemEnabled = false;
  noFemaleGame.currentLevel = 5;
  assert.equal(hooks.isCardEligible(restrictedCard, noFemaleGame, noFemaleGame.players[0]), false);
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

await run("getAvailableCards excludes used cards", () => {
  const game = hooks.createNewGame("Winnie", "Tijgertje");
  game.levelSystemEnabled = false;
  game.currentLevel = 5;
  game.usedCardIds = ["chaos_001"];
  hooks.setTestState(game, {}, { levelSystemEnabled: false });
  const availableIds = hooks.getAvailableCards({ excludeSpecial: true }).map((card) => card.id);
  assert.equal(availableIds.includes("chaos_001"), false);
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

await run("local card ratings are included in playtest export", () => {
  const game = hooks.createNewGame("Winnie", "Tijgertje");
  game.currentCardId = "cute_001";
  hooks.setTestState(game, {}, { cardRatingsEnabled: true });
  hooks.rateCurrentCard("liked");
  const ratings = hooks.getCardRatings();
  assert.equal(ratings.cute_001.ratings.liked, 1);
  const exported = hooks.createPlaytestExportData();
  assert.equal(exported.appVersion, "v1.3.7");
  assert.equal(exported.ratings.cute_001.ratings.liked, 1);
});

console.log("All Date Roulette tests passed.");
