import { ALL_CARDS, CARD_COUNTS, validateCards as validateImportedCards } from "./cards/index.js";
import { GAME_RULES } from "./cards/rules.js";

"use strict";

const STORAGE_KEYS = {
  game: "dateRoulette.game",
  settings: "dateRoulette.settings",
  stats: "dateRoulette.stats",
  corruptBackupPrefix: "dateRoulette_corruptBackup_"
};

const STATE_VERSION = 3;
const MAX_LEVEL = 5;
const DEFAULT_PLAYERS = ["Winnie", "Tijgertje"];
const CARD_ANIMATION_LOCK_MS = 620;
const ACTION_LOCK_MS = 420;
const KISS_ANIMATION_MS = 1500;
const INSTALL_PROMPT_DELAY_MS = 1200;
const THEMES = new Set(["dark", "soft"]);

const CATEGORY_STYLES = {
  chaos: {
    label: "Chaos",
    emoji: "😂",
    color: "#ff7a4f",
    className: "category-chaos",
    effect: "shake"
  },
  makeup: {
    label: "Make-up",
    emoji: "💄",
    color: "#ff6fb5",
    className: "category-makeup",
    effect: "glitter"
  },
  blindfold: {
    label: "Blinddoek",
    emoji: "🙈",
    color: "#9e82ff",
    className: "category-blindfold",
    effect: "fade-dark"
  },
  cute: {
    label: "Cute",
    emoji: "❤️",
    color: "#ff8aa8",
    className: "category-cute",
    effect: "hearts"
  },
  flirty: {
    label: "Flirty",
    emoji: "😏",
    color: "#ff5f83",
    className: "category-flirty",
    effect: "pulse"
  },
  oohlala: {
    label: "Oohlala",
    emoji: "🔥",
    color: "#d51f3f",
    className: "category-oohlala",
    effect: "heat"
  },
  disney: {
    label: "Disney",
    emoji: "🐻",
    color: "#ffd56b",
    className: "category-disney",
    effect: "stars"
  },
  jacuzzi: {
    label: "Jacuzzi",
    emoji: "🛁",
    color: "#62d8ee",
    className: "category-jacuzzi",
    effect: "bubbles"
  },
  special: {
    label: "Special",
    emoji: "🏆",
    color: "#f6ce63",
    className: "category-special",
    effect: "gold-shine"
  }
};

const DATE_ROULETTE_CATEGORIES = Object.fromEntries(
  Object.entries(CATEGORY_STYLES).map(([id, config]) => [id, { ...config }])
);

const ONBOARDING_STEPS = [
  {
    title: "Date Roulette 💋",
    text: "Een kaartspel voor twee, vol grappige, lieve en spannende opdrachten."
  },
  {
    title: "Alles is optioneel",
    text: "Een opdracht aanpassen of overslaan mag altijd. WALIBI betekent direct stoppen."
  },
  {
    title: "Niet gedaan?",
    text: "Dan krijgt de speler volgens jullie spelregel een lippenstiftkus."
  }
];

const DATE_ROULETTE_LEVELS = Object.entries(GAME_RULES.categoryUnlocks || {}).reduce((levels, [level, categories]) => {
  levels[level] = {
    label: `Level ${level}`,
    categories
  };
  return levels;
}, {});

const levelRequirements = GAME_RULES.levelRequirementsPerPlayer || {
  1: 0,
  2: 4,
  3: 8,
  4: 12,
  5: 16
};

const deck = {
  cards: ALL_CARDS,
  categories: DATE_ROULETTE_CATEGORIES,
  categoryStyles: CATEGORY_STYLES,
  levels: DATE_ROULETTE_LEVELS,
  levelRequirements,
  cardCounts: CARD_COUNTS,
  gameRules: GAME_RULES,
  validateCards: validateDeckCards,
  createCardSummary
};

window.DateRouletteDeck = deck;

const LEVEL_UNLOCK_COPY = {
  2: {
    title: "🔓 Level 2 vrijgespeeld",
    text: "Make-over en Flirty zijn nu beschikbaar."
  },
  3: {
    title: "🔓 Level 3 vrijgespeeld",
    text: "Blinddoek-opdrachten zijn nu beschikbaar."
  },
  4: {
    title: "🔓 Level 4 vrijgespeeld",
    text: "Oohlala en Spelen met spanning zijn nu beschikbaar."
  },
  5: {
    title: "🔓 Level 5 vrijgespeeld",
    text: "Alle kaarten en speciale opdrachten zijn nu beschikbaar."
  }
};

let recoveryNotice = null;
let settings = loadSettings();
let stats = loadStats();
let game = loadGame();
stats = mergeStats(game.statistics, stats);
game.statistics = stats;
settings.levelSystemEnabled = game.levelSystemEnabled;
syncStatsWithPlayers();

let activeScreen = "home";
let timerTickId = null;
let specialTimerTickId = null;
let toastTimeoutId = null;
let cardDrawLocked = false;
let actionLocked = false;
let deferredInstallPrompt = null;
let serviceWorkerRegistration = null;
let wakeLockSentinel = null;
let onboardingStepIndex = 0;
let audioContext = null;
let kissAnimationTimeoutId = null;
let updateWaitingWorker = null;

const ui = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
  applyTheme(settings.theme);
  resumeJacuzziClock();
  cacheElements();
  bindEvents();
  registerServiceWorker();
  setupInstallPrompt();
  runCardValidation(false);
  saveGame();
  saveStats();
  showScreen(game.activeGame && game.specialSession ? "game" : "home");
  renderOnboarding();
  window.setTimeout(maybeShowInstallPrompt, INSTALL_PROMPT_DELAY_MS);
  if (recoveryNotice) {
    window.setTimeout(() => showToast(recoveryNotice), 350);
  }
}

function cacheElements() {
  ui.screens = document.querySelectorAll(".screen");
  ui.homePlayerOne = document.querySelector("#home-player-one");
  ui.homePlayerTwo = document.querySelector("#home-player-two");
  ui.homeLevel = document.querySelector("#home-level");
  ui.homeKisses = document.querySelector("#home-kisses");
  ui.newGameButton = document.querySelector("#new-game-button");
  ui.continueButton = document.querySelector("#continue-button");
  ui.settingsButton = document.querySelector("#settings-button");
  ui.helpButton = document.querySelector("#help-button");
  ui.statsButton = document.querySelector("#stats-button");

  ui.setupForm = document.querySelector("#setup-form");
  ui.setupPlayerOne = document.querySelector("#setup-player-one");
  ui.setupPlayerTwo = document.querySelector("#setup-player-two");

  ui.turnPlayer = document.querySelector("#turn-player");
  ui.endGameButton = document.querySelector("#end-game-button");
  ui.scorePlayerOne = document.querySelector("#score-player-one");
  ui.scorePlayerTwo = document.querySelector("#score-player-two");
  ui.gameLevel = document.querySelector("#game-level");
  ui.levelStatusTitle = document.querySelector("#level-status-title");
  ui.levelNextText = document.querySelector("#level-next-text");
  ui.progressPlayerOneLabel = document.querySelector("#progress-player-one-label");
  ui.progressPlayerTwoLabel = document.querySelector("#progress-player-two-label");
  ui.progressBarOne = document.querySelector("#progress-bar-one");
  ui.progressBarTwo = document.querySelector("#progress-bar-two");
  ui.availableCategories = document.querySelector("#available-categories");
  ui.jacuzziToggle = document.querySelector("#jacuzzi-toggle");
  ui.jacuzziStatus = document.querySelector("#jacuzzi-status");
  ui.bubbleMeter = document.querySelector("#bubble-meter");
  ui.wakeStatus = document.querySelector("#wake-status");
  ui.toast = document.querySelector("#toast");
  ui.kissAnimation = document.querySelector("#kiss-animation");
  ui.kissAnimationText = document.querySelector("#kiss-animation-text");
  ui.cardStack = document.querySelector("#card-stack");
  ui.deckCount = document.querySelector("#deck-count");
  ui.cardCategory = document.querySelector("#card-category");
  ui.cardProgress = document.querySelector("#card-progress");
  ui.cardEmoji = document.querySelector("#card-emoji");
  ui.cardTitle = document.querySelector("#card-title");
  ui.cardText = document.querySelector("#card-text");
  ui.cardTimerBadge = document.querySelector("#card-timer-badge");
  ui.cardSafetyNote = document.querySelector("#card-safety-note");
  ui.timerPanel = document.querySelector("#timer-panel");
  ui.timerReadout = document.querySelector("#timer-readout");
  ui.timerStart = document.querySelector("#timer-start");
  ui.timerPause = document.querySelector("#timer-pause");
  ui.timerReset = document.querySelector("#timer-reset");
  ui.emptyState = document.querySelector("#empty-state");
  ui.emptyMessage = document.querySelector("#empty-message");
  ui.normalEmptyActions = document.querySelector("#normal-empty-actions");
  ui.jacuzziEmptyActions = document.querySelector("#jacuzzi-empty-actions");
  ui.reshuffleButton = document.querySelector("#reshuffle-button");
  ui.jacuzziOffEmptyButton = document.querySelector("#jacuzzi-off-empty-button");
  ui.reshuffleJacuzziButton = document.querySelector("#reshuffle-jacuzzi-button");
  ui.homeEmptyButton = document.querySelector("#home-empty-button");
  ui.doneButton = document.querySelector("#done-button");
  ui.notDoneButton = document.querySelector("#not-done-button");
  ui.jacuzziReplaceButton = document.querySelector("#jacuzzi-replace-button");
  ui.newCardButton = document.querySelector("#new-card-button");

  ui.settingsForm = document.querySelector("#settings-form");
  ui.settingsPlayerOne = document.querySelector("#settings-player-one");
  ui.settingsPlayerTwo = document.querySelector("#settings-player-two");
  ui.themeSetting = document.querySelector("#theme-setting");
  ui.soundSetting = document.querySelector("#sound-setting");
  ui.vibrationSetting = document.querySelector("#vibration-setting");
  ui.levelsSetting = document.querySelector("#levels-setting");
  ui.levelsSettingState = document.querySelector("#levels-setting-state");
  ui.fullscreenSetting = document.querySelector("#fullscreen-setting");
  ui.fullscreenSettingState = document.querySelector("#fullscreen-setting-state");
  ui.wakeLockSetting = document.querySelector("#wake-lock-setting");
  ui.developerSetting = document.querySelector("#developer-setting");
  ui.developerTools = document.querySelector("#developer-tools");
  ui.devAddPlayerOne = document.querySelector("#dev-add-player-one");
  ui.devAddPlayerTwo = document.querySelector("#dev-add-player-two");
  ui.devResetProgress = document.querySelector("#dev-reset-progress");
  ui.devUnlockAll = document.querySelector("#dev-unlock-all");
  ui.devResetJacuzzi = document.querySelector("#dev-reset-jacuzzi");
  ui.devLogState = document.querySelector("#dev-log-state");
  ui.devAddSkips = document.querySelector("#dev-add-skips");
  ui.devAddUpgrades = document.querySelector("#dev-add-upgrades");
  ui.devStartRoulette = document.querySelector("#dev-start-roulette");
  ui.devStartPerfectRun = document.querySelector("#dev-start-perfect-run");
  ui.devStartTension = document.querySelector("#dev-start-tension");
  ui.devStartDouble = document.querySelector("#dev-start-double");
  ui.devClearSpecial = document.querySelector("#dev-clear-special");
  ui.devLogHistory = document.querySelector("#dev-log-history");
  ui.devValidateCards = document.querySelector("#dev-validate-cards");
  ui.devRecalculateStats = document.querySelector("#dev-recalculate-stats");
  ui.devCardReport = document.querySelector("#dev-card-report");

  ui.statTotal = document.querySelector("#stat-total");
  ui.statDone = document.querySelector("#stat-done");
  ui.statNotDone = document.querySelector("#stat-not-done");
  ui.statKissesOne = document.querySelector("#stat-kisses-one");
  ui.statKissesTwo = document.querySelector("#stat-kisses-two");
  ui.statCompletedOne = document.querySelector("#stat-completed-one");
  ui.statCompletedTwo = document.querySelector("#stat-completed-two");
  ui.statTopCategory = document.querySelector("#stat-top-category");
  ui.statLevel = document.querySelector("#stat-level");
  ui.statJacuzzi = document.querySelector("#stat-jacuzzi");
  ui.statJacuzziCards = document.querySelector("#stat-jacuzzi-cards");
  ui.statJacuzziReplaced = document.querySelector("#stat-jacuzzi-replaced");
  ui.statJacuzziTime = document.querySelector("#stat-jacuzzi-time");
  ui.statLevelUnlocks = document.querySelector("#stat-level-unlocks");
  ui.statSpecials = document.querySelector("#stat-specials");
  ui.statCardsTotal = document.querySelector("#stat-cards-total");
  ui.statCardsPlayable = document.querySelector("#stat-cards-playable");
  ui.statCardCategories = document.querySelector("#stat-card-categories");

  ui.bottomNav = document.querySelector("#bottom-nav");
  ui.navButtons = document.querySelectorAll("[data-nav-screen]");
  ui.endWinnerLine = document.querySelector("#end-winner-line");
  ui.endSummaryList = document.querySelector("#end-summary-list");
  ui.endHomeButton = document.querySelector("#end-home-button");
  ui.endNewRoundButton = document.querySelector("#end-new-round-button");
  ui.endStatsButton = document.querySelector("#end-stats-button");
  ui.onboardingModal = document.querySelector("#onboarding-modal");
  ui.onboardingStepLabel = document.querySelector("#onboarding-step-label");
  ui.onboardingTitle = document.querySelector("#onboarding-title");
  ui.onboardingText = document.querySelector("#onboarding-text");
  ui.onboardingDots = document.querySelector("#onboarding-dots");
  ui.onboardingSkipButton = document.querySelector("#onboarding-skip-button");
  ui.onboardingNextButton = document.querySelector("#onboarding-next-button");
  ui.installPrompt = document.querySelector("#install-prompt");
  ui.installPromptText = document.querySelector("#install-prompt-text");
  ui.installButton = document.querySelector("#install-button");
  ui.installDismissButton = document.querySelector("#install-dismiss-button");
  ui.updatePrompt = document.querySelector("#update-prompt");
  ui.updateRefreshButton = document.querySelector("#update-refresh-button");
  ui.updateDismissButton = document.querySelector("#update-dismiss-button");

  ui.levelModal = document.querySelector("#level-modal");
  ui.levelModalTitle = document.querySelector("#level-modal-title");
  ui.levelModalText = document.querySelector("#level-modal-text");
  ui.levelModalCategories = document.querySelector("#level-modal-categories");
  ui.levelContinueButton = document.querySelector("#level-continue-button");
  ui.specialModal = document.querySelector("#special-modal");
  ui.specialModalContent = document.querySelector("#special-modal-content");
}

function bindEvents() {
  ui.newGameButton.addEventListener("click", openSetup);
  ui.continueButton.addEventListener("click", continueGame);
  ui.settingsButton.addEventListener("click", () => showScreen("settings"));
  ui.helpButton.addEventListener("click", () => showScreen("help"));
  ui.statsButton.addEventListener("click", () => showScreen("stats"));

  document.querySelectorAll("[data-action='home']").forEach((button) => {
    button.addEventListener("click", () => requestHomeNavigation());
  });

  ui.setupForm.addEventListener("submit", handleSetupSubmit);
  ui.settingsForm.addEventListener("submit", handleSettingsSubmit);
  ui.themeSetting.addEventListener("change", handleThemePreview);
  ui.fullscreenSetting.addEventListener("change", handleFullscreenSettingToggle);
  ui.wakeLockSetting.addEventListener("change", handleWakeLockSettingToggle);
  ui.endGameButton.addEventListener("click", requestEndGame);
  ui.cardStack.addEventListener("click", drawCard);
  ui.cardStack.addEventListener("pointerdown", handleDeckPointerDown);
  ui.doneButton.addEventListener("click", () => resolveCurrentCard(true));
  ui.notDoneButton.addEventListener("click", () => resolveCurrentCard(false));
  ui.jacuzziReplaceButton.addEventListener("click", replaceJacuzziCard);
  ui.newCardButton.addEventListener("click", drawReplacementCard);
  ui.reshuffleButton.addEventListener("click", reshuffleCards);
  ui.jacuzziOffEmptyButton.addEventListener("click", turnOffJacuzziFromEmpty);
  ui.reshuffleJacuzziButton.addEventListener("click", reshuffleJacuzziCards);
  ui.homeEmptyButton.addEventListener("click", () => showScreen("home"));
  ui.jacuzziToggle.addEventListener("change", handleJacuzziToggle);
  ui.timerStart.addEventListener("click", startTimer);
  ui.timerPause.addEventListener("click", pauseTimer);
  ui.timerReset.addEventListener("click", resetTimer);
  ui.levelContinueButton.addEventListener("click", continueAfterLevelUnlock);
  ui.developerSetting.addEventListener("change", handleDeveloperToggle);
  ui.devAddPlayerOne.addEventListener("click", () => addDeveloperCompletion(0));
  ui.devAddPlayerTwo.addEventListener("click", () => addDeveloperCompletion(1));
  ui.devResetProgress.addEventListener("click", resetDeveloperProgress);
  ui.devUnlockAll.addEventListener("click", unlockAllDeveloperLevels);
  ui.devResetJacuzzi.addEventListener("click", resetDeveloperJacuzziDeck);
  ui.devLogState.addEventListener("click", logDeveloperState);
  ui.devAddSkips.addEventListener("click", addDeveloperSkips);
  ui.devAddUpgrades.addEventListener("click", addDeveloperUpgradeCompletions);
  ui.devStartRoulette.addEventListener("click", () => startDeveloperSpecial("roulette"));
  ui.devStartPerfectRun.addEventListener("click", () => startDeveloperSpecial("perfectRun"));
  ui.devStartTension.addEventListener("click", () => startDeveloperSpecial("playWithTension"));
  ui.devStartDouble.addEventListener("click", () => startDeveloperSpecial("doubleSpicy"));
  ui.devClearSpecial.addEventListener("click", clearDeveloperSpecialSession);
  ui.devLogHistory.addEventListener("click", logDeveloperHistory);
  ui.devValidateCards.addEventListener("click", () => runCardValidation(true));
  ui.devRecalculateStats.addEventListener("click", recalculateDeveloperStats);

  ui.navButtons.forEach((button) => {
    button.addEventListener("click", () => requestBottomNavigation(button.dataset.navScreen));
  });
  ui.endHomeButton.addEventListener("click", () => showScreen("home"));
  ui.endNewRoundButton.addEventListener("click", startAnotherRound);
  ui.endStatsButton.addEventListener("click", () => showScreen("stats"));
  ui.onboardingSkipButton.addEventListener("click", completeOnboarding);
  ui.onboardingNextButton.addEventListener("click", advanceOnboarding);
  ui.installButton.addEventListener("click", installApp);
  ui.installDismissButton.addEventListener("click", dismissInstallPrompt);
  ui.updateRefreshButton.addEventListener("click", refreshForUpdate);
  ui.updateDismissButton.addEventListener("click", () => {
    ui.updatePrompt.hidden = true;
  });

  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window.addEventListener("appinstalled", handleAppInstalled);
  window.addEventListener("pagehide", handlePageExit);
  window.addEventListener("beforeunload", handleBeforeUnload);
  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  document.addEventListener("pointerdown", unlockAudioContext, { once: true });
}

