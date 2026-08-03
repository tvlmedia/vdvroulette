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
  assert.equal(hooks.calculateEarnedLevel(players(12, 12)), 4);
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
});

await run("Jacuzzi filter includes only suitable cards", () => {
  const player = { id: "player_1", name: "Winnie" };
  const state = { levelSystemEnabled: false, currentLevel: 5, jacuzziMode: false };
  assert.equal(hooks.isCardEligible(hooks.getCardById("jacuzzi_fun_001"), state, player), false);
  state.jacuzziMode = true;
  assert.equal(hooks.isCardEligible(hooks.getCardById("jacuzzi_fun_001"), state, player), true);
  assert.equal(hooks.isCardEligible(hooks.getCardById("makeup_001"), state, player), false);
  assert.equal(hooks.isCardEligible(hooks.getCardById("flirty_001"), state, player), true);
});

await run("playerRestriction stays tied to player_1", () => {
  const state = { levelSystemEnabled: false, currentLevel: 5, jacuzziMode: false };
  const restrictedCard = hooks.getCardById("flirty_020");
  assert.equal(hooks.isCardEligible(restrictedCard, state, { id: "player_1", name: "Nieuwe naam" }), true);
  assert.equal(hooks.isCardEligible(restrictedCard, state, { id: "player_2", name: "Winnie" }), false);
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
  assert.ok(session.candidateCardIds.length <= 10);
  assert.ok(session.candidateCardIds.length >= 3);
  assert.equal(session.candidateCardIds.some((id) => hooks.isSpecialCard(hooks.getCardById(id))), false);
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

console.log("All Date Roulette tests passed.");