function requestBottomNavigation(screenName) {
  const targetScreen = screenName === "game" ? (game.activeGame ? "game" : "home") : screenName;
  if (game.specialSession && targetScreen !== "game" && !window.confirm("Deze opdracht is nog bezig. Weet je zeker dat je wilt weggaan?")) {
    return;
  }

  showScreen(targetScreen);
}

function requestHomeNavigation() {
  if (game.specialSession && !window.confirm("Deze opdracht is nog bezig. Weet je zeker dat je wilt weggaan?")) {
    return;
  }

  showScreen("home");
}

function handleDeckPointerDown() {
  if (!game.activeGame || game.currentCardId || cardDrawLocked || game.emptyDeckReason) {
    return;
  }

  ui.cardStack.classList.add("is-pressed");
  vibrate(14);
  window.setTimeout(() => ui.cardStack.classList.remove("is-pressed"), 160);
}

function handleThemePreview() {
  settings.theme = normalizeTheme(ui.themeSetting.value);
  applyTheme(settings.theme);
  saveSettings();
}

function handleFullscreenSettingToggle() {
  settings.fullscreenEnabled = ui.fullscreenSetting.checked;
  saveSettings();

  if (settings.fullscreenEnabled) {
    requestFullscreenMode();
  } else {
    exitFullscreenMode();
  }

  renderSettings();
}

function handleWakeLockSettingToggle() {
  settings.wakeLockEnabled = ui.wakeLockSetting.checked;
  saveSettings();
  updateWakeLock();
  renderGame();
}

function handleFullscreenChange() {
  settings.fullscreenEnabled = Boolean(document.fullscreenElement);
  saveSettings();
  renderSettings();
}

function openSetup() {
  const players = game.players || createDefaultPlayers();
  ui.setupPlayerOne.value = players[0].name || DEFAULT_PLAYERS[0];
  ui.setupPlayerTwo.value = players[1].name || DEFAULT_PLAYERS[1];
  showScreen("setup");
}

function continueGame() {
  if (!game.activeGame) {
    return;
  }

  showScreen("game");
}

function handleSetupSubmit(event) {
  event.preventDefault();
  const playerOne = cleanName(ui.setupPlayerOne.value, DEFAULT_PLAYERS[0]);
  const playerTwo = cleanName(ui.setupPlayerTwo.value, DEFAULT_PLAYERS[1]);

  game = createNewGame(playerOne, playerTwo);
  stats = createDefaultStats();
  game.statistics = stats;
  saveGame();
  saveStats();
  showScreen("game");
  playSound("done");
  vibrate([18, 26, 18]);
  showToast("Nieuw spel gestart.");
}

function handleSettingsSubmit(event) {
  event.preventDefault();
  const playerOne = cleanName(ui.settingsPlayerOne.value, DEFAULT_PLAYERS[0]);
  const playerTwo = cleanName(ui.settingsPlayerTwo.value, DEFAULT_PLAYERS[1]);
  const levelSystemWasEnabled = game.levelSystemEnabled;

  game.players[0].name = playerOne;
  game.players[1].name = playerTwo;
  settings.theme = normalizeTheme(ui.themeSetting.value);
  settings.soundEnabled = ui.soundSetting.checked;
  settings.vibrationEnabled = ui.vibrationSetting.checked;
  settings.levelSystemEnabled = ui.levelsSetting.checked;
  settings.fullscreenEnabled = Boolean(ui.fullscreenSetting.checked && isFullscreenSupported());
  settings.wakeLockEnabled = ui.wakeLockSetting.checked;
  settings.developerMode = ui.developerSetting.checked;
  game.levelSystemEnabled = settings.levelSystemEnabled;
  applyTheme(settings.theme);

  if (game.levelSystemEnabled) {
    game.currentLevel = calculateEarnedLevel(game.players);
    markLevelsAsSeenThrough(game.currentLevel);
  } else if (levelSystemWasEnabled) {
    game.currentLevel = calculateEarnedLevel(game.players);
  }

  const currentCard = getCurrentCard();
  if (currentCard && !isCardEligible(currentCard)) {
    clearCurrentCard({ releaseUsed: true });
  }

  saveGame();
  saveSettings();
  updateWakeLock();
  showScreen("home");
  showToast("Instellingen opgeslagen.");
}

function requestEndGame() {
  if (!game.activeGame) {
    showScreen("end");
    return;
  }

  if (game.specialSession && !window.confirm("Deze opdracht is nog bezig. Weet je zeker dat je wilt stoppen?")) {
    return;
  }

  if (!window.confirm("Spel beëindigen en de samenvatting bekijken?")) {
    return;
  }

  pauseTimer();
  stopSpecialTimerInterval();
  finalizeJacuzziTime();
  game.activeGame = false;
  game.endedAt = Date.now();
  game.specialSession = null;
  game.activePerfectRun = null;
  game.jacuzziMode = false;
  game.jacuzziModeStartedAt = null;
  saveGame();
  saveStats();
  updateWakeLock();
  showScreen("end");
}

function startAnotherRound() {
  const previousPlayers = game.players || createDefaultPlayers();
  const resetKisses = window.confirm("Kusjestellers resetten voor de nieuwe ronde?");
  const nextGame = createNewGame(previousPlayers[0].name, previousPlayers[1].name);
  if (!resetKisses) {
    nextGame.players[0].lipstickKisses = Number(previousPlayers[0].lipstickKisses) || 0;
    nextGame.players[0].kisses = nextGame.players[0].lipstickKisses;
    nextGame.players[1].lipstickKisses = Number(previousPlayers[1].lipstickKisses) || 0;
    nextGame.players[1].kisses = nextGame.players[1].lipstickKisses;
  }

  game = nextGame;
  game.statistics = stats;
  saveGame();
  saveStats();
  showScreen("game");
  showToast("Nieuwe ronde gestart.");
}

function handleDeveloperToggle() {
  settings.developerMode = ui.developerSetting.checked;
  saveSettings();
  renderSettings();
}

function handleJacuzziToggle() {
  if (ui.jacuzziToggle.checked) {
    enableJacuzziMode();
  } else {
    disableJacuzziMode();
  }

  saveGame();
  saveStats();
  renderGame();
}

function enableJacuzziMode() {
  if (game.jacuzziMode) {
    return;
  }

  game.jacuzziMode = true;
  game.emptyDeckReason = null;
  game.temporaryRejectedCardIds = [];
  startJacuzziClock();
  stats.jacuzziUseCount += 1;
  debugLog("jacuzzi_enabled", { playerIndex: game.currentPlayerIndex });
  playSound("special");
  vibrate([18, 28, 18]);

  const currentCard = getCurrentCard();
  if (currentCard && !isCardEligible(currentCard)) {
    clearCurrentCard({ releaseUsed: true });
    showToast("Nieuwe jacuzzi-geschikte opdracht zoeken… 🛁");
  }
}

function disableJacuzziMode() {
  if (!game.jacuzziMode) {
    return;
  }

  finalizeJacuzziTime();
  game.jacuzziMode = false;
  game.jacuzziModeStartedAt = null;
  game.temporaryRejectedCardIds = [];
  game.emptyDeckReason = null;
  debugLog("jacuzzi_disabled", { playerIndex: game.currentPlayerIndex });
  vibrate(12);

  const currentCard = getCurrentCard();
  if (currentCard && currentCard.requiresJacuzzi) {
    clearCurrentCard({ releaseUsed: true });
  }
}

function turnOffJacuzziFromEmpty() {
  disableJacuzziMode();
  saveGame();
  saveStats();
  renderGame();
  showToast("Jacuzzi-modus uitgezet.");
}

function drawCard() {
  if (!game.activeGame || game.currentCardId || cardDrawLocked || game.emptyDeckReason) {
    return;
  }

  const nextCard = pickRandomCard();
  if (!nextCard) {
    renderEmptyState();
    return;
  }

  drawSelectedCard(nextCard);
}

function drawSelectedCard(card) {
  lockCardDraw();
  setCurrentCard(card);
  recordCardDraw(card);
  playSound("draw");
  vibrate(18);
  if (isSpecialCard(card)) {
    handleSpecialCard(card, game);
    playSound("special");
    vibrate([18, 35, 18]);
    saveGame();
    saveStats();
    renderGame();
    return;
  }

  saveGame();
  saveStats();
  renderGame();
}

function drawReplacementCard() {
  if (!game.currentCardId || game.cardResolved || cardDrawLocked) {
    return;
  }

  clearCurrentCard();
  const nextCard = pickRandomCard();
  if (!nextCard) {
    renderEmptyState();
    saveGame();
    return;
  }

  drawSelectedCard(nextCard);
}

function replaceJacuzziCard() {
  const currentCard = getCurrentCard();
  if (!currentCard || game.cardResolved || !game.jacuzziMode || cardDrawLocked) {
    return;
  }

  pauseTimer();
  removeUsedCard(currentCard.id);
  game.currentCardId = null;
  game.cardResolved = false;
  game.timer = createDefaultTimer();
  game.temporaryRejectedCardIds = uniqueStrings([...game.temporaryRejectedCardIds, currentCard.id]);
  game.emptyDeckReason = null;
  stats.jacuzziReplacementCount += 1;
  showToast("Nieuwe jacuzzi-geschikte opdracht zoeken… 🛁");

  const nextCard = pickRandomCard({ additionalExcludedIds: [currentCard.id] });
  if (!nextCard) {
    game.temporaryRejectedCardIds = [];
    game.emptyDeckReason = "jacuzzi";
    saveGame();
    saveStats();
    renderGame();
    return;
  }

  drawSelectedCard(nextCard);
}

function resolveCurrentCard(wasDone) {
  const currentCard = getCurrentCard();
  if (!currentCard || game.cardResolved || game.specialSession || actionLocked) {
    return;
  }

  lockAction();
  pauseTimer();
  game.cardResolved = true;
  const player = getCurrentPlayer();
  player.completedCards += 1;
  stats.completedByPlayer[player.id] = player.completedCards;

  if (wasDone) {
    stats.doneCount += 1;
    game.completedCardIds = uniqueStrings([...game.completedCardIds, currentCard.id]);
    addCardHistory({
      cardId: currentCard.id,
      parentSpecialCardId: null,
      playerIndex: game.currentPlayerIndex,
      result: "completed",
      variant: "normal"
    });
    showToast("Opdracht afgerond.");
    playSound("done");
    vibrate([18, 28, 18]);
    debugLog("card_completed", { cardId: currentCard.id, playerIndex: game.currentPlayerIndex });
  } else {
    addLipstickKiss(game.currentPlayerIndex, "normal_skip");
    stats.notDoneCount += 1;
    game.skippedCardIds = uniqueStrings([...game.skippedCardIds, currentCard.id]);
    addCardHistory({
      cardId: currentCard.id,
      parentSpecialCardId: null,
      playerIndex: game.currentPlayerIndex,
      result: "skipped",
      variant: "normal"
    });
    debugLog("card_skipped", { cardId: currentCard.id, playerIndex: game.currentPlayerIndex });
  }

  const unlockedLevel = updateLevelAfterCompletedCard();
  saveStats();
  saveGame();
  renderGame();

  if (unlockedLevel) {
    game.pendingTurnAdvance = true;
    game.pendingUnlockLevel = unlockedLevel;
    saveGame();
    renderLevelModal();
    return;
  }

  finishTurn(wasDone ? 450 : 900);
}

function finishTurn(delayMs) {
  window.setTimeout(() => {
    switchTurn();
    clearCurrentCard();
    game.temporaryRejectedCardIds = [];
    game.emptyDeckReason = null;
    saveGame();
    renderGame();
  }, delayMs);
}

function continueAfterLevelUnlock() {
  if (!game.pendingTurnAdvance) {
    ui.levelModal.hidden = true;
    return;
  }

  game.pendingTurnAdvance = false;
  game.pendingUnlockLevel = null;
  ui.levelModal.hidden = true;
  saveGame();
  finishTurn(0);
}

function switchTurn() {
  game.currentPlayerIndex = game.currentPlayerIndex === 0 ? 1 : 0;
  debugLog("turn_switched", { currentPlayerIndex: game.currentPlayerIndex });
}

function reshuffleCards() {
  game.usedCardIds = [];
  game.emptyDeckReason = null;
  clearCurrentCard();
  saveGame();
  renderGame();
  showToast("Kaarten opnieuw geschud.");
}

function reshuffleJacuzziCards() {
  const jacuzziCardIds = deck.cards
    .filter((card) => card.requiresJacuzzi)
    .map((card) => card.id);
  game.usedCardIds = game.usedCardIds.filter((id) => !jacuzziCardIds.includes(id));
  game.temporaryRejectedCardIds = [];
  game.emptyDeckReason = null;
  saveGame();
  renderGame();
  showToast("Gebruikte jacuzzi-kaarten opnieuw geschud.");
}

function setCurrentCard(card) {
  game.currentCardId = card.id;
  game.cardResolved = false;
  game.emptyDeckReason = null;
  game.usedCardIds = uniqueStrings([...game.usedCardIds, card.id]);

  if (card.timerSeconds) {
    game.timer = {
      cardId: card.id,
      remainingSeconds: card.timerSeconds,
      isRunning: false,
      startedAt: null
    };
  } else {
    game.timer = createDefaultTimer();
  }
}

function clearCurrentCard(options = {}) {
  const currentCardId = game.currentCardId;
  stopTimerInterval();
  if (options.releaseUsed && currentCardId) {
    removeUsedCard(currentCardId);
  }
  game.currentCardId = null;
  game.cardResolved = false;
  game.timer = createDefaultTimer();
}

function getCurrentPlayer() {
  return game.players[game.currentPlayerIndex] || game.players[0];
}

function getCurrentCard() {
  return deck.cards.find((card) => card.id === game.currentCardId) || null;
}

function pickRandomCard(options = {}) {
  const cards = getAvailableCards(options);
  if (!cards.length) {
    return null;
  }

  const index = Math.floor(Math.random() * cards.length);
  return cards[index];
}

function getAvailableCards(options = {}) {
  const excludedIds = new Set([...(options.additionalExcludedIds || [])]);
  if (!options.includeUsed) {
    game.usedCardIds.forEach((id) => excludedIds.add(id));
  }
  if (!options.ignoreTemporaryRejected) {
    game.temporaryRejectedCardIds.forEach((id) => excludedIds.add(id));
  }

  return deck.cards.filter((card) => {
    if (excludedIds.has(card.id)) {
      return false;
    }

    if (options.excludeSpecial && isSpecialCard(card)) {
      return false;
    }

    if (options.onlySpecial && !isSpecialCard(card)) {
      return false;
    }

    if (options.category && card.category !== options.category) {
      return false;
    }

    return isCardEligible(card, options.state || game, options.player || getCurrentPlayer());
  });
}

function getMatchingCards() {
  return deck.cards.filter(isCardEligible);
}

function isCardEligible(card, state = game, player = getCurrentPlayer()) {
  if (!card) {
    return false;
  }

  const effectiveLevel = state.levelSystemEnabled ? state.currentLevel : MAX_LEVEL;
  if (Number(card.level || 1) > effectiveLevel) {
    return false;
  }

  if (!isPlayerAllowed(card, player)) {
    return false;
  }

  if (state.jacuzziMode) {
    if (card.requiresJacuzzi) {
      return true;
    }

    return card.jacuzziAllowed === true;
  }

  if (card.requiresJacuzzi) {
    return false;
  }

  return true;
}

function isPlayerAllowed(card, player) {
  const restriction = card.playerRestriction;
  if (!restriction) {
    return true;
  }

  const normalizedRestriction = String(restriction).trim().toLowerCase();
  const normalizedName = String(player.name || "").trim().toLowerCase();
  if (normalizedRestriction === player.id || normalizedRestriction === normalizedName) {
    return true;
  }

  if (normalizedRestriction === "winnie") {
    return player.id === "player_1";
  }

  if (normalizedRestriction === "tijgertje") {
    return player.id === "player_2";
  }

  return false;
}

function updateLevelAfterCompletedCard() {
  const earnedLevel = calculateEarnedLevel(game.players);
  if (!game.levelSystemEnabled) {
    game.currentLevel = earnedLevel;
    return null;
  }

  const previousLevel = game.currentLevel;
  game.currentLevel = earnedLevel;
  if (earnedLevel <= previousLevel) {
    return null;
  }

  const unlockedLevel = findFirstUnseenLevel(previousLevel + 1, earnedLevel);
  if (!unlockedLevel) {
    return null;
  }

  markLevelUnlocked(unlockedLevel);
  return unlockedLevel;
}

function findFirstUnseenLevel(startLevel, endLevel) {
  for (let level = startLevel; level <= endLevel; level += 1) {
    if (!game.unlockedLevels.includes(level)) {
      return level;
    }
  }

  return null;
}

function markLevelUnlocked(level) {
  game.unlockedLevels = uniqueNumbers([...game.unlockedLevels, level]).sort((a, b) => a - b);
  if (!stats.levelUnlockedAt[level]) {
    stats.levelUnlockedAt[level] = new Date().toISOString();
  }
  if (level > 1) {
    playSound("level");
    vibrate([28, 45, 28, 45, 40]);
  }
  debugLog("level_unlocked", { level });
}

function markLevelsAsSeenThrough(level) {
  for (let currentLevel = 1; currentLevel <= level; currentLevel += 1) {
    markLevelUnlocked(currentLevel);
  }
}

function calculateEarnedLevel(players) {
  const completedCounts = players.map((player) => Number(player.completedCards) || 0);
  const minimumCompleted = Math.min(...completedCounts);
  let earnedLevel = 1;

  Object.entries(levelRequirements).forEach(([level, requirement]) => {
    if (minimumCompleted >= requirement) {
      earnedLevel = Number(level);
    }
  });

  return clampLevel(earnedLevel);
}

function getEffectiveLevel() {
  return game.levelSystemEnabled ? game.currentLevel : MAX_LEVEL;
}

function isSpecialCard(card) {
  return card && card.category === "special" && Boolean(card.specialType);
}

function handleSpecialCard(card, gameState) {
  if (!isSpecialCard(card)) {
    return false;
  }

  const type = normalizeSpecialType(card.specialType);
  debugLog("special_started", { cardId: card.id, type, playerIndex: gameState.currentPlayerIndex });
  const baseSession = {
    type,
    parentCardId: card.id,
    playerIndex: gameState.currentPlayerIndex,
    selectedCardIds: [],
    candidateCardIds: [],
    currentStep: 0,
    results: [],
    startedAt: Date.now(),
    phase: "start",
    customText: "",
    timer: createDefaultTimer()
  };

  switch (type) {
    case "roulette":
      return startSelectionSpecial(baseSession, {
        stat: "rouletteCardsStarted",
        title: "Roulette",
        instruction: `${getOtherPlayerName()} kiest precies drie opdrachten voor ${getCurrentPlayer().name}.`,
        cards: getShuffledAvailableNormalCards().slice(0, 10),
        requiredCount: 3,
        fallbackText: "Geen geschikte Roulette-kaarten beschikbaar.",
        autoSelectWhenBelowRequired: true
      });
    case "flirtyChoice":
      return startSelectionSpecial(baseSession, {
        title: "Flirty-keuze",
        instruction: `${getOtherPlayerName()} kiest één flirty opdracht voor ${getCurrentPlayer().name}.`,
        cards: getShuffledAvailableNormalCards({ category: "flirty" }).slice(0, 5),
        requiredCount: 1,
        fallbackText: "Geen geschikte Flirty-kaarten beschikbaar."
      });
    case "playWithTension":
      stats.tensionCardsStarted += 1;
      return startSelectionSpecial(baseSession, {
        title: "Spelen met spanning",
        instruction: "Kies samen één eerder geweigerde opdracht om alsnog te proberen.",
        cards: getHistoryCards("skipped", { requiresText: false }).slice(0, 15),
        requiredCount: 1,
        fallbackText: "Jullie hebben nog geen opdrachten geweigerd. Trek een normale kaart.",
        fallbackButton: "Normale kaart trekken"
      });
    case "doubleSpicy":
      stats.upgradedCardsStarted += 1;
      return startSelectionSpecial(baseSession, {
        title: "Dubbel zo spannend",
        instruction: "Kies een eerder uitgevoerde kaart en speel de spannendere variant.",
        cards: getHistoryCards("completed", { requiresUpgrade: true }).slice(0, 15),
        requiredCount: 1,
        fallbackText: "Er zijn nog geen geschikte opdrachten om te upgraden.",
        fallbackButton: "Normale kaart trekken"
      });
    case "lighterVersion":
      return startSelectionSpecial(baseSession, {
        title: "Lichtere versie",
        instruction: "Kies een eerder geweigerde kaart en speel de lichtere variant.",
        cards: getHistoryCards("skipped", { requiresLighter: true }).slice(0, 15),
        requiredCount: 1,
        fallbackText: "Er zijn nog geen geweigerde opdrachten met een lichtere versie.",
        fallbackButton: "Normale kaart trekken"
      });
    case "perfectRun":
      return startPerfectRun(baseSession);
    case "gift":
      return startSimpleSpecial(baseSession, { phase: "giftChoice" });
    case "winnieChoice":
    case "tijgertjeChoice":
      return startSimpleSpecial(baseSession, { phase: "roleChoiceInput" });
    case "golden":
      return startSimpleSpecial(baseSession, { phase: "customInput" });
    case "wild":
      return startSimpleSpecial(baseSession, { phase: "wildInput" });
    default:
      return fallbackToNormalCard("Deze speciale kaart is nog niet gekoppeld.");
  }
}

function normalizeSpecialType(type) {
  const aliases = {
    perfect_run: "perfectRun",
    double: "doubleSpicy",
    tension_rule: "playWithTension"
  };
  return aliases[type] || type;
}

function startSelectionSpecial(baseSession, config) {
  const cards = uniqueCards(config.cards);
  if (config.stat) {
    stats[config.stat] += 1;
  }

  if (!cards.length) {
    return startSpecialFallback(baseSession, config.fallbackText, config.fallbackButton);
  }

  const requiredCount = Math.min(config.requiredCount, cards.length);
  game.specialSession = {
    ...baseSession,
    phase: "select",
    title: config.title,
    instruction: config.instruction,
    candidateCardIds: cards.map((card) => card.id),
    requiredCount,
    allowCancel: true,
    fallbackText: config.fallbackText,
    fallbackButton: config.fallbackButton || "Normale kaart trekken"
  };

  if (config.autoSelectWhenBelowRequired && cards.length < config.requiredCount) {
    game.specialSession.selectedCardIds = cards.map((card) => card.id);
    game.specialSession.phase = "task";
  }

  saveGame();
  saveStats();
  renderSpecialSession();
  return true;
}

function startSimpleSpecial(baseSession, options) {
  game.specialSession = {
    ...baseSession,
    phase: options.phase
  };
  saveGame();
  renderSpecialSession();
  return true;
}

function startPerfectRun(baseSession) {
  const cards = getShuffledAvailableNormalCards().slice(0, 5);
  stats.perfectRunsStarted += 1;

  if (!cards.length) {
    return startSpecialFallback(baseSession, "Geen geschikte kaarten voor Perfecte Run.", "Normale kaart trekken");
  }

  game.specialSession = {
    ...baseSession,
    type: "perfectRun",
    phase: "perfectRunTask",
    selectedCardIds: cards.map((card) => card.id),
    currentStep: 0,
    successes: 0
  };
  game.activePerfectRun = {
    parentCardId: baseSession.parentCardId,
    playerIndex: baseSession.playerIndex,
    selectedCardIds: game.specialSession.selectedCardIds
  };
  markCardUsed(cards[0].id);
  saveGame();
  saveStats();
  renderSpecialSession();
  return true;
}

function startSpecialFallback(baseSession, message, buttonText = "Normale kaart trekken") {
  game.specialSession = {
    ...baseSession,
    phase: "fallback",
    fallbackText: message,
    fallbackButton: buttonText
  };
  saveGame();
  saveStats();
  renderSpecialSession();
  return false;
}

function fallbackToNormalCard(message) {
  showToast(message);
  clearCurrentCard({ releaseUsed: true });
  game.specialSession = null;
  game.activePerfectRun = null;
  const replacement = pickRandomCard({ excludeSpecial: true });
  if (replacement) {
    drawSelectedCard(replacement);
  } else {
    renderEmptyState();
  }
  return false;
}

function getShuffledAvailableNormalCards(options = {}) {
  return shuffleCards(getAvailableCards({
    ...options,
    excludeSpecial: true
  }));
}

function getHistoryCards(result, options = {}) {
  const seenIds = new Set();
  const cards = [];
  game.cardHistory.forEach((entry) => {
    if (entry.result !== result || seenIds.has(entry.cardId)) {
      return;
    }

    const card = deck.cards.find((item) => item.id === entry.cardId);
    if (!card || isSpecialCard(card) || !isCardEligible(card)) {
      return;
    }

    if (options.requiresUpgrade && !card.upgradeText) {
      return;
    }

    if (options.requiresLighter && !card.lighterText) {
      return;
    }

    seenIds.add(card.id);
    cards.push(card);
  });

  return shuffleCards(cards);
}

function renderSpecialSession() {
  stopSpecialTimerInterval();
  if (!ui.specialModal || !game.specialSession) {
    if (ui.specialModal) {
      ui.specialModal.hidden = true;
      delete ui.specialModal.dataset.specialType;
      ui.specialModalContent.textContent = "";
    }
    return;
  }

  ui.specialModal.hidden = false;
  ui.specialModalContent.replaceChildren();

  const session = game.specialSession;
  ui.specialModal.dataset.specialType = session.type;
  ui.specialModalContent.dataset.specialType = session.type;
  if (session.phase === "select") {
    renderSpecialSelection(session);
    return;
  }

  if (session.phase === "fallback") {
    renderSpecialFallback(session);
    return;
  }

  if (session.phase === "giftChoice") {
    renderGiftChoice(session);
    return;
  }

  if (session.phase === "giftResolve") {
    renderGiftResolve(session);
    return;
  }

  if (session.phase === "roleChoiceInput") {
    renderRoleChoiceInput(session);
    return;
  }

  if (session.phase === "customInput" || session.phase === "wildInput") {
    renderCustomInput(session);
    return;
  }

  if (session.phase === "customTask") {
    renderCustomTask(session);
    return;
  }

  if (session.phase === "task") {
    renderSpecialTask(session);
    return;
  }

  if (session.phase === "perfectRunTask") {
    renderPerfectRunTask(session);
    return;
  }

  if (session.phase === "perfectRunResult") {
    renderPerfectRunResult(session);
  }
}

function renderSpecialHeader(title, instruction) {
  const header = createElement("div", "special-header");
  header.append(
    createElement("p", "eyebrow", `Uitvoerder: ${game.players[game.specialSession.playerIndex].name}`),
    createElement("h3", null, title),
    createElement("p", "special-instruction", instruction)
  );
  ui.specialModalContent.append(header);
}

function renderSpecialSelection(session) {
  const selectedIds = new Set(session.selectedCardIds);
  renderSpecialHeader(session.title, session.instruction);
  ui.specialModalContent.append(
    createElement("p", "selection-count", `${selectedIds.size} / ${session.requiredCount} geselecteerd`)
  );

  const list = createElement("div", "selection-grid");
  session.candidateCardIds.forEach((cardId, index) => {
    const card = getCardById(cardId);
    if (!card) {
      return;
    }
    const category = deck.categories[card.category] || deck.categories.special;
    const classNames = [
      "selection-card",
      category.className || "",
      selectedIds.has(card.id) ? "is-selected" : "",
      session.type === "playWithTension" ? "is-history-skip" : ""
    ].filter(Boolean).join(" ");
    const button = createElement("button", classNames);
    button.type = "button";
    button.style.setProperty("--item-index", index);
    button.style.setProperty("--card-accent", category.color);
    button.append(
      createElement("span", "selection-card-title", `${category.emoji} ${card.title}`),
      createElement("span", "selection-card-text", card.text),
      createElement("span", "selection-indicator", selectedIds.has(card.id) ? "Geselecteerd" : "Tik om te kiezen")
    );
    button.addEventListener("click", () => toggleSpecialSelection(card.id));
    list.append(button);
  });
  ui.specialModalContent.append(list);

  const actions = createElement("div", "special-actions sticky-actions");
  const confirmButton = createButton("Bevestigen", "primary-button", confirmSpecialSelection);
  confirmButton.disabled = session.selectedCardIds.length !== session.requiredCount;
  actions.append(confirmButton);
  if (session.allowCancel) {
    actions.append(createButton("Annuleren", "ghost-button", cancelSpecialAsReplacement));
  }
  ui.specialModalContent.append(actions);
}

function toggleSpecialSelection(cardId) {
  if (!game.specialSession) {
    return;
  }

  const session = game.specialSession;
  const selectedIds = new Set(session.selectedCardIds);
  if (selectedIds.has(cardId)) {
    selectedIds.delete(cardId);
  } else if (selectedIds.size < session.requiredCount) {
    selectedIds.add(cardId);
  }

  session.selectedCardIds = [...selectedIds];
  saveGame();
  renderSpecialSession();
}

function confirmSpecialSelection() {
  if (!game.specialSession || lockAction()) {
    return;
  }

  game.specialSession.phase = "task";
  game.specialSession.currentStep = 0;
  saveGame();
  renderSpecialSession();
}

function renderSpecialTask(session) {
  const card = getCardById(session.selectedCardIds[session.currentStep]);
  if (!card) {
    finishSpecialSession("completed");
    return;
  }

  const copy = getSpecialTaskCopy(session, card);
  renderSpecialHeader(copy.title, copy.instruction);
  ui.specialModalContent.append(renderTaskCard(card, copy.variantText, session));

  const actions = createElement("div", "special-actions sticky-actions");
  actions.append(
    createButton(copy.doneLabel || "✅ Gedaan", "primary-button", () => resolveSpecialTask(true)),
    createButton(copy.skipLabel || "💋 Niet gedaan", "secondary-button danger-button", () => resolveSpecialTask(false))
  );
  ui.specialModalContent.append(actions);
}

function getSpecialTaskCopy(session, card) {
  if (session.type === "roulette") {
    return {
      title: `Roulette: ${session.currentStep + 1} / ${session.selectedCardIds.length}`,
      instruction: `${game.players[session.playerIndex].name} probeert de gekozen opdracht.`,
      variantText: card.text
    };
  }

  if (session.type === "playWithTension") {
    return {
      title: "Spelen met spanning",
      instruction: "Probeer deze eerder geweigerde opdracht opnieuw.",
      skipLabel: "Nog steeds niet",
      variantText: card.text
    };
  }

  if (session.type === "doubleSpicy") {
    return {
      title: "Dubbel zo spannend",
      instruction: "De upgrade-opdracht telt nu.",
      variantText: card.upgradeText
    };
  }

  if (session.type === "lighterVersion") {
    return {
      title: "Lichtere versie",
      instruction: "De lichtere opdracht telt nu.",
      variantText: card.lighterText
    };
  }

  return {
    title: "Flirty-keuze",
    instruction: `${game.players[session.playerIndex].name} voert de gekozen opdracht uit.`,
    variantText: card.text
  };
}

function renderTaskCard(card, activeText, session = game.specialSession) {
  const category = deck.categories[card.category] || deck.categories.special;
  const panel = createElement("div", `special-task-card ${category.className || ""} special-task-${session?.type || "normal"}`);
  panel.dataset.category = card.category;
  panel.style.setProperty("--card-accent", category.color);
  panel.append(
    createElement("span", "card-category", `${category.emoji} ${category.label} · Level ${card.level}`),
    createElement("strong", "special-task-title", card.title),
    createElement("p", "special-original-text", card.text)
  );

  if (activeText && activeText !== card.text) {
    panel.append(createElement("span", "special-transform", "↓"));
    panel.append(createElement("p", "special-active-text", activeText));
  }

  if (card.safetyNote) {
    panel.append(createElement("p", "safety-note", card.safetyNote));
  }

  return panel;
}

function resolveSpecialTask(wasDone) {
  if (!game.specialSession || lockAction()) {
    return;
  }

  const session = game.specialSession;
  const card = getCardById(session.selectedCardIds[session.currentStep]);
  if (!card) {
    finishSpecialSession("completed");
    return;
  }

  markCardUsed(card.id);
  const result = wasDone ? "completed" : "skipped";
  const variant = getSpecialHistoryVariant(session.type);
  session.results.push(result);

  if (wasDone) {
    stats.doneCount += 1;
    game.completedCardIds = uniqueStrings([...game.completedCardIds, card.id]);
    if (session.type === "roulette") {
      stats.rouletteSubtasksCompleted += 1;
    }
    if (session.type === "playWithTension") {
      stats.previouslySkippedCardsCompleted += 1;
    }
    if (session.type === "doubleSpicy") {
      stats.upgradedCardsCompleted += 1;
    }
    addCardHistory({
      cardId: card.id,
      parentSpecialCardId: session.parentCardId,
      playerIndex: session.playerIndex,
      result,
      variant,
      note: getVariantNote(session, card)
    });
    showToast("Opdracht afgerond.");
    playSound("done");
    vibrate([18, 28, 18]);
  } else {
    stats.notDoneCount += 1;
    game.skippedCardIds = uniqueStrings([...game.skippedCardIds, card.id]);
    if (session.type === "roulette") {
      stats.rouletteSubtasksSkipped += 1;
      addLipstickKiss(session.playerIndex, "roulette_skip");
    } else if (session.type === "playWithTension") {
      stats.repeatSkips += 1;
      addLipstickKiss(session.playerIndex, "tension_repeat_skip");
    } else if (session.type === "doubleSpicy") {
      stats.upgradedCardsSkipped += 1;
      addLipstickKiss(session.playerIndex, "upgrade_skip");
    } else if (session.type === "lighterVersion") {
      addLipstickKiss(session.playerIndex, "lighter_version_skip");
    } else {
      addLipstickKiss(session.playerIndex, "normal_skip");
    }
    addCardHistory({
      cardId: card.id,
      parentSpecialCardId: session.parentCardId,
      playerIndex: session.playerIndex,
      result,
      variant,
      note: getVariantNote(session, card)
    });
  }

  session.currentStep += 1;
  if (session.currentStep >= session.selectedCardIds.length) {
    if (session.type === "roulette") {
      stats.rouletteCardsCompleted += 1;
    }
    finishSpecialSession("completed");
    return;
  }

  saveGame();
  saveStats();
  renderSpecialSession();
}

function renderGiftChoice(session) {
  renderSpecialHeader("Cadeautje", `${getOtherPlayerName()} kiest een cadeau voor ${game.players[session.playerIndex].name}.`);
  const choices = createElement("div", "gift-grid");
  [
    { label: "🤗 Knuffel", value: "knuffel" },
    { label: "💋 Kus", value: "kus" },
    { label: "💆 Massage", value: "massage" }
  ].forEach((choice) => {
    choices.append(createButton(choice.label, "secondary-button gift-button", () => chooseGift(choice.value)));
  });
  ui.specialModalContent.append(choices);
}

function chooseGift(value) {
  if (!game.specialSession || lockAction()) {
    return;
  }

  game.specialSession.giftChoice = value;
  game.specialSession.phase = "giftResolve";
  saveGame();
  renderSpecialSession();
}

function renderGiftResolve(session) {
  renderSpecialHeader("Cadeautje", `${getOtherPlayerName()} kiest een ${session.giftChoice}.`);
  const actions = createElement("div", "special-actions sticky-actions");
  actions.append(
    createButton("Cadeau gegeven", "primary-button", () => finishSpecialSession("completed")),
    createButton("Toch niet", "ghost-button", () => finishSpecialSession("completed", { note: "Cadeau niet gegeven" }))
  );
  ui.specialModalContent.append(actions);
}

function renderRoleChoiceInput(session) {
  const roleIndex = session.type === "winnieChoice" ? 0 : 1;
  const roleName = roleIndex === 0 ? "Winnie" : "Tijgertje";
  renderSpecialHeader(`${roleName}’s keuze`, `${roleName} bepaalt wat er de komende vijf minuten gebeurt.`);
  const input = createTextArea("Typ hier de opdracht");
  input.value = session.customText || "";
  input.addEventListener("input", () => {
    session.customText = input.value;
    saveGame();
  });
  ui.specialModalContent.append(input);

  const actions = createElement("div", "special-actions sticky-actions");
  actions.append(
    createButton("Start vijf minuten", "primary-button", () => startCustomSpecialTask(300)),
    createButton("Zonder timer afronden", "ghost-button", () => startCustomSpecialTask(0))
  );
  ui.specialModalContent.append(actions);
}

function renderCustomInput(session) {
  const isWild = session.type === "wild";
  renderSpecialHeader(
    isWild ? "Wild Card" : "Golden Card",
    isWild
      ? "Pak willekeurig een attribuut uit de tas en leg jullie opdracht kort vast."
      : "Verzin samen een eigen opdracht en kies eventueel een timer."
  );
  const input = createTextArea("Typ jullie opdracht");
  input.value = session.customText || "";
  input.addEventListener("input", () => {
    session.customText = input.value;
    saveGame();
  });
  ui.specialModalContent.append(input);

  let timerSelect = null;
  if (!isWild) {
    timerSelect = document.createElement("select");
    timerSelect.className = "special-select";
    [
      ["0", "Geen timer"],
      ["30", "30 seconden"],
      ["60", "60 seconden"],
      ["120", "2 minuten"],
      ["300", "5 minuten"]
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      timerSelect.append(option);
    });
    timerSelect.value = String(session.timer?.durationSeconds || 0);
    ui.specialModalContent.append(timerSelect);
  }

  const actions = createElement("div", "special-actions sticky-actions");
  actions.append(
    createButton("Start opdracht", "primary-button", () => {
      const seconds = timerSelect ? Number(timerSelect.value) : 0;
      startCustomSpecialTask(seconds);
    }),
    createButton("Annuleren", "ghost-button", cancelSpecialAsReplacement)
  );
  ui.specialModalContent.append(actions);
}

function startCustomSpecialTask(seconds) {
  if (!game.specialSession) {
    return;
  }

  const customText = String(game.specialSession.customText || "").trim();
  if (!customText) {
    showToast("Typ eerst kort welke opdracht jullie doen.");
    return;
  }

  if (lockAction()) {
    return;
  }

  game.specialSession.customText = customText;
  game.specialSession.phase = "customTask";
  game.specialSession.timer = seconds
    ? {
        cardId: game.specialSession.parentCardId,
        durationSeconds: seconds,
        remainingSeconds: seconds,
        isRunning: false,
        startedAt: null
      }
    : createDefaultTimer();
  saveGame();
  renderSpecialSession();
}

function renderCustomTask(session) {
  const titleMap = {
    golden: "Golden Card",
    wild: "Wild Card",
    winnieChoice: "Winnie’s keuze",
    tijgertjeChoice: "Tijgertjes keuze"
  };
  renderSpecialHeader(titleMap[session.type] || "Eigen opdracht", "Rond de opdracht af wanneer jullie klaar zijn.");
  const task = createElement("div", "special-task-card");
  task.append(
    createElement("strong", "special-task-title", session.customText || "Eigen opdracht"),
    createElement("p", "special-active-text", session.customText || "Geen tekst ingevuld.")
  );
  ui.specialModalContent.append(task);
  renderSpecialTimer(session);

  const actions = createElement("div", "special-actions sticky-actions");
  actions.append(
    createButton("Gedaan", "primary-button", () => finishCustomSpecial(true)),
    createButton("Niet gedaan", "secondary-button danger-button", () => finishCustomSpecial(false))
  );
  ui.specialModalContent.append(actions);
}

function finishCustomSpecial(wasDone) {
  if (!game.specialSession || lockAction()) {
    return;
  }

  const session = game.specialSession;
  stopSpecialTimerInterval();
  if (wasDone) {
    stats.doneCount += 1;
    showToast("Opdracht afgerond.");
    playSound("done");
    vibrate([18, 28, 18]);
  } else {
    stats.notDoneCount += 1;
    const reasons = {
      golden: "golden_skip",
      wild: "wild_skip",
      winnieChoice: "normal_skip",
      tijgertjeChoice: "normal_skip"
    };
    addLipstickKiss(session.playerIndex, reasons[session.type] || "normal_skip");
  }

  addCardHistory({
    cardId: session.parentCardId,
    parentSpecialCardId: null,
    playerIndex: session.playerIndex,
    result: wasDone ? "completed" : "skipped",
    variant: getCustomSpecialHistoryVariant(session.type),
    note: session.customText || null
  });
  finishSpecialSession("completed", { countDone: false, addParentHistory: false });
}

function renderPerfectRunTask(session) {
  const card = getCardById(session.selectedCardIds[session.currentStep]);
  if (!card) {
    finishSpecialSession("completed");
    return;
  }

  markCardUsed(card.id);
  renderSpecialHeader(`Perfecte Run: ${session.currentStep + 1} / 5`, "Vijf gewone kaarten achter elkaar. Eén skip stopt de reeks direct.");
  ui.specialModalContent.append(renderTaskCard(card, card.text, session));
  const actions = createElement("div", "special-actions sticky-actions");
  actions.append(
    createButton("Gedaan", "primary-button", () => resolvePerfectRunStep(true)),
    createButton("Niet gedaan", "secondary-button danger-button", () => resolvePerfectRunStep(false))
  );
  ui.specialModalContent.append(actions);
}

function resolvePerfectRunStep(wasDone) {
  if (!game.specialSession || lockAction()) {
    return;
  }

  const session = game.specialSession;
  const card = getCardById(session.selectedCardIds[session.currentStep]);
  if (!card) {
    finishSpecialSession("completed");
    return;
  }

  if (!wasDone) {
    stats.notDoneCount += 1;
    stats.perfectRunsFailed += 1;
    game.skippedCardIds = uniqueStrings([...game.skippedCardIds, card.id]);
    addLipstickKiss(session.playerIndex, "perfect_run_failed");
    addCardHistory({
      cardId: card.id,
      parentSpecialCardId: session.parentCardId,
      playerIndex: session.playerIndex,
      result: "skipped",
      variant: "perfectRun"
    });
    session.phase = "perfectRunResult";
    session.resultText = "Perfecte Run mislukt. De kusafdruk blijft staan. 💋";
    saveGame();
    saveStats();
    renderSpecialSession();
    return;
  }

  stats.doneCount += 1;
  game.completedCardIds = uniqueStrings([...game.completedCardIds, card.id]);
  playSound("done");
  vibrate([18, 28, 18]);
  addCardHistory({
    cardId: card.id,
    parentSpecialCardId: session.parentCardId,
    playerIndex: session.playerIndex,
    result: "completed",
    variant: "perfectRun"
  });
  session.successes += 1;
  session.currentStep += 1;

  if (session.successes >= 5 || session.currentStep >= session.selectedCardIds.length) {
    stats.perfectRunsCompleted += 1;
    const player = game.players[session.playerIndex];
    if (player.lipstickKisses > 0) {
      player.lipstickKisses -= 1;
      stats.lipstickKissesRemoved += 1;
      session.resultText = "Perfecte Run voltooid! 🎯 Eén lippenstiftkus is verwijderd.";
    } else {
      session.resultText = "Perfect gespeeld! Je had alleen geen kusafdruk om weg te halen.";
    }
    session.phase = "perfectRunResult";
  } else {
    const nextCard = getCardById(session.selectedCardIds[session.currentStep]);
    if (nextCard) {
      markCardUsed(nextCard.id);
    }
  }

  saveGame();
  saveStats();
  renderSpecialSession();
}

function renderPerfectRunResult(session) {
  renderSpecialHeader("Perfecte Run", session.resultText);
  const actions = createElement("div", "special-actions sticky-actions");
  actions.append(createButton("Verder spelen", "primary-button", () => finishSpecialSession("completed")));
  ui.specialModalContent.append(actions);
}

function renderSpecialFallback(session) {
  renderSpecialHeader("Geen geschikte kaarten", session.fallbackText || "Geen geschikte selectiekaarten gevonden.");
  const actions = createElement("div", "special-actions sticky-actions");
  actions.append(createButton(session.fallbackButton || "Normale kaart trekken", "primary-button", cancelSpecialAsReplacement));
  ui.specialModalContent.append(actions);
}

function cancelSpecialAsReplacement() {
  if (lockAction()) {
    return;
  }

  const parentId = game.specialSession?.parentCardId || game.currentCardId;
  if (parentId) {
    removeUsedCard(parentId);
  }
  game.specialSession = null;
  game.activePerfectRun = null;
  clearCurrentCard({ releaseUsed: true });
  const replacement = pickRandomCard({ excludeSpecial: true });
  if (replacement) {
    drawSelectedCard(replacement);
  } else {
    saveGame();
    renderGame();
    renderEmptyState();
  }
}

function finishSpecialSession(result, options = {}) {
  const session = game.specialSession;
  if (!session) {
    return;
  }

  const parentCard = getCardById(session.parentCardId);
  const countDone = options.countDone !== false;
  const addParentHistory = options.addParentHistory !== false;
  if (countDone) {
    stats.doneCount += 1;
  }
  if (parentCard) {
    game.completedCardIds = uniqueStrings([...game.completedCardIds, parentCard.id]);
  }
  if (addParentHistory) {
    addCardHistory({
      cardId: session.parentCardId,
      parentSpecialCardId: null,
      playerIndex: session.playerIndex,
      result,
      variant: "normal",
      note: options.note || null
    });
  }

  const player = game.players[session.playerIndex];
  player.completedCards += 1;
  stats.completedByPlayer[player.id] = player.completedCards;
  game.specialSession = null;
  game.activePerfectRun = null;
  stopSpecialTimerInterval();
  clearCurrentCard();

  const unlockedLevel = updateLevelAfterCompletedCard();
  saveStats();
  saveGame();
  renderGame();

  if (unlockedLevel) {
    game.pendingTurnAdvance = true;
    game.pendingUnlockLevel = unlockedLevel;
    saveGame();
    renderLevelModal();
    return;
  }

  switchTurn();
  game.temporaryRejectedCardIds = [];
  game.emptyDeckReason = null;
  saveGame();
  renderGame();
}

function addLipstickKiss(playerIndex, reason) {
  const player = game.players[playerIndex] || getCurrentPlayer();
  player.lipstickKisses += 1;
  game.lipstickEvents = [
    ...(game.lipstickEvents || []),
    {
      playerIndex,
      reason,
      timestamp: Date.now()
    }
  ];
  debugLog("lipstick_kiss_added", { playerIndex, reason, total: player.lipstickKisses });
  if (ui.kissAnimation) {
    triggerKissAnimation(player.name);
  }
  if (ui.toast) {
    showToast(`💋 ${player.name} krijgt een lippenstiftkus!`);
  }
}

function addCardHistory(entry) {
  game.cardHistory.push({
    cardId: entry.cardId,
    parentSpecialCardId: entry.parentSpecialCardId || null,
    playerIndex: Number(entry.playerIndex) || 0,
    result: entry.result,
    variant: entry.variant || "normal",
    note: entry.note || null,
    timestamp: entry.timestamp || Date.now()
  });
}

function getSpecialHistoryVariant(type) {
  const variants = {
    roulette: "roulette",
    perfectRun: "perfectRun",
    playWithTension: "redemption",
    doubleSpicy: "upgrade",
    lighterVersion: "lighter"
  };
  return variants[type] || "normal";
}

function getCustomSpecialHistoryVariant(type) {
  if (type === "golden" || type === "wild") {
    return type;
  }

  return "normal";
}

function getVariantNote(session, card) {
  if (session.type === "doubleSpicy") {
    return card.upgradeText;
  }
  if (session.type === "lighterVersion") {
    return card.lighterText;
  }
  return null;
}

function markCardUsed(cardId) {
  game.usedCardIds = uniqueStrings([...game.usedCardIds, cardId]);
}

function getCardById(cardId) {
  return deck.cards.find((card) => card.id === cardId) || null;
}

function getOtherPlayerName() {
  return game.players[game.currentPlayerIndex === 0 ? 1 : 0].name;
}

function shuffleCards(cards) {
  return [...cards].sort(() => Math.random() - 0.5);
}

function uniqueCards(cards) {
  const seenIds = new Set();
  return cards.filter((card) => {
    if (!card || seenIds.has(card.id)) {
      return false;
    }
    seenIds.add(card.id);
    return true;
  });
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (typeof text === "string") {
    element.textContent = text;
  }
  return element;
}

function createButton(label, className, handler) {
  const button = createElement("button", className, label);
  button.type = "button";
  button.addEventListener("click", handler);
  return button;
}

function createTextArea(placeholder) {
  const textarea = document.createElement("textarea");
  textarea.className = "special-textarea";
  textarea.placeholder = placeholder;
  textarea.rows = 4;
  textarea.maxLength = 240;
  return textarea;
}

function renderSpecialTimer(session) {
  if (!session.timer || !session.timer.remainingSeconds) {
    return;
  }

  const timer = createElement("div", "special-timer");
  const readout = createElement("div", "timer-readout", formatSeconds(getSpecialTimerRemainingSeconds()));
  const controls = createElement("div", "timer-controls");
  const startLabel = session.timer.remainingSeconds < session.timer.durationSeconds ? "Hervat" : "Start";
  const startButton = createButton(startLabel, "mini-button", startSpecialTimer);
  const pauseButton = createButton("Pauze", "mini-button", pauseSpecialTimer);
  startButton.disabled = session.timer.isRunning || getSpecialTimerRemainingSeconds() <= 0;
  pauseButton.disabled = !session.timer.isRunning;
  controls.append(
    startButton,
    pauseButton,
    createButton("Reset", "mini-button", resetSpecialTimer)
  );
  timer.append(readout, controls);
  ui.specialModalContent.append(timer);

  if (session.timer.isRunning) {
    startSpecialTimerInterval();
  }
}

function startSpecialTimer() {
  if (!game.specialSession || !game.specialSession.timer?.remainingSeconds) {
    return;
  }

  const timer = game.specialSession.timer;
  timer.remainingSeconds = getSpecialTimerRemainingSeconds();
  timer.isRunning = true;
  timer.startedAt = Date.now();
  saveGame();
  startSpecialTimerInterval();
  renderSpecialSession();
}

function pauseSpecialTimer() {
  if (!game.specialSession?.timer?.isRunning) {
    return;
  }

  const timer = game.specialSession.timer;
  timer.remainingSeconds = getSpecialTimerRemainingSeconds();
  timer.isRunning = false;
  timer.startedAt = null;
  saveGame();
  stopSpecialTimerInterval();
  renderSpecialSession();
}

function resetSpecialTimer() {
  if (!game.specialSession?.timer) {
    return;
  }

  const timer = game.specialSession.timer;
  timer.remainingSeconds = timer.durationSeconds || 0;
  timer.isRunning = false;
  timer.startedAt = null;
  saveGame();
  stopSpecialTimerInterval();
  renderSpecialSession();
}

function startSpecialTimerInterval() {
  stopSpecialTimerInterval();
  specialTimerTickId = window.setInterval(() => {
    if (!game.specialSession?.timer) {
      stopSpecialTimerInterval();
      return;
    }

    const remainingSeconds = getSpecialTimerRemainingSeconds();
    game.specialSession.timer.remainingSeconds = remainingSeconds;
    if (remainingSeconds <= 0) {
      game.specialSession.timer.isRunning = false;
      game.specialSession.timer.startedAt = null;
      stopSpecialTimerInterval();
      saveGame();
      showToast("Timer klaar!");
      playTimerSound();
      vibrate([80, 40, 80]);
    }
    renderSpecialSession();
  }, 1000);
}

function stopSpecialTimerInterval() {
  if (specialTimerTickId) {
    window.clearInterval(specialTimerTickId);
    specialTimerTickId = null;
  }
}

function getSpecialTimerRemainingSeconds() {
  const timer = game.specialSession?.timer;
  if (!timer || !timer.remainingSeconds) {
    return 0;
  }

  if (!timer.isRunning || !timer.startedAt) {
    return Math.max(0, timer.remainingSeconds);
  }

  const elapsedSeconds = Math.floor((Date.now() - timer.startedAt) / 1000);
  return Math.max(0, timer.remainingSeconds - elapsedSeconds);
}

function startTimer() {
  const currentCard = getCurrentCard();
  if (!currentCard || !currentCard.timerSeconds || game.timer.isRunning) {
    return;
  }

  game.timer.remainingSeconds = getTimerRemainingSeconds();
  game.timer.isRunning = true;
  game.timer.startedAt = Date.now();
  saveGame();
  startTimerInterval();
}

function pauseTimer() {
  if (!game.timer || !game.timer.isRunning) {
    return;
  }

  game.timer.remainingSeconds = getTimerRemainingSeconds();
  game.timer.isRunning = false;
  game.timer.startedAt = null;
  saveGame();
  stopTimerInterval();
  renderTimer();
}

function resetTimer() {
  const currentCard = getCurrentCard();
  if (!currentCard || !currentCard.timerSeconds) {
    return;
  }

  game.timer = {
    cardId: currentCard.id,
    remainingSeconds: currentCard.timerSeconds,
    isRunning: false,
    startedAt: null
  };
  saveGame();
  stopTimerInterval();
  renderTimer();
}

function startTimerInterval() {
  stopTimerInterval();
  timerTickId = window.setInterval(() => {
    const remainingSeconds = getTimerRemainingSeconds();
    game.timer.remainingSeconds = remainingSeconds;

    if (remainingSeconds <= 0) {
      completeTimer();
      return;
    }

    renderTimer();
  }, 250);
  renderTimer();
}

function stopTimerInterval() {
  if (timerTickId) {
    window.clearInterval(timerTickId);
    timerTickId = null;
  }
}

function getTimerRemainingSeconds() {
  if (!game.timer || !game.timer.remainingSeconds) {
    return 0;
  }

  if (!game.timer.isRunning || !game.timer.startedAt) {
    return Math.max(0, game.timer.remainingSeconds);
  }

  const elapsedSeconds = Math.floor((Date.now() - game.timer.startedAt) / 1000);
  return Math.max(0, game.timer.remainingSeconds - elapsedSeconds);
}

function completeTimer() {
  game.timer.remainingSeconds = 0;
  game.timer.isRunning = false;
  game.timer.startedAt = null;
  saveGame();
  stopTimerInterval();
  renderTimer();
  ui.timerPanel.classList.add("timer-done");
  window.setTimeout(() => ui.timerPanel.classList.remove("timer-done"), 750);
  showToast("Timer klaar!");
  playTimerSound();
  vibrate([80, 40, 80]);
}

function renderTimer() {
  const currentCard = getCurrentCard();
  if (!currentCard || !currentCard.timerSeconds) {
    ui.timerPanel.hidden = true;
    return;
  }

  ui.timerPanel.hidden = false;
  ui.timerReadout.textContent = formatSeconds(getTimerRemainingSeconds());
  ui.timerStart.disabled = game.timer.isRunning || getTimerRemainingSeconds() <= 0;
  ui.timerPause.disabled = !game.timer.isRunning;
}

function playTimerSound() {
  playSound("timer");
}

function vibrate(pattern) {
  if (settings.vibrationEnabled && "vibrate" in navigator) {
    if (navigator.userActivation && !navigator.userActivation.isActive && !navigator.userActivation.hasBeenActive) {
      return;
    }

    navigator.vibrate(pattern);
  }
}

function renderHome() {
  const players = game.players || createDefaultPlayers();
  ui.homePlayerOne.textContent = players[0].name;
  ui.homePlayerTwo.textContent = players[1].name;
  ui.homeLevel.textContent = game.levelSystemEnabled ? String(game.currentLevel) : "5";
  ui.homeKisses.textContent = `${players[0].lipstickKisses || 0} - ${players[1].lipstickKisses || 0}`;
  ui.continueButton.disabled = !game.activeGame;
}

function renderGame() {
  const players = game.players || createDefaultPlayers();
  const currentPlayer = getCurrentPlayer();
  const currentCard = getCurrentCard();
  const availableCards = getAvailableCards();
  const hasAvailableCards = availableCards.length > 0;
  const emptyDeckActive = !currentCard && (!hasAvailableCards || game.emptyDeckReason);
  const specialActive = Boolean(game.specialSession);
  const cardAnimating = Boolean(currentCard) && cardDrawLocked;

  ui.turnPlayer.textContent = currentPlayer.name;
  ui.scorePlayerOne.textContent = `${players[0].name}: ${players[0].lipstickKisses || 0} 💋`;
  ui.scorePlayerTwo.textContent = `${players[1].name}: ${players[1].lipstickKisses || 0} 💋`;
  ui.gameLevel.textContent = String(getEffectiveLevel());
  ui.jacuzziToggle.checked = game.jacuzziMode;
  document.body.classList.toggle("is-jacuzzi-mode", game.jacuzziMode && activeScreen === "game");
  ui.jacuzziStatus.hidden = !game.jacuzziMode;
  ui.bubbleMeter.hidden = !game.jacuzziMode;
  ui.wakeStatus.hidden = !isWakeLockActive();
  ui.deckCount.textContent = hasAvailableCards
    ? `${availableCards.length} kaarten klaar`
    : "Geen kaarten beschikbaar";

  ui.cardStack.classList.toggle("is-flipped", Boolean(currentCard));
  ui.cardStack.classList.toggle("is-empty", emptyDeckActive);
  ui.cardStack.disabled = Boolean(currentCard) || cardDrawLocked || emptyDeckActive;
  ui.doneButton.disabled = !currentCard || game.cardResolved || specialActive || cardAnimating;
  ui.notDoneButton.disabled = !currentCard || game.cardResolved || specialActive || cardAnimating;
  ui.newCardButton.disabled = !currentCard || game.cardResolved || cardDrawLocked || specialActive;
  ui.jacuzziReplaceButton.hidden = !game.jacuzziMode;
  ui.jacuzziReplaceButton.disabled = !currentCard || game.cardResolved || cardDrawLocked || specialActive;

  renderLevelProgress();
  renderAvailableCategories();

  if (currentCard) {
    const category = deck.categories[currentCard.category] || deck.categories.special;
    applyCardCategoryPresentation(currentCard.category);
    ui.cardStack.style.setProperty("--card-accent", category.color);
    ui.cardStack.setAttribute("aria-label", `${category.label}: ${currentCard.title}`);
    ui.cardCategory.textContent = `${category.emoji} ${category.label} · Level ${currentCard.level}`;
    renderCardProgress(currentCard);
    ui.cardEmoji.textContent = currentCard.emoji || category.emoji;
    ui.cardTitle.textContent = currentCard.title;
    ui.cardText.textContent = currentCard.text;
    if (ui.cardTimerBadge) {
      ui.cardTimerBadge.textContent = currentCard.timerSeconds ? `Timer ${formatDuration(currentCard.timerSeconds)}` : "";
      ui.cardTimerBadge.hidden = !currentCard.timerSeconds;
    }
    if (ui.cardSafetyNote) {
      ui.cardSafetyNote.textContent = currentCard.safetyNote || "";
      ui.cardSafetyNote.hidden = !currentCard.safetyNote;
    }
    ui.emptyState.hidden = true;
  } else {
    applyCardCategoryPresentation(null);
    ui.cardStack.setAttribute("aria-label", "Trek een kaart");
    ui.cardStack.style.setProperty("--card-accent", deck.categories.cute.color);
    if (ui.cardProgress) {
      ui.cardProgress.textContent = "";
      ui.cardProgress.hidden = true;
    }
    if (ui.cardTimerBadge) {
      ui.cardTimerBadge.textContent = "";
      ui.cardTimerBadge.hidden = true;
    }
    if (ui.cardSafetyNote) {
      ui.cardSafetyNote.textContent = "";
      ui.cardSafetyNote.hidden = true;
    }
    renderEmptyStateIfNeeded();
  }

  renderTimer();
  renderLevelModal();
  renderSpecialSession();
}

function renderLevelProgress() {
  const players = game.players;
  if (!game.levelSystemEnabled) {
    ui.levelStatusTitle.textContent = "Level 5 — Levelsysteem uit";
    ui.levelNextText.textContent = "Alle gewone en speciale categorieën beschikbaar";
    renderPlayerProgressLine(0, players[0].completedCards, 1, true);
    renderPlayerProgressLine(1, players[1].completedCards, 1, true);
    return;
  }

  if (game.currentLevel >= MAX_LEVEL) {
    const requirement = levelRequirements[MAX_LEVEL];
    ui.levelStatusTitle.textContent = "Level 5 — Alles vrijgespeeld";
    ui.levelNextText.textContent = "";
    renderPlayerProgressLine(0, players[0].completedCards, requirement, false);
    renderPlayerProgressLine(1, players[1].completedCards, requirement, false);
    return;
  }

  const nextLevel = game.currentLevel + 1;
  const requirement = levelRequirements[nextLevel];
  ui.levelStatusTitle.textContent = `Level ${game.currentLevel}`;
  ui.levelNextText.textContent = `Level ${nextLevel} bij ${requirement} kaarten per speler`;
  renderPlayerProgressLine(0, players[0].completedCards, requirement, false);
  renderPlayerProgressLine(1, players[1].completedCards, requirement, false);
}

function renderPlayerProgressLine(playerIndex, completedCards, requirement, levelSystemDisabled) {
  const player = game.players[playerIndex];
  const label = levelSystemDisabled
    ? `${player.name}: ${completedCards} afgerond`
    : `${player.name}: ${completedCards} / ${requirement}`;
  const width = levelSystemDisabled ? 100 : Math.min(100, Math.round((completedCards / requirement) * 100));

  if (playerIndex === 0) {
    ui.progressPlayerOneLabel.textContent = label;
    ui.progressBarOne.style.width = `${width}%`;
  } else {
    ui.progressPlayerTwoLabel.textContent = label;
    ui.progressBarTwo.style.width = `${width}%`;
  }
}

function renderAvailableCategories() {
  const categoryIds = getUnlockedCategoryIds();
  ui.availableCategories.textContent = "";

  categoryIds.forEach((categoryId) => {
    const category = deck.categories[categoryId];
    if (!category) {
      return;
    }

    const chip = document.createElement("span");
    chip.className = `category-chip ${category.className || ""}`.trim();
    chip.style.setProperty("--chip-color", category.color);
    chip.textContent = `${category.emoji} ${category.label}`;
    ui.availableCategories.appendChild(chip);
  });
}

function applyCardCategoryPresentation(categoryId) {
  const categoryClasses = Object.values(deck.categories).map((category) => category.className).filter(Boolean);
  ui.cardStack.classList.remove(...categoryClasses);

  const category = categoryId ? deck.categories[categoryId] : null;
  if (category?.className) {
    ui.cardStack.classList.add(category.className);
    ui.cardStack.dataset.category = categoryId;
    document.body.dataset.cardCategory = categoryId;
  } else {
    ui.cardStack.dataset.category = "deck";
    delete document.body.dataset.cardCategory;
  }
}

function renderCardProgress(currentCard) {
  if (!ui.cardProgress) {
    return;
  }

  const progressLabel = getCardProgressLabel(currentCard);
  ui.cardProgress.textContent = progressLabel;
  ui.cardProgress.hidden = !progressLabel;
}

function getCardProgressLabel(currentCard) {
  if (!currentCard) {
    return "";
  }

  if (game.specialSession && isSpecialCard(currentCard)) {
    return "Special actief";
  }

  if (game.jacuzziMode && (currentCard.requiresJacuzzi || currentCard.jacuzziAllowed)) {
    return "Jacuzzi-proof";
  }

  return "";
}

function getUnlockedCategoryIds() {
  const categoryIds = new Set();
  deck.cards.forEach((card) => {
    if (isCardEligible(card)) {
      categoryIds.add(card.category);
    }
  });

  return Object.keys(deck.categories).filter((categoryId) => categoryIds.has(categoryId));
}

function renderEmptyStateIfNeeded() {
  const hasCardsLeft = getAvailableCards().length > 0;
  ui.emptyState.hidden = hasCardsLeft && !game.emptyDeckReason;
  if (!ui.emptyState.hidden) {
    renderEmptyState();
  }
}

function renderEmptyState() {
  const jacuzziEmpty = game.jacuzziMode || game.emptyDeckReason === "jacuzzi";
  ui.emptyState.hidden = false;
  ui.normalEmptyActions.hidden = jacuzziEmpty;
  ui.jacuzziEmptyActions.hidden = !jacuzziEmpty;
  ui.emptyMessage.textContent = jacuzziEmpty
    ? "Geen nieuwe jacuzzi-opdrachten meer beschikbaar. 🛁"
    : "Alle beschikbare kaarten zijn gespeeld.";
}

function renderSettings() {
  const players = game.players || createDefaultPlayers();
  ui.settingsPlayerOne.value = players[0].name || DEFAULT_PLAYERS[0];
  ui.settingsPlayerTwo.value = players[1].name || DEFAULT_PLAYERS[1];
  ui.themeSetting.value = normalizeTheme(settings.theme);
  ui.soundSetting.checked = settings.soundEnabled;
  ui.vibrationSetting.checked = settings.vibrationEnabled;
  ui.levelsSetting.checked = settings.levelSystemEnabled;
  ui.levelsSettingState.textContent = settings.levelSystemEnabled ? "Aan" : "Uit";
  ui.fullscreenSetting.checked = Boolean(document.fullscreenElement);
  ui.fullscreenSetting.disabled = !isFullscreenSupported();
  ui.fullscreenSettingState.textContent = !isFullscreenSupported()
    ? "Niet ondersteund"
    : document.fullscreenElement
      ? "Aan"
      : "Uit";
  ui.wakeLockSetting.checked = settings.wakeLockEnabled;
  ui.wakeLockSetting.disabled = !isWakeLockSupported();
  ui.developerSetting.checked = settings.developerMode;
  ui.developerTools.hidden = !settings.developerMode;
  ui.devAddPlayerOne.textContent = `+1 afgeronde kaart voor ${players[0].name}`;
  ui.devAddPlayerTwo.textContent = `+1 afgeronde kaart voor ${players[1].name}`;
  renderDeveloperCardReport();
}

function renderStats() {
  const players = game.players || createDefaultPlayers();
  const cardSummary = deck.createCardSummary ? deck.createCardSummary(deck.cards) : { total: deck.cards.length, byCategory: {} };
  ui.statTotal.textContent = String(stats.totalDrawn);
  ui.statDone.textContent = String(stats.doneCount);
  ui.statNotDone.textContent = String(stats.notDoneCount);
  ui.statKissesOne.textContent = `${players[0].name}: ${players[0].lipstickKisses || 0}`;
  ui.statKissesTwo.textContent = `${players[1].name}: ${players[1].lipstickKisses || 0}`;
  ui.statCompletedOne.textContent = `${players[0].name}: ${players[0].completedCards || 0}`;
  ui.statCompletedTwo.textContent = `${players[1].name}: ${players[1].completedCards || 0}`;
  ui.statTopCategory.textContent = getTopCategoryLabel();
  ui.statLevel.textContent = game.levelSystemEnabled ? String(game.currentLevel || 1) : "5 (levels uit)";
  ui.statJacuzzi.textContent = String(stats.jacuzziUseCount);
  ui.statJacuzziCards.textContent = String(stats.jacuzziCardsDrawn);
  ui.statJacuzziReplaced.textContent = String(stats.jacuzziReplacementCount);
  ui.statJacuzziTime.textContent = formatDuration(getJacuzziTimeSecondsForDisplay());
  ui.statLevelUnlocks.textContent = formatLevelUnlocks();
  ui.statSpecials.textContent = formatSpecialStats();
  ui.statCardsTotal.textContent = String(cardSummary.total);
  ui.statCardsPlayable.textContent = String(getAvailableCards({ includeUsed: true, ignoreTemporaryRejected: true }).length);
  ui.statCardCategories.textContent = formatCategoryCounts(cardSummary.byCategory);
}

function renderDeveloperCardReport() {
  if (!ui.devCardReport || !settings.developerMode) {
    return;
  }

  const validation = getCardValidationResult();
  ui.devCardReport.innerHTML = [
    `<strong>${validation.summary.total}</strong> kaarten`,
    `<strong>${validation.errors.length}</strong> fouten`,
    `<strong>${validation.warnings.length}</strong> waarschuwingen`,
    `${validation.summary.withTimer} met timer`,
    `${validation.summary.withUpgradeText} met upgradeText`,
    `${validation.summary.withLighterText} met lighterText`
  ].join(" · ");
}

function getCardValidationResult() {
  if (!deck.validateCards) {
    return {
      errors: ["Kaartvalidator ontbreekt."],
      warnings: [],
      summary: deck.createCardSummary ? deck.createCardSummary(deck.cards) : { total: deck.cards.length }
    };
  }

  return deck.validateCards(deck.cards);
}

function runCardValidation(showNotification) {
  const validation = getCardValidationResult();
  if (validation.errors.length) {
    console.error("Date Roulette kaartvalidatie: fouten", validation.errors);
  }
  if (settings.developerMode && validation.warnings.length) {
    console.warn("Date Roulette kaartvalidatie: waarschuwingen", validation.warnings);
  }
  if (settings.developerMode) {
    console.info("Date Roulette kaartvalidatie: samenvatting", validation.summary);
  }
  renderDeveloperCardReport();

  if (showNotification) {
    const message = validation.errors.length
      ? `${validation.errors.length} kaartfout(en) gevonden.`
      : `Kaartvalidator klaar: ${validation.warnings.length} waarschuwing(en).`;
    showToast(message);
  }

  return validation;
}

function formatCategoryCounts(counts = {}) {
  const entries = Object.entries(counts).filter(([, count]) => count > 0);
  if (!entries.length) {
    return "-";
  }

  return entries
    .map(([categoryId, count]) => {
      const category = deck.categories[categoryId];
      return `${category ? `${category.emoji} ${category.label}` : categoryId}: ${count}`;
    })
    .join(" · ");
}

function validateDeckCards(cards = deck.cards) {
  const importedErrors = normalizeImportedValidation(validateImportedCards(cards));
  const errors = [...importedErrors];
  const warnings = [];
  const ids = new Set();
  const textMap = new Map();
  const categoryIds = new Set(Object.keys(DATE_ROULETTE_CATEGORIES));
  const specialTypes = new Set([
    "golden",
    "wild",
    "gift",
    "winnieChoice",
    "tijgertjeChoice",
    "roulette",
    "flirtyChoice",
    "perfectRun",
    "playWithTension",
    "doubleSpicy",
    "lighterVersion"
  ]);

  cards.forEach((card, index) => {
    const label = card?.id || `kaart ${index + 1}`;
    if (!card || typeof card !== "object") {
      errors.push(`${label}: kaart is geen object.`);
      return;
    }

    if (ids.has(card.id)) {
      errors.push(`${label}: dubbele id.`);
    }
    ids.add(card.id);

    if (!categoryIds.has(card.category)) {
      errors.push(`${label}: ongeldige categorie "${card.category}".`);
    }
    if (typeof card.jacuzziAllowed !== "boolean" || typeof card.requiresJacuzzi !== "boolean") {
      errors.push(`${label}: Jacuzzi-velden moeten boolean zijn.`);
    }
    if ("repeatable" in card && typeof card.repeatable !== "boolean") {
      errors.push(`${label}: repeatable moet boolean zijn.`);
    }
    if (!isNullableText(card.upgradeText)) {
      errors.push(`${label}: upgradeText moet null of tekst zijn.`);
    }
    if (!isNullableText(card.lighterText)) {
      errors.push(`${label}: lighterText moet null of tekst zijn.`);
    }
    if (!isNullableText(card.safetyNote)) {
      errors.push(`${label}: safetyNote moet null of tekst zijn.`);
    }
    if (card.contentTags !== undefined && !Array.isArray(card.contentTags)) {
      errors.push(`${label}: contentTags moet een array zijn wanneer aanwezig.`);
    }
    if (card.category === "special") {
      if (!specialTypes.has(card.specialType)) {
        errors.push(`${label}: ongeldige specialType.`);
      }
    } else if (card.specialType && card.category !== "jacuzzi") {
      errors.push(`${label}: specialType mag alleen op Special-kaarten staan.`);
    }
    if (card.requiresJacuzzi && card.category !== "jacuzzi") {
      errors.push(`${label}: requiresJacuzzi mag alleen bij category jacuzzi.`);
    }
    if (card.category === "jacuzzi" && (!card.requiresJacuzzi || !card.jacuzziAllowed)) {
      errors.push(`${label}: Jacuzzi-kaarten moeten requiresJacuzzi en jacuzziAllowed op true hebben.`);
    }
    if (card.id === "flirty_020" && card.playerRestriction !== "player_1") {
      errors.push("flirty_020: moet playerRestriction player_1 hebben.");
    }
    if (containsHtmlLikeText(card.text) || containsHtmlLikeText(card.title)) {
      errors.push(`${label}: titel of tekst bevat mogelijke HTML.`);
    }

    const normalizedText = normalizeAuditText(card.text);
    if (normalizedText && textMap.has(normalizedText)) {
      warnings.push(`${label}: opdrachttekst lijkt dubbel met ${textMap.get(normalizedText)}.`);
    } else if (normalizedText) {
      textMap.set(normalizedText, label);
    }

    if (looksTemporaryDateRouletteCard(card)) {
      errors.push(`${label}: tijdelijke testkaart is nog aanwezig.`);
    }
  });

  return {
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    summary: createCardSummary(cards)
  };
}

function normalizeImportedValidation(result) {
  if (Array.isArray(result)) {
    return result;
  }
  if (result && Array.isArray(result.errors)) {
    return result.errors;
  }
  return [];
}

function createCardSummary(cards = []) {
  const summary = {
    total: cards.length,
    byCategory: {},
    byLevel: {},
    specials: 0,
    jacuzziCards: 0,
    restricted: 0,
    withTimer: 0,
    withUpgradeText: 0,
    withLighterText: 0,
    withSafetyNote: 0,
    playableAtLevelOne: 0
  };

  cards.forEach((card) => {
    summary.byCategory[card.category] = (summary.byCategory[card.category] || 0) + 1;
    summary.byLevel[card.level] = (summary.byLevel[card.level] || 0) + 1;
    if (card.category === "special") {
      summary.specials += 1;
    }
    if (card.category === "jacuzzi" || card.requiresJacuzzi) {
      summary.jacuzziCards += 1;
    }
    if (card.playerRestriction) {
      summary.restricted += 1;
    }
    if (card.timerSeconds) {
      summary.withTimer += 1;
    }
    if (card.upgradeText) {
      summary.withUpgradeText += 1;
    }
    if (card.lighterText) {
      summary.withLighterText += 1;
    }
    if (card.safetyNote) {
      summary.withSafetyNote += 1;
    }
    if (card.level === 1) {
      summary.playableAtLevelOne += 1;
    }
  });

  return summary;
}

function renderLevelModal() {
  if (!game.pendingUnlockLevel || game.specialSession) {
    ui.levelModal.hidden = true;
    return;
  }

  const copy = LEVEL_UNLOCK_COPY[game.pendingUnlockLevel];
  ui.levelModalTitle.textContent = copy.title;
  ui.levelModalText.textContent = copy.text;
  if (ui.levelModalCategories) {
    const categoryIds = GAME_RULES.categoryUnlocks?.[game.pendingUnlockLevel] || [];
    ui.levelModalCategories.replaceChildren(
      ...categoryIds.map((categoryId) => {
        const category = deck.categories[categoryId];
        return createElement("span", `category-chip ${category?.className || ""}`.trim(), category ? `${category.emoji} ${category.label}` : categoryId);
      })
    );
  }
  ui.levelModal.hidden = false;
}

function getTopCategoryLabel() {
  const entries = Object.entries(stats.categoryDraws);
  if (!entries.length) {
    return "-";
  }

  const [categoryId] = entries.sort((a, b) => b[1] - a[1])[0];
  const category = deck.categories[categoryId];
  return category ? `${category.emoji} ${category.label}` : categoryId;
}

function showScreen(screenName) {
  activeScreen = screenName;
  document.body.dataset.activeScreen = screenName;
  ui.screens.forEach((screen) => {
    screen.classList.toggle("is-active", screen.dataset.screen === screenName);
  });

  if (screenName !== "game") {
    stopTimerInterval();
    document.body.classList.remove("is-jacuzzi-mode");
  } else if (game.timer && game.timer.isRunning) {
    startTimerInterval();
  }

  render();
  updateWakeLock();
}

function render() {
  renderHome();
  renderBottomNav();

  if (activeScreen === "game") {
    renderGame();
  }

  if (activeScreen === "settings") {
    renderSettings();
  }

  if (activeScreen === "stats") {
    renderStats();
  }

  if (activeScreen === "end") {
    renderEndScreen();
  }
}

function renderBottomNav() {
  if (!ui.bottomNav) {
    return;
  }

  ui.bottomNav.hidden = activeScreen === "setup" || activeScreen === "game";
  const selectedScreen = activeScreen === "game" || game.specialSession ? "game" : activeScreen;
  ui.navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.navScreen === selectedScreen);
    if (button.dataset.navScreen === "game") {
      button.disabled = !game.activeGame && activeScreen !== "game";
    }
  });
}

function renderEndScreen() {
  if (!ui.endSummaryList) {
    return;
  }

  const players = game.players || createDefaultPlayers();
  const kisses = players.map((player) => Number(player.lipstickKisses) || 0);
  const topKissIndex = kisses[0] === kisses[1] ? -1 : kisses[0] > kisses[1] ? 0 : 1;
  ui.endWinnerLine.textContent = topKissIndex >= 0
    ? `${players[topKissIndex].name} verzamelde de meeste kusafdrukken 💋`
    : "Jullie eindigden precies gelijk met kusafdrukken.";

  ui.endSummaryList.replaceChildren(
    createSummaryRow("Gespeelde tijd", formatDuration(getRoundDurationSeconds())),
    createSummaryRow("Kaarten gedaan", String(stats.doneCount)),
    createSummaryRow("Kaarten niet gedaan", String(stats.notDoneCount)),
    createSummaryRow(`Kusjes ${players[0].name}`, String(kisses[0])),
    createSummaryRow(`Kusjes ${players[1].name}`, String(kisses[1])),
    createSummaryRow("Meest gespeelde categorie", getTopCategoryLabel()),
    createSummaryRow("Bereikt level", game.levelSystemEnabled ? `Level ${game.currentLevel}` : "Level 5 (levels uit)"),
    createSummaryRow("Jacuzzi-kaarten", String(stats.jacuzziCardsDrawn))
  );
}

function createSummaryRow(label, value) {
  const row = createElement("div", "stat-row");
  row.append(createElement("span", null, label), createElement("strong", null, value));
  return row;
}

function getRoundDurationSeconds() {
  const startedAt = Number(game.startedAt) || Date.now();
  const endedAt = Number(game.endedAt) || Date.now();
  return Math.max(0, Math.round((endedAt - startedAt) / 1000));
}

function debugLog(eventName, payload = {}) {
  if (!settings?.developerMode) {
    return;
  }

  console.info("[Date Roulette]", eventName, payload);
}

function showToast(message) {
  if (!ui.toast) {
    return;
  }

  if (toastTimeoutId) {
    window.clearTimeout(toastTimeoutId);
  }

  ui.toast.textContent = message;
  ui.toast.classList.add("is-visible");
  toastTimeoutId = window.setTimeout(() => {
    ui.toast.classList.remove("is-visible");
  }, 2200);
}

function triggerKissAnimation(playerName = getCurrentPlayer().name) {
  if (kissAnimationTimeoutId) {
    window.clearTimeout(kissAnimationTimeoutId);
  }

  if (ui.kissAnimationText) {
    ui.kissAnimationText.textContent = `💋 ${playerName} krijgt een lippenstiftkus!`;
  }
  ui.kissAnimation.classList.remove("is-active");
  window.requestAnimationFrame(() => {
    ui.kissAnimation.classList.add("is-active");
  });
  kissAnimationTimeoutId = window.setTimeout(() => {
    ui.kissAnimation.classList.remove("is-active");
  }, KISS_ANIMATION_MS);
  playSound("kiss");
  vibrate(60);
}

function recordCardDraw(card) {
  stats.totalDrawn += 1;
  stats.categoryDraws[card.category] = (stats.categoryDraws[card.category] || 0) + 1;
  if (card.requiresJacuzzi || card.category === "jacuzzi") {
    stats.jacuzziCardsDrawn += 1;
  }
  debugLog("card_drawn", { cardId: card.id, category: card.category, playerIndex: game.currentPlayerIndex });
}

function addDeveloperCompletion(playerIndex) {
  const player = game.players[playerIndex];
  player.completedCards += 1;
  stats.completedByPlayer[player.id] = player.completedCards;
  game.currentLevel = calculateEarnedLevel(game.players);
  if (game.levelSystemEnabled) {
    markLevelsAsSeenThrough(game.currentLevel);
  }
  saveGame();
  saveStats();
  render();
  showToast(`${player.name} heeft nu ${player.completedCards} kaarten afgerond.`);
}

function resetDeveloperProgress() {
  game.players.forEach((player) => {
    player.completedCards = 0;
    stats.completedByPlayer[player.id] = 0;
  });
  game.currentLevel = 1;
  game.unlockedLevels = [1];
  stats.levelUnlockedAt = { 1: new Date().toISOString() };
  saveGame();
  saveStats();
  render();
  showToast("Levelprogressie gereset.");
}

function unlockAllDeveloperLevels() {
  const requirement = levelRequirements[MAX_LEVEL];
  game.players.forEach((player) => {
    player.completedCards = requirement;
    stats.completedByPlayer[player.id] = requirement;
  });
  game.currentLevel = MAX_LEVEL;
  markLevelsAsSeenThrough(MAX_LEVEL);
  saveGame();
  saveStats();
  render();
  showToast("Alle levels vrijgespeeld.");
}

function resetDeveloperJacuzziDeck() {
  reshuffleJacuzziCards();
}

function logDeveloperState() {
  console.info("Date Roulette state", {
    game,
    settings,
    stats
  });
  showToast("Game state staat in de console.");
}

function addDeveloperSkips() {
  const cards = deck.cards
    .filter((card) => !isSpecialCard(card) && card.lighterText && isCardEligible(card, game, getCurrentPlayer()))
    .slice(0, 3);
  cards.forEach((card) => {
    game.skippedCardIds = uniqueStrings([...game.skippedCardIds, card.id]);
    addCardHistory({
      cardId: card.id,
      parentSpecialCardId: null,
      playerIndex: game.currentPlayerIndex,
      result: "skipped",
      variant: "normal"
    });
  });
  saveGame();
  showToast("Drie voorbeeld-skips toegevoegd.");
}

function addDeveloperUpgradeCompletions() {
  const cards = deck.cards
    .filter((card) => !isSpecialCard(card) && card.upgradeText && isCardEligible(card, game, getCurrentPlayer()))
    .slice(0, 3);
  cards.forEach((card) => {
    game.completedCardIds = uniqueStrings([...game.completedCardIds, card.id]);
    addCardHistory({
      cardId: card.id,
      parentSpecialCardId: null,
      playerIndex: game.currentPlayerIndex,
      result: "completed",
      variant: "normal"
    });
  });
  saveGame();
  showToast("Drie upgrade-completions toegevoegd.");
}

function startDeveloperSpecial(type) {
  const card = deck.cards.find((item) => normalizeSpecialType(item.specialType) === type);
  if (!card) {
    showToast("Special-testkaart niet gevonden.");
    return;
  }

  game.specialSession = null;
  game.activePerfectRun = null;
  clearCurrentCard({ releaseUsed: true });
  setCurrentCard(card);
  recordCardDraw(card);
  handleSpecialCard(card, game);
  saveGame();
  saveStats();
  showScreen("game");
}

function clearDeveloperSpecialSession() {
  game.specialSession = null;
  game.activePerfectRun = null;
  stopSpecialTimerInterval();
  saveGame();
  render();
  showToast("Actieve specialSession gewist.");
}

function logDeveloperHistory() {
  console.info("Date Roulette cardHistory", game.cardHistory);
  showToast("cardHistory staat in de console.");
}

function recalculateDeveloperStats() {
  stats = recalculateStatsFromHistory(game, stats);
  game.statistics = stats;
  syncStatsWithPlayers();
  saveStats();
  saveGame();
  render();
  showToast("Statistieken opnieuw berekend uit cardHistory.");
}

function recalculateStatsFromHistory(state, previousStats = {}) {
  const previous = normalizeStats(previousStats);
  const rebuilt = {
    ...createDefaultStats(),
    jacuzziUseCount: previous.jacuzziUseCount,
    levelUnlockedAt: { ...previous.levelUnlockedAt },
    jacuzziReplacementCount: previous.jacuzziReplacementCount,
    jacuzziTimeSeconds: previous.jacuzziTimeSeconds,
    lipstickKissesRemoved: previous.lipstickKissesRemoved
  };
  const history = Array.isArray(state.cardHistory) ? state.cardHistory : [];
  const unresolvedDrawIds = new Set(filterKnownCardIds(state.usedCardIds));

  history.forEach((entry) => {
    const card = getCardById(entry.cardId);
    if (card) {
      rebuilt.categoryDraws[card.category] = (rebuilt.categoryDraws[card.category] || 0) + 1;
      unresolvedDrawIds.delete(card.id);
      if (card.requiresJacuzzi || card.category === "jacuzzi") {
        rebuilt.jacuzziCardsDrawn += 1;
      }
      if (isSpecialCard(card) && entry.result === "completed") {
        countSpecialCompletion(rebuilt, card.specialType);
      }
    }

    if (entry.result === "completed") {
      rebuilt.doneCount += 1;
    }
    if (entry.result === "skipped") {
      rebuilt.notDoneCount += 1;
    }

    countHistoryVariant(rebuilt, entry);
  });

  unresolvedDrawIds.forEach((cardId) => {
    const card = getCardById(cardId);
    if (!card) {
      return;
    }
    rebuilt.categoryDraws[card.category] = (rebuilt.categoryDraws[card.category] || 0) + 1;
    if (card.requiresJacuzzi || card.category === "jacuzzi") {
      rebuilt.jacuzziCardsDrawn += 1;
    }
  });

  rebuilt.totalDrawn = history.length + unresolvedDrawIds.size;
  rebuilt.completedByPlayer = {
    player_1: Number(state.players?.[0]?.completedCards) || 0,
    player_2: Number(state.players?.[1]?.completedCards) || 0
  };
  rebuilt.rouletteCardsStarted = Math.max(previous.rouletteCardsStarted, rebuilt.rouletteCardsCompleted);
  rebuilt.perfectRunsStarted = Math.max(previous.perfectRunsStarted, rebuilt.perfectRunsCompleted + rebuilt.perfectRunsFailed);
  rebuilt.tensionCardsStarted = Math.max(previous.tensionCardsStarted, rebuilt.previouslySkippedCardsCompleted + rebuilt.repeatSkips);
  rebuilt.upgradedCardsStarted = Math.max(previous.upgradedCardsStarted, rebuilt.upgradedCardsCompleted + rebuilt.upgradedCardsSkipped);
  delete rebuilt.perfectRunCompletedSteps;

  uniqueNumbers(state.unlockedLevels || [1]).forEach((level) => {
    if (!rebuilt.levelUnlockedAt[level]) {
      rebuilt.levelUnlockedAt[level] = new Date().toISOString();
    }
  });

  return normalizeStats(rebuilt);
}

function countSpecialCompletion(targetStats, specialType) {
  const type = normalizeSpecialType(specialType);
  if (type === "roulette") {
    targetStats.rouletteCardsCompleted += 1;
  }
}

function countHistoryVariant(targetStats, entry) {
  if (entry.variant === "roulette") {
    if (entry.result === "completed") {
      targetStats.rouletteSubtasksCompleted += 1;
    } else if (entry.result === "skipped") {
      targetStats.rouletteSubtasksSkipped += 1;
    }
  }

  if (entry.variant === "perfectRun") {
    if (entry.result === "skipped") {
      targetStats.perfectRunsFailed += 1;
    } else if (entry.result === "completed") {
      targetStats.perfectRunCompletedSteps = (targetStats.perfectRunCompletedSteps || 0) + 1;
      targetStats.perfectRunsCompleted = Math.floor(targetStats.perfectRunCompletedSteps / 5);
    }
  }

  if (entry.variant === "redemption") {
    if (entry.result === "completed") {
      targetStats.previouslySkippedCardsCompleted += 1;
    } else if (entry.result === "skipped") {
      targetStats.repeatSkips += 1;
    }
  }

  if (entry.variant === "upgrade") {
    if (entry.result === "completed") {
      targetStats.upgradedCardsCompleted += 1;
    } else if (entry.result === "skipped") {
      targetStats.upgradedCardsSkipped += 1;
    }
  }
}

function createNewGame(playerOneName, playerTwoName) {
  return {
    stateVersion: STATE_VERSION,
    activeGame: true,
    startedAt: Date.now(),
    endedAt: null,
    players: [
      createPlayer("player_1", playerOneName, 0, 0),
      createPlayer("player_2", playerTwoName, 0, 0)
    ],
    currentPlayerIndex: 0,
    currentLevel: 1,
    unlockedLevels: [1],
    levelSystemEnabled: settings.levelSystemEnabled,
    jacuzziMode: false,
    jacuzziModeStartedAt: null,
    usedCardIds: [],
    completedCardIds: [],
    skippedCardIds: [],
    temporaryRejectedCardIds: [],
    currentCardId: null,
    cardResolved: false,
    pendingTurnAdvance: false,
    pendingUnlockLevel: null,
    emptyDeckReason: null,
    specialSession: null,
    cardHistory: [],
    activePerfectRun: null,
    lipstickEvents: [],
    completedByPlayer: [0, 0],
    settingsSnapshot: {},
    timer: createDefaultTimer(),
    statistics: {}
  };
}

function createPlayer(id, name, completedCards, lipstickKisses) {
  return {
    id,
    name,
    completedCards,
    lipstickKisses,
    kisses: lipstickKisses
  };
}

function createDefaultPlayers() {
  return [
    createPlayer("player_1", DEFAULT_PLAYERS[0], 0, 0),
    createPlayer("player_2", DEFAULT_PLAYERS[1], 0, 0)
  ];
}

function createDefaultTimer() {
  return {
    cardId: null,
    remainingSeconds: 0,
    isRunning: false,
    startedAt: null
  };
}

function createDefaultSettings() {
  return {
    theme: "dark",
    soundEnabled: true,
    vibrationEnabled: true,
    levelSystemEnabled: true,
    fullscreenEnabled: false,
    wakeLockEnabled: false,
    onboardingCompleted: false,
    installPromptDismissed: false,
    developerMode: false
  };
}

function createDefaultStats() {
  return {
    totalDrawn: 0,
    doneCount: 0,
    notDoneCount: 0,
    categoryDraws: {},
    jacuzziUseCount: 0,
    levelUnlockedAt: {
      1: new Date().toISOString()
    },
    completedByPlayer: {
      player_1: 0,
      player_2: 0
    },
    jacuzziReplacementCount: 0,
    jacuzziCardsDrawn: 0,
    jacuzziTimeSeconds: 0,
    rouletteCardsStarted: 0,
    rouletteCardsCompleted: 0,
    rouletteSubtasksCompleted: 0,
    rouletteSubtasksSkipped: 0,
    perfectRunsStarted: 0,
    perfectRunsCompleted: 0,
    perfectRunsFailed: 0,
    lipstickKissesRemoved: 0,
    tensionCardsStarted: 0,
    previouslySkippedCardsCompleted: 0,
    repeatSkips: 0,
    upgradedCardsStarted: 0,
    upgradedCardsCompleted: 0,
    upgradedCardsSkipped: 0
  };
}

function loadGame() {
  const savedGame = loadJson(STORAGE_KEYS.game, null);
  return migrateGameState(savedGame);
}

function migrateGameState(oldState) {
  const fallbackGame = createNewGame(DEFAULT_PLAYERS[0], DEFAULT_PLAYERS[1]);
  fallbackGame.activeGame = false;

  if (!oldState || typeof oldState !== "object") {
    return fallbackGame;
  }

  const players = normalizePlayers(oldState.players, oldState.completedByPlayer);
  const levelSystemEnabled = readBoolean(oldState.levelSystemEnabled, settings.levelSystemEnabled);
  const earnedLevel = calculateEarnedLevel(players);
  const currentLevel = levelSystemEnabled ? earnedLevel : clampLevel(Number(oldState.currentLevel) || earnedLevel);
  const specialSession = normalizeSpecialSession(oldState.specialSession);
  const currentCardId = getCardById(oldState.currentCardId)
    ? oldState.currentCardId
    : specialSession?.parentCardId || null;
  const timer = currentCardId ? normalizeTimer(oldState.timer) : createDefaultTimer();

  return {
    ...fallbackGame,
    ...oldState,
    stateVersion: STATE_VERSION,
    activeGame: Boolean(oldState.activeGame),
    startedAt: Number(oldState.startedAt) || Date.now(),
    endedAt: oldState.endedAt ? Number(oldState.endedAt) : null,
    players,
    currentPlayerIndex: clampPlayerIndex(oldState.currentPlayerIndex),
    currentLevel,
    unlockedLevels: normalizeUnlockedLevels(oldState.unlockedLevels, currentLevel),
    levelSystemEnabled,
    jacuzziMode: Boolean(oldState.jacuzziMode),
    jacuzziModeStartedAt: oldState.jacuzziModeStartedAt || null,
    usedCardIds: filterKnownCardIds(oldState.usedCardIds),
    completedCardIds: filterKnownCardIds(oldState.completedCardIds),
    skippedCardIds: filterKnownCardIds(oldState.skippedCardIds),
    temporaryRejectedCardIds: filterKnownCardIds(oldState.temporaryRejectedCardIds),
    currentCardId,
    cardResolved: Boolean(oldState.cardResolved),
    pendingTurnAdvance: Boolean(oldState.pendingTurnAdvance),
    pendingUnlockLevel: oldState.pendingUnlockLevel ? clampLevel(oldState.pendingUnlockLevel) : null,
    emptyDeckReason: oldState.emptyDeckReason || null,
    specialSession,
    cardHistory: normalizeCardHistory(oldState.cardHistory, oldState.completedCardIds, oldState.skippedCardIds),
    activePerfectRun: specialSession?.type === "perfectRun" ? normalizeActivePerfectRun(oldState.activePerfectRun, specialSession) : null,
    lipstickEvents: Array.isArray(oldState.lipstickEvents) ? oldState.lipstickEvents : [],
    completedByPlayer: players.map((player) => player.completedCards),
    timer,
    statistics: normalizeStats(oldState.statistics)
  };
}

function loadSettings() {
  return normalizeSettings(loadJson(STORAGE_KEYS.settings, {}));
}

function normalizeSettings(rawSettings = {}) {
  const defaults = createDefaultSettings();
  const source = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
  return {
    ...defaults,
    ...source,
    theme: normalizeTheme(source.theme || defaults.theme),
    soundEnabled: readBoolean(source.soundEnabled, defaults.soundEnabled),
    vibrationEnabled: readBoolean(source.vibrationEnabled, defaults.vibrationEnabled),
    levelSystemEnabled: readBoolean(source.levelSystemEnabled, defaults.levelSystemEnabled),
    fullscreenEnabled: readBoolean(source.fullscreenEnabled, defaults.fullscreenEnabled),
    wakeLockEnabled: readBoolean(source.wakeLockEnabled, defaults.wakeLockEnabled),
    onboardingCompleted: readBoolean(source.onboardingCompleted, defaults.onboardingCompleted),
    installPromptDismissed: readBoolean(source.installPromptDismissed, defaults.installPromptDismissed),
    developerMode: readBoolean(source.developerMode, defaults.developerMode)
  };
}

function loadStats() {
  return normalizeStats(loadJson(STORAGE_KEYS.stats, {}));
}

function normalizeStats(rawStats = {}) {
  const defaults = createDefaultStats();
  const completedByPlayer = Array.isArray(rawStats.completedByPlayer)
    ? {
        player_1: Number(rawStats.completedByPlayer[0]) || 0,
        player_2: Number(rawStats.completedByPlayer[1]) || 0
      }
    : {
        ...defaults.completedByPlayer,
        ...(rawStats.completedByPlayer || {})
      };

  return {
    ...defaults,
    ...rawStats,
    categoryDraws: {
      ...(rawStats.categoryDraws || {})
    },
    levelUnlockedAt: {
      ...defaults.levelUnlockedAt,
      ...(rawStats.levelUnlockedAt || {})
    },
    completedByPlayer: {
      player_1: Number(completedByPlayer.player_1) || 0,
      player_2: Number(completedByPlayer.player_2) || 0
    },
    jacuzziReplacementCount: Number(rawStats.jacuzziReplacementCount) || 0,
    jacuzziCardsDrawn: Number(rawStats.jacuzziCardsDrawn) || 0,
    jacuzziTimeSeconds: Number(rawStats.jacuzziTimeSeconds) || 0,
    rouletteCardsStarted: Number(rawStats.rouletteCardsStarted) || 0,
    rouletteCardsCompleted: Number(rawStats.rouletteCardsCompleted) || 0,
    rouletteSubtasksCompleted: Number(rawStats.rouletteSubtasksCompleted) || 0,
    rouletteSubtasksSkipped: Number(rawStats.rouletteSubtasksSkipped) || 0,
    perfectRunsStarted: Number(rawStats.perfectRunsStarted) || 0,
    perfectRunsCompleted: Number(rawStats.perfectRunsCompleted) || 0,
    perfectRunsFailed: Number(rawStats.perfectRunsFailed) || 0,
    lipstickKissesRemoved: Number(rawStats.lipstickKissesRemoved) || 0,
    tensionCardsStarted: Number(rawStats.tensionCardsStarted) || 0,
    previouslySkippedCardsCompleted: Number(rawStats.previouslySkippedCardsCompleted) || 0,
    repeatSkips: Number(rawStats.repeatSkips) || 0,
    upgradedCardsStarted: Number(rawStats.upgradedCardsStarted) || 0,
    upgradedCardsCompleted: Number(rawStats.upgradedCardsCompleted) || 0,
    upgradedCardsSkipped: Number(rawStats.upgradedCardsSkipped) || 0
  };
}

function mergeStats(firstStats, secondStats) {
  const first = normalizeStats(firstStats || {});
  const second = normalizeStats(secondStats || {});
  const categoryDraws = { ...first.categoryDraws };

  Object.entries(second.categoryDraws).forEach(([categoryId, count]) => {
    categoryDraws[categoryId] = Math.max(Number(categoryDraws[categoryId]) || 0, Number(count) || 0);
  });

  return {
    ...first,
    ...second,
    totalDrawn: Math.max(first.totalDrawn, second.totalDrawn),
    doneCount: Math.max(first.doneCount, second.doneCount),
    notDoneCount: Math.max(first.notDoneCount, second.notDoneCount),
    categoryDraws,
    jacuzziUseCount: Math.max(first.jacuzziUseCount, second.jacuzziUseCount),
    levelUnlockedAt: {
      ...first.levelUnlockedAt,
      ...second.levelUnlockedAt
    },
    completedByPlayer: {
      player_1: Math.max(first.completedByPlayer.player_1, second.completedByPlayer.player_1),
      player_2: Math.max(first.completedByPlayer.player_2, second.completedByPlayer.player_2)
    },
    jacuzziReplacementCount: Math.max(first.jacuzziReplacementCount, second.jacuzziReplacementCount),
    jacuzziCardsDrawn: Math.max(first.jacuzziCardsDrawn, second.jacuzziCardsDrawn),
    jacuzziTimeSeconds: Math.max(first.jacuzziTimeSeconds, second.jacuzziTimeSeconds),
    rouletteCardsStarted: Math.max(first.rouletteCardsStarted, second.rouletteCardsStarted),
    rouletteCardsCompleted: Math.max(first.rouletteCardsCompleted, second.rouletteCardsCompleted),
    rouletteSubtasksCompleted: Math.max(first.rouletteSubtasksCompleted, second.rouletteSubtasksCompleted),
    rouletteSubtasksSkipped: Math.max(first.rouletteSubtasksSkipped, second.rouletteSubtasksSkipped),
    perfectRunsStarted: Math.max(first.perfectRunsStarted, second.perfectRunsStarted),
    perfectRunsCompleted: Math.max(first.perfectRunsCompleted, second.perfectRunsCompleted),
    perfectRunsFailed: Math.max(first.perfectRunsFailed, second.perfectRunsFailed),
    lipstickKissesRemoved: Math.max(first.lipstickKissesRemoved, second.lipstickKissesRemoved),
    tensionCardsStarted: Math.max(first.tensionCardsStarted, second.tensionCardsStarted),
    previouslySkippedCardsCompleted: Math.max(first.previouslySkippedCardsCompleted, second.previouslySkippedCardsCompleted),
    repeatSkips: Math.max(first.repeatSkips, second.repeatSkips),
    upgradedCardsStarted: Math.max(first.upgradedCardsStarted, second.upgradedCardsStarted),
    upgradedCardsCompleted: Math.max(first.upgradedCardsCompleted, second.upgradedCardsCompleted),
    upgradedCardsSkipped: Math.max(first.upgradedCardsSkipped, second.upgradedCardsSkipped)
  };
}

function normalizeSpecialSession(session) {
  if (!session || typeof session !== "object") {
    return null;
  }

  const parentCard = getCardById(session.parentCardId);
  if (!parentCard || !isSpecialCard(parentCard)) {
    return null;
  }

  const phase = session.phase || "start";
  const selectedCardIds = filterKnownCardIds(session.selectedCardIds);
  const candidateCardIds = filterKnownCardIds(session.candidateCardIds);
  if (phase === "select" && !candidateCardIds.length) {
    return null;
  }
  if ((phase === "task" || phase === "perfectRunTask" || phase === "perfectRunResult") && !selectedCardIds.length) {
    return null;
  }

  const maxStep = Math.max(0, selectedCardIds.length - 1);

  return {
    type: normalizeSpecialType(session.type || parentCard.specialType),
    parentCardId: parentCard.id,
    playerIndex: clampPlayerIndex(session.playerIndex),
    selectedCardIds,
    candidateCardIds,
    currentStep: Math.min(maxStep, Math.max(0, Number(session.currentStep) || 0)),
    results: Array.isArray(session.results) ? session.results : [],
    startedAt: Number(session.startedAt) || Date.now(),
    phase,
    customText: session.customText || "",
    timer: normalizeTimer(session.timer),
    requiredCount: Number(session.requiredCount) || 0,
    title: session.title || "",
    instruction: session.instruction || "",
    allowCancel: session.allowCancel !== false,
    fallbackText: session.fallbackText || "",
    fallbackButton: session.fallbackButton || "Normale kaart trekken",
    giftChoice: session.giftChoice || null,
    successes: Number(session.successes) || 0,
    resultText: session.resultText || ""
  };
}

function normalizeCardHistory(history, completedCardIds, skippedCardIds) {
  if (Array.isArray(history)) {
    return history
      .filter((entry) => entry && entry.cardId && (getCardById(entry.cardId) || isManualCustomHistory(entry)))
      .map((entry) => ({
        cardId: entry.cardId,
        parentSpecialCardId: entry.parentSpecialCardId || null,
        playerIndex: clampPlayerIndex(entry.playerIndex),
        result: entry.result === "skipped" || entry.result === "replaced" ? entry.result : "completed",
        variant: entry.variant || "normal",
        note: entry.note || null,
        timestamp: Number(entry.timestamp) || Date.now()
      }));
  }

  const migratedHistory = [];
  filterKnownCardIds(completedCardIds).forEach((cardId) => {
    migratedHistory.push({
      cardId,
      parentSpecialCardId: null,
      playerIndex: 0,
      result: "completed",
      variant: "normal",
      note: null,
      timestamp: Date.now()
    });
  });
  filterKnownCardIds(skippedCardIds).forEach((cardId) => {
    migratedHistory.push({
      cardId,
      parentSpecialCardId: null,
      playerIndex: 0,
      result: "skipped",
      variant: "normal",
      note: null,
      timestamp: Date.now()
    });
  });
  return migratedHistory;
}

function normalizeActivePerfectRun(activePerfectRun, session) {
  const selectedCardIds = filterKnownCardIds(activePerfectRun?.selectedCardIds || session.selectedCardIds);
  if (!selectedCardIds.length) {
    return null;
  }

  return {
    parentCardId: getCardById(activePerfectRun?.parentCardId) ? activePerfectRun.parentCardId : session.parentCardId,
    playerIndex: clampPlayerIndex(activePerfectRun?.playerIndex ?? session.playerIndex),
    selectedCardIds
  };
}

function isManualCustomHistory(entry) {
  return (entry.variant === "golden" || entry.variant === "wild") && isNonEmptyValue(entry.note);
}

function normalizePlayers(players, completedByPlayer) {
  const sourcePlayers = Array.isArray(players) ? players : [];
  return [
    normalizePlayer(sourcePlayers[0], 0, completedByPlayer),
    normalizePlayer(sourcePlayers[1], 1, completedByPlayer)
  ];
}

function normalizePlayer(player, index, completedByPlayer) {
  const fallbackName = DEFAULT_PLAYERS[index];
  const fallbackId = index === 0 ? "player_1" : "player_2";
  const legacyCompleted = Array.isArray(completedByPlayer) ? completedByPlayer[index] : null;
  const completedCards = Number(player?.completedCards ?? legacyCompleted) || 0;
  const lipstickKisses = Number(player?.lipstickKisses ?? player?.kisses) || 0;

  return createPlayer(
    player?.id || fallbackId,
    cleanName(player?.name, fallbackName),
    completedCards,
    lipstickKisses
  );
}

function normalizeTimer(timer) {
  return {
    ...createDefaultTimer(),
    ...(timer || {}),
    remainingSeconds: Number(timer?.remainingSeconds) || 0,
    isRunning: Boolean(timer?.isRunning),
    startedAt: timer?.startedAt || null
  };
}

function normalizeUnlockedLevels(levels, currentLevel) {
  const normalizedLevels = Array.isArray(levels) ? uniqueNumbers([1, ...levels]) : [1];
  for (let level = 1; level <= currentLevel; level += 1) {
    normalizedLevels.push(level);
  }

  return uniqueNumbers(normalizedLevels).filter((level) => level >= 1 && level <= MAX_LEVEL);
}

function saveGame() {
  syncLegacyFields();
  game.statistics = stats;
  game.levelSystemEnabled = settings.levelSystemEnabled;
  localStorage.setItem(STORAGE_KEYS.game, JSON.stringify(game));
  debugLog("state_saved", {
    activeGame: game.activeGame,
    currentCardId: game.currentCardId,
    specialType: game.specialSession?.type || null
  });
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}

function saveStats() {
  game.statistics = stats;
  localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats));
}

function syncLegacyFields() {
  game.players.forEach((player) => {
    player.kisses = player.lipstickKisses;
  });
  game.completedByPlayer = game.players.map((player) => player.completedCards);
  syncStatsWithPlayers();
}

function syncStatsWithPlayers() {
  if (!game || !Array.isArray(game.players)) {
    return;
  }

  game.players.forEach((player) => {
    stats.completedByPlayer[player.id] = Math.max(
      Number(stats.completedByPlayer[player.id]) || 0,
      Number(player.completedCards) || 0
    );
  });
}

function startJacuzziClock() {
  if (!game.jacuzziModeStartedAt) {
    game.jacuzziModeStartedAt = Date.now();
  }
}

function resumeJacuzziClock() {
  if (game.jacuzziMode && !game.jacuzziModeStartedAt) {
    startJacuzziClock();
  }
}

function finalizeJacuzziTime() {
  if (!game.jacuzziMode || !game.jacuzziModeStartedAt) {
    return;
  }

  const elapsedSeconds = Math.max(0, Math.round((Date.now() - game.jacuzziModeStartedAt) / 1000));
  stats.jacuzziTimeSeconds += elapsedSeconds;
  game.jacuzziModeStartedAt = null;
}

function getJacuzziTimeSecondsForDisplay() {
  if (!game.jacuzziMode || !game.jacuzziModeStartedAt) {
    return stats.jacuzziTimeSeconds;
  }

  return stats.jacuzziTimeSeconds + Math.max(0, Math.round((Date.now() - game.jacuzziModeStartedAt) / 1000));
}

function handleVisibilityChange() {
  if (document.visibilityState === "hidden") {
    finalizeJacuzziTime();
    saveGame();
    saveStats();
    updateWakeLock();
    return;
  }

  resumeJacuzziClock();
  saveGame();
  updateWakeLock();
}

function handlePageExit() {
  finalizeJacuzziTime();
  releaseWakeLock();
  saveGame();
  saveStats();
}

function handleBeforeUnload(event) {
  if (!game.specialSession) {
    return;
  }

  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
}

function removeUsedCard(cardId) {
  game.usedCardIds = game.usedCardIds.filter((usedCardId) => usedCardId !== cardId);
}

function lockCardDraw() {
  cardDrawLocked = true;
  window.setTimeout(() => {
    cardDrawLocked = false;
    if (activeScreen === "game") {
      renderGame();
    }
  }, CARD_ANIMATION_LOCK_MS);
}

function lockAction() {
  if (actionLocked) {
    return true;
  }

  actionLocked = true;
  window.setTimeout(() => {
    actionLocked = false;
  }, ACTION_LOCK_MS);
  return false;
}

function clampLevel(value) {
  return Math.min(MAX_LEVEL, Math.max(1, Number(value) || 1));
}

function clampPlayerIndex(value) {
  return Number(value) === 1 ? 1 : 0;
}

function uniqueStrings(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.filter((value) => typeof value === "string" && value))];
}

function filterKnownCardIds(values) {
  return uniqueStrings(values).filter((cardId) => Boolean(getCardById(cardId)));
}

function uniqueNumbers(values) {
  return [...new Set(values.map(Number).filter((value) => Number.isInteger(value)))];
}

function readBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function loadJson(key, fallback) {
  let rawValue = null;
  try {
    rawValue = localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallback;
  } catch (error) {
    backupCorruptStorageValue(key, rawValue, error);
    return fallback;
  }
}

function backupCorruptStorageValue(key, rawValue, error) {
  if (!rawValue) {
    return;
  }

  const backupKey = `${STORAGE_KEYS.corruptBackupPrefix}${Date.now()}`;
  try {
    localStorage.setItem(backupKey, JSON.stringify({
      sourceKey: key,
      rawValue,
      backedUpAt: new Date().toISOString()
    }));
    recoveryNotice = "Beschadigde opslag is veilig apart gezet. Je kunt opnieuw starten of doorgaan met herstel.";
    console.warn("Date Roulette heeft beschadigde LocalStorage apart gezet.", { key, backupKey, error });
  } catch (backupError) {
    recoveryNotice = "Beschadigde opslag gevonden. De app is veilig opnieuw opgebouwd.";
    console.warn("Date Roulette kon beschadigde LocalStorage niet back-uppen.", { key, error, backupError });
  }
}

function cleanName(value, fallback) {
  const trimmedValue = String(value || "").trim();
  return trimmedValue || fallback;
}

function isNonEmptyValue(value) {
  return String(value || "").trim().length > 0;
}

function isNullableText(value) {
  return value === null || value === undefined || isNonEmptyValue(value);
}

function containsHtmlLikeText(value) {
  return /<[a-z/!][^>]*>/i.test(String(value || ""));
}

function normalizeAuditText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function looksTemporaryDateRouletteCard(card) {
  const temporaryIds = new Set(["special_501", "special_502", "special_503", "tension_001"]);
  const markerText = `${card.title || ""} ${card.text || ""}`.toLowerCase();
  return temporaryIds.has(card.id) || markerText.includes("voor nu");
}

function normalizeTheme(value) {
  return THEMES.has(value) ? value : "dark";
}

function applyTheme(themeName) {
  const normalizedTheme = normalizeTheme(themeName);
  if (typeof document === "undefined" || !document.body) {
    return normalizedTheme;
  }

  document.body.classList.toggle("theme-soft", normalizedTheme === "soft");
  document.body.classList.toggle("theme-dark", normalizedTheme === "dark");
  const themeMeta = document.querySelector("meta[name='theme-color']");
  if (themeMeta) {
    themeMeta.setAttribute("content", normalizedTheme === "soft" ? "#fff3f0" : "#17070d");
  }

  return normalizedTheme;
}

function setupInstallPrompt() {
  if (isStandaloneDisplay() || settings.installPromptDismissed) {
    return;
  }

  if (isIOSSafari()) {
    window.setTimeout(maybeShowInstallPrompt, INSTALL_PROMPT_DELAY_MS);
  }
}

function handleBeforeInstallPrompt(event) {
  event.preventDefault();
  deferredInstallPrompt = event;
  maybeShowInstallPrompt();
}

function maybeShowInstallPrompt() {
  if (!ui.installPrompt || settings.installPromptDismissed || isStandaloneDisplay()) {
    return;
  }

  if (!deferredInstallPrompt && !isIOSSafari()) {
    return;
  }

  ui.installButton.hidden = !deferredInstallPrompt;
  ui.installPromptText.textContent = deferredInstallPrompt
    ? "Installeer de app voor fullscreen en offline spelen."
    : "Tik op Delen en kies ‘Zet op beginscherm’ voor de beste iPhone-ervaring.";
  ui.installPrompt.hidden = false;
}

async function installApp() {
  if (!deferredInstallPrompt) {
    dismissInstallPrompt();
    return;
  }

  try {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
  } catch (error) {
    debugLog("install_prompt_failed", { error });
  } finally {
    deferredInstallPrompt = null;
    dismissInstallPrompt();
  }
}

function dismissInstallPrompt() {
  settings.installPromptDismissed = true;
  saveSettings();
  if (ui.installPrompt) {
    ui.installPrompt.hidden = true;
  }
}

function handleAppInstalled() {
  deferredInstallPrompt = null;
  settings.installPromptDismissed = true;
  saveSettings();
  if (ui.installPrompt) {
    ui.installPrompt.hidden = true;
  }
  showToast("Date Roulette staat op je beginscherm.");
}

function isStandaloneDisplay() {
  return Boolean(
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator?.standalone
  );
}

function isIOSSafari() {
  const userAgent = navigator.userAgent || "";
  const isIOS = /iphone|ipad|ipod/i.test(userAgent);
  const isSafari = /safari/i.test(userAgent) && !/crios|fxios|edgios/i.test(userAgent);
  return isIOS && isSafari;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") {
    return;
  }

  navigator.serviceWorker.register("./service-worker.js")
    .then((registration) => {
      serviceWorkerRegistration = registration;
      if (registration.waiting) {
        showUpdatePrompt(registration.waiting);
      }

      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        if (!installingWorker) {
          return;
        }

        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdatePrompt(installingWorker);
          }
        });
      });
    })
    .catch((error) => {
      debugLog("service_worker_failed", { error });
    });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (updateWaitingWorker) {
      window.location.reload();
    }
  });
}

function showUpdatePrompt(worker) {
  updateWaitingWorker = worker;
  if (ui.updatePrompt) {
    ui.updatePrompt.hidden = false;
  }
}

function refreshForUpdate() {
  if (game.activeGame && !window.confirm("Er is een actieve ronde bezig. Nu vernieuwen?")) {
    return;
  }

  const worker = updateWaitingWorker || serviceWorkerRegistration?.waiting;
  if (!worker) {
    if (ui.updatePrompt) {
      ui.updatePrompt.hidden = true;
    }
    return;
  }

  worker.postMessage({ type: "SKIP_WAITING" });
}

function isFullscreenSupported() {
  return Boolean(document.fullscreenEnabled !== false && document.documentElement?.requestFullscreen);
}

async function requestFullscreenMode() {
  if (!isFullscreenSupported()) {
    settings.fullscreenEnabled = false;
    saveSettings();
    showToast("Fullscreen wordt door deze browser niet ondersteund.");
    return false;
  }

  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
    return true;
  } catch (error) {
    settings.fullscreenEnabled = false;
    saveSettings();
    debugLog("fullscreen_failed", { error });
    showToast("Fullscreen kon niet worden gestart.");
    return false;
  }
}

async function exitFullscreenMode() {
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
    }
  } catch (error) {
    debugLog("fullscreen_exit_failed", { error });
  }
}

function isWakeLockSupported() {
  return Boolean(navigator.wakeLock?.request);
}

function isWakeLockActive() {
  return Boolean(wakeLockSentinel && !wakeLockSentinel.released);
}

async function updateWakeLock() {
  if (!isWakeLockSupported()) {
    wakeLockSentinel = null;
    renderWakeStatus();
    return;
  }

  const shouldHoldWakeLock = settings.wakeLockEnabled &&
    activeScreen === "game" &&
    game.activeGame &&
    document.visibilityState !== "hidden";

  if (!shouldHoldWakeLock) {
    await releaseWakeLock();
    renderWakeStatus();
    return;
  }

  if (isWakeLockActive()) {
    renderWakeStatus();
    return;
  }

  try {
    wakeLockSentinel = await navigator.wakeLock.request("screen");
    wakeLockSentinel.addEventListener("release", () => {
      wakeLockSentinel = null;
      renderWakeStatus();
    });
  } catch (error) {
    wakeLockSentinel = null;
    debugLog("wake_lock_failed", { error });
  }

  renderWakeStatus();
}

async function releaseWakeLock() {
  const sentinel = wakeLockSentinel;
  wakeLockSentinel = null;
  if (!sentinel || sentinel.released || typeof sentinel.release !== "function") {
    return;
  }

  try {
    await sentinel.release();
  } catch (error) {
    debugLog("wake_lock_release_failed", { error });
  }
}

function renderWakeStatus() {
  if (ui.wakeStatus) {
    ui.wakeStatus.hidden = !isWakeLockActive();
  }
}

function renderOnboarding() {
  if (!ui.onboardingModal) {
    return;
  }

  const shouldShowOnboarding = !settings.onboardingCompleted && !game.activeGame && stats.totalDrawn === 0;
  ui.onboardingModal.hidden = !shouldShowOnboarding;
  if (!shouldShowOnboarding) {
    return;
  }

  renderOnboardingStep();
}

function renderOnboardingStep() {
  const step = ONBOARDING_STEPS[onboardingStepIndex] || ONBOARDING_STEPS[0];
  ui.onboardingStepLabel.textContent = `Stap ${onboardingStepIndex + 1} van ${ONBOARDING_STEPS.length}`;
  ui.onboardingTitle.textContent = step.title;
  ui.onboardingText.textContent = step.text;
  ui.onboardingNextButton.textContent = onboardingStepIndex === ONBOARDING_STEPS.length - 1 ? "Starten" : "Volgende";
  ui.onboardingDots.replaceChildren(
    ...ONBOARDING_STEPS.map((_, index) => {
      const dot = createElement("span", index === onboardingStepIndex ? "is-active" : "");
      return dot;
    })
  );
}

function advanceOnboarding() {
  if (onboardingStepIndex >= ONBOARDING_STEPS.length - 1) {
    completeOnboarding();
    return;
  }

  onboardingStepIndex += 1;
  renderOnboardingStep();
}

function completeOnboarding() {
  settings.onboardingCompleted = true;
  saveSettings();
  ui.onboardingModal.hidden = true;
}

function unlockAudioContext() {
  if (!settings.soundEnabled) {
    return;
  }

  const context = getAudioContext();
  if (context?.state === "suspended") {
    context.resume().catch(() => {});
  }
}

function getAudioContext() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return null;
    }

    if (!audioContext) {
      audioContext = new AudioContext();
    }
    return audioContext;
  } catch (error) {
    return null;
  }
}

function playSound(type) {
  if (!settings.soundEnabled || typeof window === "undefined") {
    return;
  }

  const context = getAudioContext();
  if (!context) {
    return;
  }

  if (context.state === "suspended") {
    context.resume().catch(() => {});
  }

  const soundMap = {
    draw: [
      { frequency: 240, duration: 0.05, gain: 0.06 },
      { frequency: 360, duration: 0.08, gain: 0.05, offset: 0.04 }
    ],
    done: [
      { frequency: 520, duration: 0.08, gain: 0.07 },
      { frequency: 720, duration: 0.1, gain: 0.05, offset: 0.08 }
    ],
    kiss: [
      { frequency: 410, duration: 0.06, gain: 0.05 },
      { frequency: 260, duration: 0.1, gain: 0.04, offset: 0.06 }
    ],
    level: [
      { frequency: 520, duration: 0.08, gain: 0.06 },
      { frequency: 660, duration: 0.08, gain: 0.06, offset: 0.09 },
      { frequency: 880, duration: 0.12, gain: 0.05, offset: 0.18 }
    ],
    special: [
      { frequency: 330, duration: 0.09, gain: 0.06 },
      { frequency: 620, duration: 0.12, gain: 0.05, offset: 0.1 }
    ],
    timer: [
      { frequency: 740, duration: 0.12, gain: 0.08 },
      { frequency: 560, duration: 0.12, gain: 0.06, offset: 0.15 }
    ]
  };

  const tones = soundMap[type] || soundMap.draw;
  tones.forEach((tone) => scheduleTone(context, tone));
}

function scheduleTone(context, tone) {
  const startTime = context.currentTime + 0.005 + (tone.offset || 0);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = tone.type || "sine";
  oscillator.frequency.setValueAtTime(tone.frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(tone.gain || 0.05, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + tone.duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + tone.duration + 0.02);
}

function formatSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes <= 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

function formatLevelUnlocks() {
  return Object.entries(stats.levelUnlockedAt)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([level, unlockedAt]) => {
      if (!unlockedAt) {
        return `Level ${level}`;
      }

      return `Level ${level}: ${formatDateTime(unlockedAt)}`;
    })
    .join(" · ");
}

function formatSpecialStats() {
  return [
    `Roulette ${stats.rouletteCardsCompleted}/${stats.rouletteCardsStarted}`,
    `Roulette subtaken ${stats.rouletteSubtasksCompleted} gedaan, ${stats.rouletteSubtasksSkipped} niet`,
    `Perfecte Run ${stats.perfectRunsCompleted} klaar, ${stats.perfectRunsFailed} mislukt`,
    `Kusjes verwijderd ${stats.lipstickKissesRemoved}`,
    `Spanning ${stats.previouslySkippedCardsCompleted} alsnog gedaan, ${stats.repeatSkips} opnieuw geweigerd`,
    `Upgrades ${stats.upgradedCardsCompleted} gedaan, ${stats.upgradedCardsSkipped} niet`
  ].join(" · ");
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

window.DateRouletteTestHooks = {
  calculateEarnedLevel,
  isCardEligible,
  isPlayerAllowed,
  getAvailableCards,
  getCardById,
  isSpecialCard,
  handleSpecialCard,
  createNewGame,
  createDefaultStats,
  createDefaultSettings,
  migrateGameState,
  normalizeStats,
  recalculateStatsFromHistory,
  addLipstickKiss,
  switchTurn,
  validateCards: () => getCardValidationResult(),
  setTestState(nextGame, nextStats = {}, nextSettings = {}) {
    settings = normalizeSettings({
      ...createDefaultSettings(),
      ...nextSettings
    });
    stats = normalizeStats(nextStats);
    game = migrateGameState({
      activeGame: true,
      ...nextGame
    });
    game.statistics = stats;
    syncStatsWithPlayers();
    return game;
  },
  setRuntimeGame(nextGame) {
    game = nextGame;
    syncStatsWithPlayers();
    return game;
  },
  setRuntimeStats(nextStats) {
    stats = normalizeStats(nextStats);
    game.statistics = stats;
    return stats;
  },
  getGame() {
    return game;
  },
  getStats() {
    return stats;
  },
  getSettings() {
    return settings;
  }
};
