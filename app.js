import { ALL_CARDS, CARD_COUNTS, validateCards as validateImportedCards } from "./cards/index.js";
import { GAME_RULES } from "./cards/rules.js";

"use strict";

const STORAGE_KEYS = {
  game: "dateRoulette.game",
  settings: "dateRoulette.settings",
  cardRatings: "dateRoulette.cardRatings",
  stats: "dateRoulette.stats",
  corruptBackupPrefix: "dateRoulette_corruptBackup_"
};

const APP_VERSION = "v1.3.37";
const STATE_VERSION = 6;
const MAX_LEVEL = 5;
const NORMAL_MAX_LEVEL_WITHOUT_SPICE = 3;
const ACTIVE_TIMERS_LIMIT = 12;
const RECENT_SIMILAR_CARD_LIMIT = 3;
const DEFAULT_PLAYERS = ["Winnie", "Tijgertje"];
const DEFAULT_PLAYER_GENDERS = ["vrouw", "man"];
const PLAYER_GENDERS = new Set(["vrouw", "man"]);
const CARD_ANIMATION_LOCK_MS = 620;
const ACTION_LOCK_MS = 420;
const INSTALL_PROMPT_DELAY_MS = 1200;
const THEMES = new Set(["dark", "soft"]);
const RATING_TYPES = ["liked", "neutral", "disliked", "impractical", "unclear"];
const SPECIAL_RULES = GAME_RULES.specialRules || {};
const JACUZZI_MODE_RULES = GAME_RULES.jacuzziMode || {};
const CATEGORY_WEIGHT_MULTIPLIERS = GAME_RULES.categoryWeightMultipliers || {};
const ROULETTE_CANDIDATE_COUNT = Math.max(1, Number(SPECIAL_RULES.roulette?.candidateCount) || 10);
const ROULETTE_REQUIRED_COUNT = Math.max(1, Number(SPECIAL_RULES.roulette?.requiredCount) || 3);
const PERFECT_RUN_REQUIRED_COUNT = Math.max(1, Number(SPECIAL_RULES.perfectRun?.requiredCount) || 5);
const SAFE_WORD = GAME_RULES.safeWord || "WALIBI";
const CONSENT_NOTICE = GAME_RULES.consentNotice || `${SAFE_WORD} betekent onmiddellijk stoppen.`;
const LIPSTICK_RULE = GAME_RULES.lipstickRule || "Durf of wil je een opdracht niet doen? Dan krijgt de huidige speler één lippenstiftafdruk.";
const LIPSTICK_PENALTY_MESSAGE = "💋 Lippenstiftstraf!";
const LIPSTICK_PENALTY_TASK = GAME_RULES.lipstickPenaltyTask || "Laat de ander een lippenstiftafdruk achterlaten.";

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
    text: CONSENT_NOTICE
  },
  {
    title: "Niet gedaan?",
    text: LIPSTICK_RULE
  }
];

const DATE_ROULETTE_LEVELS = Object.entries(GAME_RULES.categoryUnlocks || {}).reduce((levels, [level, categories]) => {
  levels[level] = {
    label: `Level ${level}`,
    categories
  };
  return levels;
}, {});

const levelRequirements = GAME_RULES.levelRequirementsPerPlayer || {};

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

const SPICE_LEVEL_COPY = {
  4: {
    label: "Pittig",
    toast: "Pittig aangezet: kaarten t/m level 4."
  },
  5: {
    label: "Oohlala",
    toast: "Oohlala aangezet: kaarten t/m level 5."
  }
};

const CARD_SPREAD_TAGS = new Set([
  "blindfold",
  "clothing",
  "dance",
  "dark",
  "dressup",
  "drink",
  "feet",
  "food",
  "ice",
  "kissing",
  "lipstick",
  "makeup",
  "massage",
  "panty",
  "restraint",
  "roleplay",
  "shopping",
  "tickling",
  "touch",
  "voice"
]);

let recoveryNotice = null;
let settings = loadSettings();
let cardRatings = loadCardRatings();
let stats = loadStats();
let game = loadGame();
stats = mergeStats(game.statistics, stats);
game.statistics = stats;
settings.levelSystemEnabled = game.levelSystemEnabled;
syncStatsWithPlayers();

let activeScreen = "home";
let timerTickId = null;
let specialTimerTickId = null;
let activeTimerTickId = null;
let toastTimeoutId = null;
let cardDrawLocked = false;
let actionLocked = false;
let turnAdvanceTimeoutId = null;
let deferredInstallPrompt = null;
let serviceWorkerRegistration = null;
let wakeLockSentinel = null;
let onboardingStepIndex = 0;
let audioContext = null;
let updateWaitingWorker = null;
let randomSource = Math.random;

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
  resumePendingTurnAdvance();
  resumeActiveTimers();
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
  ui.setupPlayerOneGender = document.querySelectorAll("input[name='setupPlayerOneGender']");
  ui.setupPlayerTwoGender = document.querySelectorAll("input[name='setupPlayerTwoGender']");

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
  ui.spiceLevelControls = document.querySelector("#spice-level-controls");
  ui.spiceLevelButtons = document.querySelectorAll("[data-spice-level]");
  ui.jacuzziStatus = document.querySelector("#jacuzzi-status");
  ui.bubbleMeter = document.querySelector("#bubble-meter");
  ui.wakeStatus = document.querySelector("#wake-status");
  ui.toast = document.querySelector("#toast");
  ui.kissAnimation = document.querySelector("#kiss-animation");
  ui.kissAnimationText = document.querySelector("#kiss-animation-text");
  ui.cardStack = document.querySelector("#card-stack");
  ui.deckPlayer = document.querySelector("#deck-player");
  ui.deckCount = document.querySelector("#deck-count");
  ui.cardCategory = document.querySelector("#card-category");
  ui.cardProgress = document.querySelector("#card-progress");
  ui.cardPlayer = document.querySelector("#card-player");
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
  ui.activeTimersPanel = document.querySelector("#active-timers-panel");
  ui.activeTimersCount = document.querySelector("#active-timers-count");
  ui.activeTimersList = document.querySelector("#active-timers-list");
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
  ui.cardReportButton = document.querySelector("#card-report-button");
  ui.newCardButton = document.querySelector("#new-card-button");
  ui.cardRatingPanel = document.querySelector("#card-rating-panel");
  ui.cardRatingButtons = document.querySelectorAll("[data-card-rating]");

  ui.settingsForm = document.querySelector("#settings-form");
  ui.settingsPlayerOne = document.querySelector("#settings-player-one");
  ui.settingsPlayerTwo = document.querySelector("#settings-player-two");
  ui.settingsPlayerOneGender = document.querySelectorAll("input[name='settingsPlayerOneGender']");
  ui.settingsPlayerTwoGender = document.querySelectorAll("input[name='settingsPlayerTwoGender']");
  ui.themeSetting = document.querySelector("#theme-setting");
  ui.soundSetting = document.querySelector("#sound-setting");
  ui.vibrationSetting = document.querySelector("#vibration-setting");
  ui.levelsSetting = document.querySelector("#levels-setting");
  ui.levelsSettingState = document.querySelector("#levels-setting-state");
  ui.fullscreenSetting = document.querySelector("#fullscreen-setting");
  ui.fullscreenSettingState = document.querySelector("#fullscreen-setting-state");
  ui.wakeLockSetting = document.querySelector("#wake-lock-setting");
  ui.cardRatingsSetting = document.querySelector("#card-ratings-setting");
  ui.exportPlaytestJson = document.querySelector("#export-playtest-json");
  ui.exportPlaytestReport = document.querySelector("#export-playtest-report");
  ui.appVersionLabel = document.querySelector("#app-version-label");
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
  ui.roundNotes = document.querySelector("#round-notes");
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
  ui.cardReportModal = document.querySelector("#card-report-modal");
  ui.cardReportOriginal = document.querySelector("#card-report-original");
  ui.cardReportIssue = document.querySelector("#card-report-issue");
  ui.cardReportTitleInput = document.querySelector("#card-report-title-input");
  ui.cardReportTextInput = document.querySelector("#card-report-text-input");
  ui.cardReportSafetyInput = document.querySelector("#card-report-safety-input");
  ui.cardReportJson = document.querySelector("#card-report-json");
  ui.cardReportCopyButton = document.querySelector("#card-report-copy-button");
  ui.cardReportCloseButton = document.querySelector("#card-report-close-button");
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
  ui.cardRatingsSetting.addEventListener("change", handleCardRatingsSettingToggle);
  ui.exportPlaytestJson.addEventListener("click", exportPlaytestJson);
  ui.exportPlaytestReport.addEventListener("click", exportPlaytestMarkdown);
  ui.endGameButton.addEventListener("click", requestEndGame);
  ui.cardStack.addEventListener("click", drawCard);
  ui.cardStack.addEventListener("pointerdown", handleDeckPointerDown);
  ui.doneButton.addEventListener("click", () => resolveCurrentCard(true));
  ui.notDoneButton.addEventListener("click", () => resolveCurrentCard(false));
  ui.jacuzziReplaceButton.addEventListener("click", replaceJacuzziCard);
  ui.cardReportButton.addEventListener("click", openCardReportModal);
  ui.newCardButton.addEventListener("click", drawReplacementCard);
  ui.reshuffleButton.addEventListener("click", reshuffleCards);
  ui.jacuzziOffEmptyButton.addEventListener("click", turnOffJacuzziFromEmpty);
  ui.reshuffleJacuzziButton.addEventListener("click", reshuffleJacuzziCards);
  ui.homeEmptyButton.addEventListener("click", () => showScreen("home"));
  ui.jacuzziToggle.addEventListener("change", handleJacuzziToggle);
  ui.spiceLevelButtons.forEach((button) => {
    button.addEventListener("click", handleSpiceLevelButtonClick);
  });
  ui.timerStart.addEventListener("click", startTimer);
  ui.timerPause.addEventListener("click", pauseTimer);
  ui.timerReset.addEventListener("click", resetTimer);
  ui.levelContinueButton.addEventListener("click", continueAfterLevelUnlock);
  ui.cardReportCloseButton.addEventListener("click", closeCardReportModal);
  ui.cardReportCopyButton.addEventListener("click", copyCardReportJson);
  ui.kissAnimation.addEventListener("click", dismissKissAnimation);
  ui.kissAnimation.addEventListener("keydown", handleKissAnimationKeydown);
  ui.cardReportModal.addEventListener("click", (event) => {
    if (event.target === ui.cardReportModal) {
      closeCardReportModal();
    }
  });
  [ui.cardReportIssue, ui.cardReportTitleInput, ui.cardReportTextInput, ui.cardReportSafetyInput].forEach((field) => {
    field.addEventListener("input", updateCardReportJson);
  });
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
  ui.cardRatingButtons.forEach((button) => {
    button.addEventListener("click", () => rateCurrentCard(button.dataset.cardRating));
  });
  ui.roundNotes.addEventListener("input", handleRoundNotesInput);
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

function handleCardRatingsSettingToggle() {
  settings.cardRatingsEnabled = ui.cardRatingsSetting.checked;
  saveSettings();
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
  setRadioValue(ui.setupPlayerOneGender, normalizePlayerGender(players[0].gender, DEFAULT_PLAYER_GENDERS[0]));
  setRadioValue(ui.setupPlayerTwoGender, normalizePlayerGender(players[1].gender, DEFAULT_PLAYER_GENDERS[1]));
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
  const playerOneGender = getRadioValue(ui.setupPlayerOneGender, DEFAULT_PLAYER_GENDERS[0]);
  const playerTwoGender = getRadioValue(ui.setupPlayerTwoGender, DEFAULT_PLAYER_GENDERS[1]);

  game = createNewGame(playerOne, playerTwo, playerOneGender, playerTwoGender);
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
  const playerOneGender = getRadioValue(ui.settingsPlayerOneGender, DEFAULT_PLAYER_GENDERS[0]);
  const playerTwoGender = getRadioValue(ui.settingsPlayerTwoGender, DEFAULT_PLAYER_GENDERS[1]);
  const levelSystemWasEnabled = game.levelSystemEnabled;

  game.players[0].name = playerOne;
  game.players[1].name = playerTwo;
  game.players[0].gender = playerOneGender;
  game.players[1].gender = playerTwoGender;
  settings.theme = normalizeTheme(ui.themeSetting.value);
  settings.soundEnabled = ui.soundSetting.checked;
  settings.vibrationEnabled = ui.vibrationSetting.checked;
  settings.levelSystemEnabled = ui.levelsSetting.checked;
  settings.fullscreenEnabled = Boolean(ui.fullscreenSetting.checked && isFullscreenSupported());
  settings.wakeLockEnabled = ui.wakeLockSetting.checked;
  settings.cardRatingsEnabled = ui.cardRatingsSetting.checked;
  settings.developerMode = ui.developerSetting.checked;
  game.levelSystemEnabled = settings.levelSystemEnabled;
  if (!game.levelSystemEnabled) {
    game.levelOverride = null;
  }
  applyTheme(settings.theme);

  if (game.levelSystemEnabled) {
    game.currentLevel = calculateEarnedLevel(game.players);
    markLevelsAsSeenThrough(game.currentLevel);
  } else if (levelSystemWasEnabled) {
    game.currentLevel = calculateEarnedLevel(game.players);
  }

  clearIneligibleCurrentCard();

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
  game.pendingTurnAdvance = false;
  game.turnAdvanceDueAt = null;
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
  const nextGame = createNewGame(
    previousPlayers[0].name,
    previousPlayers[1].name,
    previousPlayers[0].gender,
    previousPlayers[1].gender
  );
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

function handleSpiceLevelButtonClick(event) {
  const targetLevel = normalizeLevelOverride(event.currentTarget.dataset.spiceLevel);
  if (!targetLevel || !game.levelSystemEnabled) {
    return;
  }

  const nextLevelOverride = game.levelOverride === targetLevel ? null : targetLevel;
  game.levelOverride = nextLevelOverride;
  game.emptyDeckReason = null;

  clearIneligibleCurrentCard();

  saveGame();
  renderGame();
  showToast(nextLevelOverride ? SPICE_LEVEL_COPY[nextLevelOverride].toast : "Normale levelopbouw weer actief.");
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

  if (clearIneligibleCurrentCard()) {
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

  clearIneligibleCurrentCard();
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

  const previousCard = getCurrentCard();
  clearCurrentCard();
  const nextCard = pickRandomCard({
    additionalSimilarityCardIds: previousCard ? [previousCard.id] : []
  });
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

  const nextCard = pickRandomCard({
    additionalExcludedIds: [currentCard.id],
    additionalSimilarityCardIds: [currentCard.id]
  });
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
  stopTimerForResolvedCard({ persist: wasDone });
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
  schedulePendingTurnAdvance(delayMs);
}

function schedulePendingTurnAdvance(delayMs) {
  if (turnAdvanceTimeoutId) {
    window.clearTimeout(turnAdvanceTimeoutId);
  }

  game.pendingTurnAdvance = true;
  game.turnAdvanceDueAt = Date.now() + Math.max(0, Number(delayMs) || 0);
  saveGame();
  turnAdvanceTimeoutId = window.setTimeout(completePendingTurnAdvance, Math.max(0, Number(delayMs) || 0));
}

function resumePendingTurnAdvance() {
  if (!game.pendingTurnAdvance || game.pendingUnlockLevel) {
    return;
  }

  const remainingMs = Math.max(0, Number(game.turnAdvanceDueAt || 0) - Date.now());
  if (remainingMs <= 0) {
    completePendingTurnAdvance();
    return;
  }

  if (turnAdvanceTimeoutId) {
    window.clearTimeout(turnAdvanceTimeoutId);
  }
  turnAdvanceTimeoutId = window.setTimeout(completePendingTurnAdvance, remainingMs);
}

function completePendingTurnAdvance() {
  if (!game.pendingTurnAdvance || game.pendingUnlockLevel) {
    return false;
  }

  if (turnAdvanceTimeoutId) {
    window.clearTimeout(turnAdvanceTimeoutId);
    turnAdvanceTimeoutId = null;
  }

  switchTurn();
  clearCurrentCard();
  game.pendingTurnAdvance = false;
  game.turnAdvanceDueAt = null;
  game.temporaryRejectedCardIds = [];
  game.emptyDeckReason = null;
  saveGame();
  if (activeScreen === "game") {
    renderGame();
  }
  return true;
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
    .filter(isJacuzziCompatibleCard)
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

function clearIneligibleCurrentCard() {
  const currentCard = getCurrentCard();
  if (!currentCard || isCardEligible(currentCard)) {
    return false;
  }

  if (game.specialSession) {
    game.specialSession = null;
    game.activePerfectRun = null;
    stopSpecialTimerInterval();
  }

  clearCurrentCard({ releaseUsed: true });
  game.emptyDeckReason = null;
  return true;
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

  return pickWeightedCard(cards);
}

function pickWeightedCard(cards) {
  const weightedCards = cards
    .map((card) => ({
      card,
      weight: getCardWeight(card)
    }))
    .filter((entry) => entry.weight > 0);

  if (!weightedCards.length) {
    return null;
  }

  const totalWeight = weightedCards.reduce((total, entry) => total + entry.weight, 0);
  let cursor = getRandomValue() * totalWeight;
  for (const entry of weightedCards) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry.card;
    }
  }

  return weightedCards[weightedCards.length - 1].card;
}

function getRandomValue() {
  const value = Number(randomSource());
  if (!Number.isFinite(value)) {
    return Math.random();
  }

  return Math.min(0.999999, Math.max(0, value));
}

function getAvailableCards(options = {}) {
  const excludedIds = new Set([...(options.additionalExcludedIds || [])]);
  if (!options.includeUsed) {
    game.usedCardIds.forEach((id) => excludedIds.add(id));
  }
  if (!options.ignoreTemporaryRejected) {
    game.temporaryRejectedCardIds.forEach((id) => excludedIds.add(id));
  }
  if (options.excludeHistory) {
    getHistoricallyPlayedCardIds().forEach((id) => excludedIds.add(id));
  }

  const eligibleCards = deck.cards.filter((card) => {
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

  if (options.ignoreRecentSimilar) {
    return eligibleCards;
  }

  return filterRecentSimilarCards(eligibleCards, options);
}

function getMatchingCards() {
  return deck.cards.filter(isCardEligible);
}

function isCardEligible(card, state = game, player = getCurrentPlayer()) {
  if (!card) {
    return false;
  }

  if (card.enabled === false || getCardWeight(card) <= 0) {
    return false;
  }

  const cardLevel = Number(card.level || 1);
  const spiceLevel = getActiveSpiceLevel(state);
  if (spiceLevel) {
    if (cardLevel > spiceLevel) {
      return false;
    }
  } else if (cardLevel > getNormalPlayableLevel(state)) {
    return false;
  }

  if (!isPlayerAllowed(card, player)) {
    return false;
  }

  if (!hasRequiredCardTemplateTargets(card, state, player)) {
    return false;
  }

  if (state.jacuzziMode) {
    return isJacuzziCompatibleCard(card);
  }

  if (isJacuzziModeCard(card)) {
    return false;
  }

  return true;
}

function isJacuzziCompatibleCard(card) {
  if (!card) {
    return false;
  }

  if (isJacuzziModeCard(card)) {
    return true;
  }

  return Boolean(JACUZZI_MODE_RULES.includeRegularJacuzziAllowed && card.jacuzziAllowed === true && !card.requiresJacuzzi);
}

function isJacuzziModeCard(card) {
  if (!card) {
    return false;
  }

  const tags = Array.isArray(card.contentTags) ? card.contentTags : [];
  const specialType = normalizeSpecialType(card.specialType);
  return Boolean(
    (JACUZZI_MODE_RULES.includeRequiresJacuzzi !== false && card.requiresJacuzzi) ||
    (JACUZZI_MODE_RULES.includeBubbleCards && tags.includes("bubble")) ||
    (JACUZZI_MODE_RULES.includeWellnessOrChaos && specialType === "wellnessOrChaos")
  );
}

function getCardWeight(card) {
  if (!card || card.enabled === false) {
    return 0;
  }

  const categoryMultiplier = getCategoryWeightMultiplier(card.category);
  if (card.weight === undefined || card.weight === null) {
    return categoryMultiplier;
  }

  const baseWeight = Math.min(2, Math.max(0, Number(card.weight) || 0));
  return baseWeight * categoryMultiplier;
}

function getCategoryWeightMultiplier(category) {
  const multiplier = Number(CATEGORY_WEIGHT_MULTIPLIERS[category]);
  if (!Number.isFinite(multiplier)) {
    return 1;
  }

  return Math.min(2, Math.max(0, multiplier));
}

function filterRecentSimilarCards(cards, options = {}) {
  if (!cards.length) {
    return cards;
  }

  const recentTags = getRecentCardSpreadTags(options);
  if (!recentTags.size) {
    return cards;
  }

  const spreadCards = cards.filter((card) => !sharesAnySpreadTag(card, recentTags));
  return spreadCards.length ? spreadCards : cards;
}

function getRecentCardSpreadTags(options = {}) {
  const state = options.state || game;
  const tags = new Set();
  const recentIds = [
    ...(options.additionalSimilarityCardIds || []),
    ...(state?.cardHistory || [])
      .slice(-RECENT_SIMILAR_CARD_LIMIT)
      .reverse()
      .map((entry) => entry.cardId)
  ];

  recentIds.forEach((cardId) => {
    getCardSpreadTags(getCardById(cardId)).forEach((tag) => tags.add(tag));
  });
  return tags;
}

function sharesAnySpreadTag(card, tags) {
  return getCardSpreadTags(card).some((tag) => tags.has(tag));
}

function getCardSpreadTags(card) {
  if (!card || !Array.isArray(card.contentTags)) {
    return [];
  }

  return uniqueStrings(card.contentTags.filter((tag) => CARD_SPREAD_TAGS.has(tag)));
}

function getHistoricallyPlayedCardIds() {
  const ids = new Set([
    ...filterKnownCardIds(game.completedCardIds),
    ...filterKnownCardIds(game.skippedCardIds)
  ]);
  (game.cardHistory || []).forEach((entry) => {
    if (entry?.cardId && getCardById(entry.cardId)) {
      ids.add(entry.cardId);
    }
  });
  return ids;
}

function isPlayerAllowed(card, player) {
  const restriction = card.playerRestriction;
  if (!restriction) {
    return true;
  }

  const normalizedRestriction = String(restriction).trim().toLowerCase();
  const normalizedName = String(player.name || "").trim().toLowerCase();
  const normalizedGender = normalizePlayerGender(player.gender, null);
  if (normalizedRestriction === player.id || normalizedRestriction === normalizedName) {
    return true;
  }

  if (normalizedRestriction === "winnie") {
    return player.id === "player_1";
  }

  if (normalizedRestriction === "tijgertje") {
    return player.id === "player_2";
  }

  const restrictedGender = normalizeRestrictionGender(normalizedRestriction);
  if (restrictedGender) {
    return normalizedGender === restrictedGender;
  }

  return false;
}

function hasRequiredCardTemplateTargets(card, state = game, player = getCurrentPlayer()) {
  const templateText = [
    card?.title,
    card?.text,
    card?.upgradeText,
    card?.lighterText,
    card?.safetyNote
  ].filter(Boolean).join(" ");

  if (/\{\{\s*femalePlayer\s*\}\}/i.test(templateText)) {
    return Boolean(getPlayerNameByGender("vrouw", state, getPlayerIndex(player, state)));
  }

  if (/\{\{\s*malePlayer\s*\}\}/i.test(templateText)) {
    return Boolean(getPlayerNameByGender("man", state, getPlayerIndex(player, state)));
  }

  return true;
}

function getDisplayCardTitle(card, state = game, playerIndex = state.currentPlayerIndex) {
  if (isPlayerChoiceSpecialType(card?.specialType)) {
    return getPlayerChoiceTitle(state, playerIndex);
  }

  return resolveCardTemplateText(card?.title || "", state, playerIndex);
}

function getDisplayCardText(card, state = game, playerIndex = state.currentPlayerIndex) {
  if (isPlayerChoiceSpecialType(card?.specialType)) {
    return getPlayerChoiceInstruction(state, playerIndex);
  }

  return resolveCardTemplateText(card?.text || "", state, playerIndex);
}

function getDisplayCardSafetyNote(card, state = game, playerIndex = state.currentPlayerIndex) {
  return resolveCardTemplateText(card?.safetyNote || "", state, playerIndex);
}

function isPlayerChoiceSpecialType(type) {
  return type === "winnieChoice" || type === "tijgertjeChoice";
}

function getPlayerChoiceTitle(state = game, playerIndex = state.currentPlayerIndex) {
  return `${getPlayerChoiceName(state, playerIndex)}’s keuze`;
}

function getPlayerChoiceInstruction(state = game, playerIndex = state.currentPlayerIndex) {
  return `${getPlayerChoiceName(state, playerIndex)} bepaalt wat er de komende vijf minuten gebeurt.`;
}

function getPlayerChoiceName(state = game, playerIndex = state.currentPlayerIndex) {
  const players = getStatePlayers(state);
  const index = clampPlayerIndex(playerIndex);
  return players[index]?.name || players[0]?.name || "Speler";
}

function resolveCardTemplateText(value, state = game, playerIndex = state.currentPlayerIndex) {
  const text = String(value || "");
  const resolvedText = text
    .replace(/\{\{\s*femalePlayer\s*\}\}/gi, getPlayerNameByGender("vrouw", state, playerIndex) || "de vrouwelijke speler")
    .replace(/\{\{\s*malePlayer\s*\}\}/gi, getPlayerNameByGender("man", state, playerIndex) || "de mannelijke speler");
  return personalizeOtherPlayerReferences(resolvedText, state, playerIndex);
}

function personalizeOtherPlayerReferences(text, state = game, playerIndex = state.currentPlayerIndex) {
  const otherPlayerName = getOtherPlayerName(state, playerIndex);
  if (!otherPlayerName) {
    return text;
  }

  return String(text || "")
    .replace(/\bDe andere speler\b/g, otherPlayerName)
    .replace(/\bde andere speler\b/g, otherPlayerName)
    .replace(/\bDe ander\b/g, otherPlayerName)
    .replace(/\bde ander\b/g, otherPlayerName);
}

function getLipstickPenaltyTask(state = game, playerIndex = state.currentPlayerIndex) {
  return personalizeOtherPlayerReferences(LIPSTICK_PENALTY_TASK, state, playerIndex);
}

function getPlayerNameByGender(gender, state = game, preferredExcludeIndex = null) {
  const players = getStatePlayers(state);
  const normalizedGender = normalizePlayerGender(gender, null);
  if (!normalizedGender) {
    return "";
  }

  const excludedIndex = Number.isInteger(preferredExcludeIndex) ? preferredExcludeIndex : null;
  const target = players.find((player, index) => index !== excludedIndex && normalizePlayerGender(player.gender, null) === normalizedGender) ||
    players.find((player) => normalizePlayerGender(player.gender, null) === normalizedGender);
  return target?.name || "";
}

function getPlayerIndex(player, state = game) {
  const players = getStatePlayers(state);
  const index = players.findIndex((candidate) => candidate.id === player?.id);
  return index >= 0 ? index : Number(state?.currentPlayerIndex ?? game.currentPlayerIndex) || 0;
}

function getStatePlayers(state = game) {
  if (Array.isArray(state?.players) && state.players.length) {
    return state.players;
  }

  if (Array.isArray(game?.players) && game.players.length) {
    return game.players;
  }

  return createDefaultPlayers();
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

function getEffectiveLevel(state = game) {
  if (!state?.levelSystemEnabled) {
    return MAX_LEVEL;
  }

  return getActiveSpiceLevel(state) || clampLevel(state.currentLevel);
}

function getNormalPlayableLevel(state = game) {
  if (!state?.levelSystemEnabled) {
    return MAX_LEVEL;
  }

  return Math.min(clampLevel(state.currentLevel), NORMAL_MAX_LEVEL_WITHOUT_SPICE);
}

function getActiveSpiceLevel(state = game) {
  if (!state?.levelSystemEnabled) {
    return null;
  }

  return normalizeLevelOverride(state.levelOverride);
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
        instruction: `${getOtherPlayerName()} kiest precies ${formatDutchCount(ROULETTE_REQUIRED_COUNT)} opdrachten voor ${getCurrentPlayer().name}.`,
        cards: getShuffledAvailableNormalCards().slice(0, ROULETTE_CANDIDATE_COUNT),
        requiredCount: ROULETTE_REQUIRED_COUNT,
        fallbackText: "Geen geschikte Roulette-kaarten beschikbaar.",
        autoSelectWhenBelowRequired: true
      });
    case "flirtyChoice":
      return startSelectionSpecial(baseSession, {
        title: "Flirty-keuze",
        instruction: `${getOtherPlayerName()} kiest één flirty opdracht voor ${getCurrentPlayer().name}.`,
        cards: getFreshSpecialSelectionCards({ category: "flirty" }).slice(0, 5),
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
  const cards = getShuffledAvailableNormalCards().slice(0, PERFECT_RUN_REQUIRED_COUNT);
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

function getFreshSpecialSelectionCards(options = {}) {
  const freshCards = getShuffledAvailableNormalCards({
    ...options,
    excludeHistory: true
  });

  return freshCards.length ? freshCards : getShuffledAvailableNormalCards(options);
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
      ui.specialModal.classList.remove("is-selection-flow");
      ui.specialModalContent.textContent = "";
    }
    return;
  }

  ui.specialModal.hidden = false;
  ui.specialModalContent.replaceChildren();

  const session = game.specialSession;
  ui.specialModal.dataset.specialType = session.type;
  ui.specialModal.classList.toggle("is-selection-flow", session.phase === "select");
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
      createElement("span", "selection-card-title", `${category.emoji} ${getDisplayCardTitle(card, game, session.playerIndex)}`),
      createElement("span", "selection-card-text", getDisplayCardText(card, game, session.playerIndex)),
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
      variantText: getDisplayCardText(card, game, session.playerIndex)
    };
  }

  if (session.type === "playWithTension") {
    return {
      title: "Spelen met spanning",
      instruction: "Probeer deze eerder geweigerde opdracht opnieuw.",
      skipLabel: "Nog steeds niet",
      variantText: getDisplayCardText(card, game, session.playerIndex)
    };
  }

  if (session.type === "doubleSpicy") {
    return {
      title: "Dubbel zo spannend",
      instruction: "De upgrade-opdracht telt nu.",
      variantText: resolveCardTemplateText(card.upgradeText, game, session.playerIndex)
    };
  }

  if (session.type === "lighterVersion") {
    return {
      title: "Lichtere versie",
      instruction: "De lichtere opdracht telt nu.",
      variantText: resolveCardTemplateText(card.lighterText, game, session.playerIndex)
    };
  }

  return {
    title: "Flirty-keuze",
    instruction: `${game.players[session.playerIndex].name} voert de gekozen opdracht uit.`,
    variantText: getDisplayCardText(card, game, session.playerIndex)
  };
}

function renderTaskCard(card, activeText, session = game.specialSession) {
  const category = deck.categories[card.category] || deck.categories.special;
  const panel = createElement("div", `special-task-card ${category.className || ""} special-task-${session?.type || "normal"}`);
  panel.dataset.category = card.category;
  panel.style.setProperty("--card-accent", category.color);
  panel.append(
    createElement("span", "card-category", `${category.emoji} ${category.label} · Level ${card.level}`),
    createElement("strong", "special-task-title", getDisplayCardTitle(card, game, session?.playerIndex)),
    createElement("p", "special-original-text", getDisplayCardText(card, game, session?.playerIndex))
  );

  if (activeText && activeText !== getDisplayCardText(card, game, session?.playerIndex)) {
    panel.append(createElement("span", "special-transform", "↓"));
    panel.append(createElement("p", "special-active-text", activeText));
  }

  const displaySafetyNote = getDisplayCardSafetyNote(card, game, session?.playerIndex);
  if (displaySafetyNote) {
    panel.append(createElement("p", "safety-note", displaySafetyNote));
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
  renderSpecialHeader(getPlayerChoiceTitle(game, session.playerIndex), getPlayerChoiceInstruction(game, session.playerIndex));
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
    wild: "Wild Card"
  };
  const title = isPlayerChoiceSpecialType(session.type)
    ? getPlayerChoiceTitle(game, session.playerIndex)
    : titleMap[session.type] || "Eigen opdracht";
  renderSpecialHeader(title, "Rond de opdracht af wanneer jullie klaar zijn.");
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
  if (wasDone) {
    promoteSpecialTimerToActiveTimer(session);
  }
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
  renderSpecialHeader(
    `Perfecte Run: ${session.currentStep + 1} / ${PERFECT_RUN_REQUIRED_COUNT}`,
    `${capitalizeFirst(formatDutchCount(PERFECT_RUN_REQUIRED_COUNT))} gewone kaarten achter elkaar. Eén keer niet gedaan stopt de reeks direct.`
  );
  ui.specialModalContent.append(renderTaskCard(card, getDisplayCardText(card, game, session.playerIndex), session));
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

  if (session.successes >= PERFECT_RUN_REQUIRED_COUNT || session.currentStep >= session.selectedCardIds.length) {
    stats.perfectRunsCompleted += 1;
    const player = game.players[session.playerIndex];
    if (player.lipstickKisses > 0) {
      player.lipstickKisses -= 1;
      stats.lipstickKissesRemoved += 1;
      session.resultText = "Perfecte Run voltooid! 🎯 Eén lippenstiftafdruk is verwijderd.";
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
    triggerKissAnimation();
  }
  if (ui.toast) {
    showToast(LIPSTICK_PENALTY_MESSAGE);
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

function getOtherPlayerName(state = game, playerIndex = state?.currentPlayerIndex ?? game.currentPlayerIndex) {
  const players = getStatePlayers(state);
  const index = clampPlayerIndex(playerIndex);
  const otherIndex = index === 0 ? 1 : 0;
  return players[otherIndex]?.name || players.find((_, candidateIndex) => candidateIndex !== index)?.name || "";
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
    if (remainingSeconds <= 0) {
      game.specialSession.timer.remainingSeconds = 0;
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

function stopTimerForResolvedCard(options = {}) {
  if (options.persist) {
    promoteCurrentTimerToActiveTimer(getCurrentCard());
  }
  stopTimerInterval();
  game.timer = createDefaultTimer();
  if (ui.timerPanel) {
    ui.timerPanel.hidden = true;
  }
}

function startTimerInterval() {
  stopTimerInterval();
  timerTickId = window.setInterval(() => {
    const remainingSeconds = getTimerRemainingSeconds();

    if (remainingSeconds <= 0) {
      completeTimer();
      return;
    }

    renderTimer();
  }, 1000);
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
  if (!game.timer) {
    return;
  }

  game.timer.remainingSeconds = 0;
  game.timer.isRunning = false;
  game.timer.startedAt = null;
  saveGame();
  stopTimerInterval();
  renderTimer();
  if (ui.timerPanel) {
    ui.timerPanel.classList.add("timer-done");
    window.setTimeout(() => ui.timerPanel.classList.remove("timer-done"), 750);
  }
  showToast("Timer klaar!");
  playTimerSound();
  vibrate([80, 40, 80]);
}

function renderTimer() {
  if (!ui.timerPanel) {
    return;
  }

  const currentCard = getCurrentCard();
  if (!currentCard || !currentCard.timerSeconds || game.cardResolved) {
    ui.timerPanel.hidden = true;
    return;
  }

  ui.timerPanel.hidden = false;
  ui.timerReadout.textContent = formatSeconds(getTimerRemainingSeconds());
  ui.timerStart.disabled = game.timer.isRunning || getTimerRemainingSeconds() <= 0;
  ui.timerPause.disabled = !game.timer.isRunning;
}

function promoteCurrentTimerToActiveTimer(card) {
  if (!card || !card.timerSeconds || !game.timer?.isRunning || game.timer.cardId !== card.id) {
    return false;
  }

  const remainingSeconds = getTimerRemainingSeconds();
  if (remainingSeconds <= 0) {
    return false;
  }

  const now = Date.now();
  const player = getCurrentPlayer();
  const displayTitle = getDisplayCardTitle(card, game, game.currentPlayerIndex);
  const displayText = getDisplayCardText(card, game, game.currentPlayerIndex);
  const activeTimer = {
    id: createActiveTimerId(card.id),
    cardId: card.id,
    title: displayTitle,
    text: displayText,
    playerIndex: game.currentPlayerIndex,
    playerName: player.name,
    durationSeconds: Number(card.timerSeconds) || remainingSeconds,
    remainingSeconds,
    startedAt: now,
    endsAt: now + (remainingSeconds * 1000),
    isRunning: true,
    completedAt: null,
    source: "card"
  };

  game.activeTimers = normalizeActiveTimers([...(game.activeTimers || []), activeTimer]);
  startActiveTimerInterval();
  renderActiveTimers();
  return true;
}

function promoteSpecialTimerToActiveTimer(session) {
  if (!session?.timer?.isRunning) {
    return false;
  }

  const remainingSeconds = getSpecialTimerRemainingSeconds();
  if (remainingSeconds <= 0) {
    return false;
  }

  const now = Date.now();
  const playerIndex = clampPlayerIndex(session.playerIndex);
  const player = game.players[playerIndex] || createDefaultPlayers()[playerIndex];
  const parentCard = getCardById(session.parentCardId);
  const title = session.customText ? "Eigen timer" : parentCard?.title || "Special timer";
  const text = session.customText || parentCard?.text || "Speciale opdracht";
  const activeTimer = {
    id: createActiveTimerId(session.parentCardId || session.type || "special"),
    cardId: getCardById(session.parentCardId) ? session.parentCardId : null,
    title,
    text,
    playerIndex,
    playerName: player.name,
    durationSeconds: Number(session.timer.durationSeconds || session.timer.remainingSeconds) || remainingSeconds,
    remainingSeconds,
    startedAt: now,
    endsAt: now + (remainingSeconds * 1000),
    isRunning: true,
    completedAt: null,
    source: "special"
  };

  game.activeTimers = normalizeActiveTimers([...(game.activeTimers || []), activeTimer]);
  startActiveTimerInterval();
  renderActiveTimers();
  return true;
}

function resumeActiveTimers() {
  game.activeTimers = normalizeActiveTimers(game.activeTimers);
  updateActiveTimers({ notify: false });
  startActiveTimerInterval();
}

function startActiveTimerInterval() {
  stopActiveTimerInterval();
  if (!hasRunningActiveTimers()) {
    return;
  }

  activeTimerTickId = window.setInterval(() => {
    updateActiveTimers();
    renderActiveTimers();
    if (!hasRunningActiveTimers()) {
      stopActiveTimerInterval();
    }
  }, 1000);
}

function stopActiveTimerInterval() {
  if (activeTimerTickId) {
    window.clearInterval(activeTimerTickId);
    activeTimerTickId = null;
  }
}

function hasRunningActiveTimers() {
  return (game.activeTimers || []).some((timer) => timer.isRunning && getActiveTimerRemainingSeconds(timer) > 0);
}

function updateActiveTimers(options = {}) {
  const notify = options.notify !== false;
  const shouldSave = options.save !== false;
  const now = Date.now();
  let completedCount = 0;

  game.activeTimers = normalizeActiveTimers(game.activeTimers).map((timer) => {
    if (!timer.isRunning || getActiveTimerRemainingSeconds(timer) > 0) {
      return timer;
    }

    completedCount += 1;
    return {
      ...timer,
      remainingSeconds: 0,
      isRunning: false,
      completedAt: now
    };
  });

  if (completedCount > 0) {
    if (shouldSave) {
      saveGame();
    }
    if (notify) {
      showToast(completedCount === 1 ? "Een lopende timer is klaar." : `${completedCount} lopende timers zijn klaar.`);
      playTimerSound();
      vibrate([80, 40, 80]);
    }
  }

  return completedCount;
}

function dismissActiveTimer(timerId) {
  game.activeTimers = (game.activeTimers || []).filter((timer) => timer.id !== timerId);
  saveGame();
  renderActiveTimers();
  startActiveTimerInterval();
}

function renderActiveTimers() {
  if (!ui.activeTimersPanel || !ui.activeTimersList || !ui.activeTimersCount) {
    return;
  }

  updateActiveTimers({ notify: false });
  const timers = normalizeActiveTimers(game.activeTimers);
  game.activeTimers = timers;
  ui.activeTimersPanel.hidden = timers.length === 0;
  ui.activeTimersCount.textContent = String(timers.length);
  ui.activeTimersList.replaceChildren(
    ...timers.map((timer) => {
      const remainingSeconds = getActiveTimerRemainingSeconds(timer);
      const isComplete = Boolean(timer.completedAt || remainingSeconds <= 0);
      const card = createElement("div", `active-timer-card${isComplete ? " is-complete" : ""}`);
      const heading = createElement("div", "active-timer-top");
      const title = createElement("strong", "active-timer-title", timer.title);
      const dismissButton = createButton(isComplete ? "Weg" : "Stop", "timer-dismiss-button", () => dismissActiveTimer(timer.id));
      dismissButton.setAttribute("aria-label", `Verwijder timer ${timer.title}`);
      heading.append(title, dismissButton);

      const meta = createElement("div", "active-timer-meta");
      meta.append(
        createElement("span", "active-timer-time", isComplete ? "Klaar" : formatSeconds(remainingSeconds)),
        createElement("span", "active-timer-end", timer.endsAt ? `Tot ${formatActiveTimerEndTime(timer)}` : "Geen eindtijd"),
        createElement("span", "active-timer-player", timer.playerName)
      );

      card.append(heading, meta);
      if (timer.text) {
        card.append(createElement("p", "active-timer-text", timer.text));
      }
      return card;
    })
  );
}

function normalizeActiveTimers(timers = [], playersForTimers = null) {
  const sourceTimers = Array.isArray(timers) ? timers : [];
  const now = Date.now();
  const seenIds = new Set();
  const normalized = sourceTimers
    .map((timer) => normalizeActiveTimer(timer, now, playersForTimers))
    .filter((timer) => {
      if (!timer || seenIds.has(timer.id)) {
        return false;
      }
      seenIds.add(timer.id);
      return true;
    });

  return normalized.slice(-ACTIVE_TIMERS_LIMIT);
}

function normalizeActiveTimer(timer, now = Date.now(), playersForTimers = null) {
  if (!timer || typeof timer !== "object") {
    return null;
  }

  const card = getCardById(timer.cardId);
  const playerIndex = clampPlayerIndex(timer.playerIndex);
  const fallbackPlayer = playersForTimers?.[playerIndex] || game.players?.[playerIndex] || createDefaultPlayers()[playerIndex];
  const rawDuration = Number(timer.durationSeconds || card?.timerSeconds || timer.remainingSeconds) || 0;
  const durationSeconds = Math.max(0, Math.round(rawDuration));
  const completedAt = Number(timer.completedAt) || null;
  const startedAt = Number(timer.startedAt) || now;
  const fallbackRemaining = Number(timer.remainingSeconds) || durationSeconds;
  const endsAt = Number(timer.endsAt) || (timer.isRunning && fallbackRemaining > 0 ? now + (fallbackRemaining * 1000) : null);
  const isRunning = Boolean(timer.isRunning && endsAt && !completedAt);
  const remainingSeconds = isRunning
    ? Math.max(0, Math.ceil((endsAt - now) / 1000))
    : Math.max(0, Math.round(fallbackRemaining));
  const title = String(timer.title || card?.title || "Timer").slice(0, 90);
  const text = String(timer.text || card?.text || "").slice(0, 600);
  const id = String(timer.id || createActiveTimerId(card?.id || timer.cardId || title));

  if (!title || (!durationSeconds && !remainingSeconds && !endsAt)) {
    return null;
  }

  return {
    id,
    cardId: card?.id || null,
    title,
    text,
    playerIndex,
    playerName: cleanName(timer.playerName, fallbackPlayer.name),
    durationSeconds: durationSeconds || remainingSeconds,
    remainingSeconds,
    startedAt,
    endsAt,
    isRunning,
    completedAt,
    source: timer.source || (card ? "card" : "custom")
  };
}

function getActiveTimerRemainingSeconds(timer) {
  if (!timer) {
    return 0;
  }

  if (timer.completedAt) {
    return 0;
  }

  if (timer.isRunning && timer.endsAt) {
    return Math.max(0, Math.ceil((Number(timer.endsAt) - Date.now()) / 1000));
  }

  return Math.max(0, Math.round(Number(timer.remainingSeconds) || 0));
}

function createActiveTimerId(sourceId) {
  const safeSource = String(sourceId || "timer").replace(/[^a-z0-9_-]+/gi, "_").slice(0, 40) || "timer";
  return `timer_${safeSource}_${Date.now()}_${Math.floor(getRandomValue() * 100000)}`;
}

function formatActiveTimerEndTime(timer) {
  const date = new Date(Number(timer?.endsAt));
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit"
  });
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
  ui.homeLevel.textContent = String(getEffectiveLevel());
  ui.homeKisses.textContent = `${players[0].lipstickKisses || 0} - ${players[1].lipstickKisses || 0}`;
  ui.continueButton.disabled = !game.activeGame;
}

function renderGame() {
  const players = game.players || createDefaultPlayers();
  const currentPlayer = getCurrentPlayer();
  let currentCard = getCurrentCard();
  if (clearIneligibleCurrentCard()) {
    saveGame();
    currentCard = null;
  }
  const availableCards = getAvailableCards();
  const hasAvailableCards = availableCards.length > 0;
  const emptyDeckActive = !currentCard && (!hasAvailableCards || game.emptyDeckReason);
  const specialActive = Boolean(game.specialSession);
  const cardAnimating = Boolean(currentCard) && cardDrawLocked;

  ui.turnPlayer.textContent = currentPlayer.name;
  ui.scorePlayerOne.textContent = `${players[0].name}: ${players[0].lipstickKisses || 0} 💋`;
  ui.scorePlayerTwo.textContent = `${players[1].name}: ${players[1].lipstickKisses || 0} 💋`;
  ui.gameLevel.textContent = String(getEffectiveLevel());
  renderSpiceLevelControls();
  if (ui.deckPlayer) {
    ui.deckPlayer.textContent = `${currentPlayer.name} is aan de beurt`;
  }
  if (ui.cardPlayer) {
    ui.cardPlayer.textContent = `${currentPlayer.name} is aan de beurt`;
  }
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
  ui.cardReportButton.hidden = !currentCard || specialActive;
  ui.cardReportButton.disabled = !currentCard || specialActive;
  renderCardRatingPanel(currentCard, specialActive);

  renderLevelProgress();
  renderAvailableCategories();

  if (currentCard) {
    const category = deck.categories[currentCard.category] || deck.categories.special;
    const displayTitle = getDisplayCardTitle(currentCard, game, game.currentPlayerIndex);
    const displayText = getDisplayCardText(currentCard, game, game.currentPlayerIndex);
    applyCardCategoryPresentation(currentCard.category);
    ui.cardStack.style.setProperty("--card-accent", category.color);
    ui.cardStack.setAttribute("aria-label", `${currentPlayer.name}: ${category.label}: ${displayTitle}`);
    ui.cardCategory.textContent = `${category.emoji} ${category.label} · Level ${currentCard.level}`;
    renderCardProgress(currentCard);
    ui.cardEmoji.textContent = currentCard.emoji || category.emoji;
    ui.cardTitle.textContent = displayTitle;
    fitCardTitle(displayTitle);
    ui.cardText.textContent = displayText;
    if (ui.cardTimerBadge) {
      ui.cardTimerBadge.textContent = currentCard.timerSeconds ? `Timer ${formatDuration(currentCard.timerSeconds)}` : "";
      ui.cardTimerBadge.hidden = !currentCard.timerSeconds;
    }
    if (ui.cardSafetyNote) {
      const displaySafetyNote = getDisplayCardSafetyNote(currentCard, game, game.currentPlayerIndex);
      ui.cardSafetyNote.textContent = displaySafetyNote;
      ui.cardSafetyNote.hidden = !displaySafetyNote;
    }
    ui.emptyState.hidden = true;
  } else {
    applyCardCategoryPresentation(null);
    ui.cardStack.setAttribute("aria-label", `${currentPlayer.name}: trek een kaart`);
    ui.cardStack.style.setProperty("--card-accent", deck.categories.cute.color);
    fitCardTitle("");
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
  renderActiveTimers();
  renderLevelModal();
  renderSpecialSession();
}

function renderLevelProgress() {
  const players = game.players;
  const effectiveLevel = getEffectiveLevel();
  const levelOverride = normalizeLevelOverride(game.levelOverride);
  if (!game.levelSystemEnabled) {
    ui.levelStatusTitle.textContent = "Level 5 — Levelsysteem uit";
    ui.levelNextText.textContent = "Alle gewone en speciale categorieën beschikbaar";
    renderPlayerProgressLine(0, players[0].completedCards, 1, true);
    renderPlayerProgressLine(1, players[1].completedCards, 1, true);
    return;
  }

  if (levelOverride) {
    const nextLevel = Math.min(game.currentLevel + 1, MAX_LEVEL);
    const requirement = levelRequirements[nextLevel] || 1;
    ui.levelStatusTitle.textContent = `${SPICE_LEVEL_COPY[levelOverride].label} — t/m level ${effectiveLevel}`;
    ui.levelNextText.textContent = `Normale progressie blijft level ${game.currentLevel}`;
    renderPlayerProgressLine(0, players[0].completedCards, requirement, false);
    renderPlayerProgressLine(1, players[1].completedCards, requirement, false);
    return;
  }

  if (game.currentLevel >= MAX_LEVEL) {
    const requirement = levelRequirements[MAX_LEVEL];
    ui.levelStatusTitle.textContent = "Level 5 — rustige mix";
    ui.levelNextText.textContent = "Level 4/5-kaarten alleen via Pittig of Oohlala";
    renderPlayerProgressLine(0, players[0].completedCards, requirement, false);
    renderPlayerProgressLine(1, players[1].completedCards, requirement, false);
    return;
  }

  const nextLevel = game.currentLevel + 1;
  const requirement = levelRequirements[nextLevel];
  ui.levelStatusTitle.textContent = game.currentLevel >= 4
    ? `Level ${game.currentLevel} — rustige mix`
    : `Level ${game.currentLevel}`;
  ui.levelNextText.textContent = game.currentLevel >= 4
    ? `Level ${nextLevel} bij ${requirement} kaarten per speler · level 4/5 via knoppen`
    : `Level ${nextLevel} bij ${requirement} kaarten per speler`;
  renderPlayerProgressLine(0, players[0].completedCards, requirement, false);
  renderPlayerProgressLine(1, players[1].completedCards, requirement, false);
}

function renderSpiceLevelControls() {
  if (!ui.spiceLevelControls || !ui.spiceLevelButtons) {
    return;
  }

  const levelSystemEnabled = Boolean(game.levelSystemEnabled);
  const activeLevelOverride = normalizeLevelOverride(game.levelOverride);
  ui.spiceLevelControls.hidden = !levelSystemEnabled;
  ui.spiceLevelButtons.forEach((button) => {
    const buttonLevel = normalizeLevelOverride(button.dataset.spiceLevel);
    const isActive = Boolean(buttonLevel && buttonLevel === activeLevelOverride);
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    button.disabled = !levelSystemEnabled;
  });
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

function fitCardTitle(title) {
  if (!ui.cardTitle) {
    return;
  }

  const text = String(title || "").trim();
  if (!text) {
    ui.cardTitle.style.removeProperty("--card-title-size");
    return;
  }

  const longestWordLength = text
    .split(/\s+/)
    .reduce((longest, word) => Math.max(longest, word.length), 0);
  let size = "2.35rem";
  if (longestWordLength >= 18 || text.length >= 32) {
    size = "1.45rem";
  } else if (longestWordLength >= 14 || text.length >= 24) {
    size = "1.8rem";
  } else if (longestWordLength >= 11 || text.length >= 18) {
    size = "2.05rem";
  }

  ui.cardTitle.style.setProperty("--card-title-size", size);
}

function getCardProgressLabel(currentCard) {
  if (!currentCard) {
    return "";
  }

  if (game.specialSession && isSpecialCard(currentCard)) {
    return "Special actief";
  }

  if (game.jacuzziMode && isJacuzziCompatibleCard(currentCard)) {
    return "Jacuzzi-proof";
  }

  return "";
}

function renderCardRatingPanel(currentCard, specialActive) {
  if (!ui.cardRatingPanel) {
    return;
  }

  const canRate = Boolean(settings.cardRatingsEnabled && currentCard && !specialActive);
  ui.cardRatingPanel.hidden = !canRate;
  if (!canRate) {
    ui.cardRatingPanel.open = false;
  }
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
  setRadioValue(ui.settingsPlayerOneGender, normalizePlayerGender(players[0].gender, DEFAULT_PLAYER_GENDERS[0]));
  setRadioValue(ui.settingsPlayerTwoGender, normalizePlayerGender(players[1].gender, DEFAULT_PLAYER_GENDERS[1]));
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
  ui.cardRatingsSetting.checked = settings.cardRatingsEnabled;
  ui.appVersionLabel.textContent = `Date Roulette ${APP_VERSION}`;
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
    if ("enabled" in card && typeof card.enabled !== "boolean") {
      errors.push(`${label}: enabled moet boolean zijn wanneer aanwezig.`);
    }
    if ("weight" in card) {
      const weight = Number(card.weight);
      if (!Number.isFinite(weight) || weight < 0 || weight > 2) {
        errors.push(`${label}: weight moet tussen 0 en 2 liggen.`);
      }
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
    if (card.id === "flirty_020" && card.playerRestriction !== "man") {
      errors.push("flirty_020: moet playerRestriction man hebben.");
    }
    if (card.id === "flirty_020" && /tijgertje/i.test(`${card.title} ${card.text}`)) {
      errors.push("flirty_020: mag geen vaste spelernaam Tijgertje bevatten.");
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
    if (isJacuzziModeCard(card)) {
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

  if (screenName === "game") {
    startActiveTimerInterval();
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

  ui.roundNotes.value = game.roundNotes || "";
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

function handleRoundNotesInput() {
  game.roundNotes = String(ui.roundNotes.value || "").slice(0, 2000);
  saveGame();
}

function rateCurrentCard(ratingType) {
  const currentCard = getCurrentCard();
  if (!currentCard || !RATING_TYPES.includes(ratingType)) {
    return;
  }

  const cardRating = normalizeCardRating(cardRatings[currentCard.id]);
  cardRating.ratings[ratingType] += 1;
  cardRatings[currentCard.id] = cardRating;
  saveCardRatings();
  showToast("Kaartbeoordeling opgeslagen.");
}

function openCardReportModal() {
  const currentCard = getCurrentCard();
  if (!currentCard || !ui.cardReportModal) {
    return;
  }

  const category = deck.categories[currentCard.category] || deck.categories.special;
  ui.cardReportModal.dataset.cardId = currentCard.id;
  ui.cardReportOriginal.textContent = `${currentCard.id} · ${category.label} · Level ${currentCard.level}`;
  ui.cardReportIssue.value = "";
  ui.cardReportTitleInput.value = currentCard.title || "";
  ui.cardReportTextInput.value = currentCard.text || "";
  ui.cardReportSafetyInput.value = currentCard.safetyNote || "";
  updateCardReportJson();
  ui.cardReportModal.hidden = false;
  window.setTimeout(() => ui.cardReportIssue.focus(), 80);
}

function closeCardReportModal() {
  if (!ui.cardReportModal) {
    return;
  }

  ui.cardReportModal.hidden = true;
  delete ui.cardReportModal.dataset.cardId;
}

function updateCardReportJson() {
  if (!ui.cardReportJson) {
    return "";
  }

  const card = getCardById(ui.cardReportModal?.dataset.cardId) || getCurrentCard();
  if (!card) {
    ui.cardReportJson.value = "";
    return "";
  }

  const payload = createCardReportPayload(card, getCardReportFormValues());
  const json = JSON.stringify(payload, null, 2);
  ui.cardReportJson.value = json;
  return json;
}

function getCardReportFormValues() {
  return {
    problem: ui.cardReportIssue?.value || "",
    title: ui.cardReportTitleInput?.value || "",
    text: ui.cardReportTextInput?.value || "",
    safetyNote: ui.cardReportSafetyInput?.value || ""
  };
}

function createCardReportPayload(card, values = {}) {
  const original = createCardReportSnapshot(card);
  const suggested = {
    title: String(values.title ?? card.title ?? "").trim(),
    text: String(values.text ?? card.text ?? "").trim(),
    safetyNote: normalizeReportNullableText(values.safetyNote ?? card.safetyNote)
  };
  const changedFields = Object.entries(suggested)
    .filter(([field, value]) => normalizeReportNullableText(original[field]) !== normalizeReportNullableText(value))
    .map(([field]) => field);

  return {
    type: "date_roulette_card_report",
    appVersion: APP_VERSION,
    reportedAt: new Date().toISOString(),
    targetFile: getCardSourceFile(card),
    instruction: "Fix deze Date Roulette-kaart in de kaartdatabase. Behoud id, category, level en metadata tenzij hieronder expliciet anders staat.",
    problem: String(values.problem || "").trim(),
    original,
    suggested,
    changedFields
  };
}

function createCardReportSnapshot(card) {
  return {
    id: card.id,
    category: card.category,
    title: card.title,
    text: card.text,
    emoji: card.emoji,
    level: card.level,
    timerSeconds: card.timerSeconds,
    playerRestriction: card.playerRestriction,
    jacuzziAllowed: card.jacuzziAllowed,
    requiresJacuzzi: card.requiresJacuzzi,
    specialType: card.specialType,
    upgradeText: card.upgradeText,
    lighterText: card.lighterText,
    contentTags: Array.isArray(card.contentTags) ? [...card.contentTags] : [],
    repeatable: card.repeatable,
    safetyNote: card.safetyNote || null
  };
}

function getCardSourceFile(card) {
  const category = String(card?.category || "").replace(/[^a-z0-9_-]/gi, "");
  return category ? `cards/${category}.js` : "cards/index.js";
}

function normalizeReportNullableText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

async function copyCardReportJson() {
  const json = updateCardReportJson();
  if (!json) {
    return;
  }

  const copied = await copyTextToClipboard(json);
  if (copied) {
    showToast("Report-JSON gekopieerd.");
    return;
  }

  ui.cardReportJson.focus();
  ui.cardReportJson.select();
  showToast("Kopieer de geselecteerde JSON.");
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      debugLog("clipboard_write_failed", { error });
    }
  }

  if (!document.body) {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (error) {
    debugLog("clipboard_fallback_failed", { error });
  }
  textarea.remove();
  return copied;
}

function createPlaytestExportData() {
  const players = game.players || createDefaultPlayers();
  return {
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    stateVersion: STATE_VERSION,
    playTimeSeconds: getRoundDurationSeconds(),
    players: players.map((player, index) => ({
      id: player.id,
      role: `speler ${index + 1}`,
      displayName: player.name || `Speler ${index + 1}`,
      gender: normalizePlayerGender(player.gender, DEFAULT_PLAYER_GENDERS[index]),
      completedCards: Number(player.completedCards) || 0,
      lipstickKisses: Number(player.lipstickKisses) || 0
    })),
    cardHistory: game.cardHistory || [],
    completedCardIds: game.completedCardIds || [],
    skippedCardIds: game.skippedCardIds || [],
    lipstickEvents: game.lipstickEvents || [],
    ratings: cardRatings,
    levelProgression: {
      currentLevel: game.currentLevel,
      levelSystemEnabled: game.levelSystemEnabled,
      unlockedLevels: game.unlockedLevels,
      requirements: levelRequirements
    },
    jacuzzi: {
      enabled: game.jacuzziMode,
      useCount: stats.jacuzziUseCount,
      cardsDrawn: stats.jacuzziCardsDrawn,
      replacementCount: stats.jacuzziReplacementCount,
      timeSeconds: getJacuzziTimeSecondsForDisplay(),
      rules: JACUZZI_MODE_RULES
    },
    specials: {
      rouletteCardsStarted: stats.rouletteCardsStarted,
      rouletteCardsCompleted: stats.rouletteCardsCompleted,
      rouletteSubtasksCompleted: stats.rouletteSubtasksCompleted,
      rouletteSubtasksSkipped: stats.rouletteSubtasksSkipped,
      perfectRunsStarted: stats.perfectRunsStarted,
      perfectRunsCompleted: stats.perfectRunsCompleted,
      perfectRunsFailed: stats.perfectRunsFailed,
      tensionCardsStarted: stats.tensionCardsStarted,
      upgradedCardsStarted: stats.upgradedCardsStarted
    },
    roundNotes: game.roundNotes || "",
    settings: {
      theme: settings.theme,
      soundEnabled: settings.soundEnabled,
      vibrationEnabled: settings.vibrationEnabled,
      levelSystemEnabled: settings.levelSystemEnabled,
      cardRatingsEnabled: settings.cardRatingsEnabled,
      wakeLockEnabled: settings.wakeLockEnabled,
      fullscreenEnabled: settings.fullscreenEnabled
    },
    recentErrors: recoveryNotice ? [recoveryNotice] : []
  };
}

function exportPlaytestJson() {
  const data = createPlaytestExportData();
  downloadTextFile(
    `date-roulette-playtest-${formatExportDate()}.json`,
    JSON.stringify(data, null, 2),
    "application/json"
  );
}

function exportPlaytestMarkdown() {
  downloadTextFile(
    `date-roulette-playtest-${formatExportDate()}.md`,
    createPlaytestMarkdownReport(),
    "text/markdown"
  );
}

function createPlaytestMarkdownReport() {
  const topLiked = getRatedCards("liked");
  const leastLiked = getRatedCards("disliked");
  const impractical = getRatedCards("impractical");
  const unclear = getRatedCards("unclear");
  return [
    `# Date Roulette Speeltest ${APP_VERSION}`,
    "",
    `Export: ${new Date().toLocaleString("nl-NL")}`,
    `Speeltijd: ${formatDuration(getRoundDurationSeconds())}`,
    `Meest gespeelde categorie: ${getTopCategoryLabel()}`,
    "",
    "## Leukste kaarten",
    formatRatedList(topLiked),
    "",
    "## Minst leuke kaarten",
    formatRatedList(leastLiked),
    "",
    "## Vaakst niet gedaan",
    formatSkippedCards(),
    "",
    "## Praktisch niet uitvoerbaar",
    formatRatedList(impractical),
    "",
    "## Onduidelijk",
    formatRatedList(unclear),
    "",
    "## Kaarten per level",
    formatCardsPerLevel(),
    "",
    "## Notities",
    game.roundNotes || "Geen notities ingevuld."
  ].join("\n");
}

function getRatedCards(ratingType) {
  return Object.entries(cardRatings)
    .map(([cardId, rating]) => ({
      card: getCardById(cardId),
      count: Number(rating?.ratings?.[ratingType]) || 0
    }))
    .filter((entry) => entry.card && entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function formatRatedList(entries) {
  if (!entries.length) {
    return "- Geen gegevens.";
  }

  return entries
    .map((entry) => `- ${entry.card.id} — ${entry.card.title}: ${entry.count}`)
    .join("\n");
}

function formatSkippedCards() {
  const counts = {};
  (game.cardHistory || []).forEach((entry) => {
    if (entry.result === "skipped") {
      counts[entry.cardId] = (counts[entry.cardId] || 0) + 1;
    }
  });
  const entries = Object.entries(counts)
    .map(([cardId, count]) => ({ card: getCardById(cardId), count }))
    .filter((entry) => entry.card)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  return formatRatedList(entries);
}

function formatCardsPerLevel() {
  const summary = deck.createCardSummary ? deck.createCardSummary(deck.cards) : createCardSummary(deck.cards);
  return Object.entries(summary.byLevel)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([level, count]) => `- Level ${level}: ${count}`)
    .join("\n");
}

function downloadTextFile(filename, text, mimeType) {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatExportDate() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
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

function handleKissAnimationKeydown(event) {
  if (!["Escape", "Enter", " "].includes(event.key)) {
    return;
  }

  event.preventDefault();
  dismissKissAnimation();
}

function dismissKissAnimation() {
  if (!ui.kissAnimation) {
    return;
  }

  ui.kissAnimation.classList.remove("is-active");
  ui.kissAnimation.setAttribute("aria-hidden", "true");
  ui.kissAnimation.setAttribute("tabindex", "-1");
}

function triggerKissAnimation() {
  if (!ui.kissAnimation) {
    return;
  }

  if (ui.kissAnimationText) {
    ui.kissAnimationText.textContent = getLipstickPenaltyTask(game, game.currentPlayerIndex);
  }
  ui.kissAnimation.classList.remove("is-active");
  ui.kissAnimation.setAttribute("aria-hidden", "false");
  ui.kissAnimation.setAttribute("tabindex", "0");
  window.requestAnimationFrame(() => {
    ui.kissAnimation.classList.add("is-active");
  });
  playSound("kiss");
  vibrate(60);
}

function recordCardDraw(card) {
  stats.totalDrawn += 1;
  stats.categoryDraws[card.category] = (stats.categoryDraws[card.category] || 0) + 1;
  if (game.jacuzziMode && isJacuzziCompatibleCard(card)) {
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
  game.levelOverride = null;
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
  showToast("Drie niet-gedaan voorbeelden toegevoegd.");
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
      if (isJacuzziModeCard(card)) {
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
    if (isJacuzziModeCard(card)) {
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

function createNewGame(playerOneName, playerTwoName, playerOneGender = DEFAULT_PLAYER_GENDERS[0], playerTwoGender = DEFAULT_PLAYER_GENDERS[1]) {
  return {
    stateVersion: STATE_VERSION,
    appVersion: APP_VERSION,
    activeGame: true,
    startedAt: Date.now(),
    endedAt: null,
    players: [
      createPlayer("player_1", playerOneName, 0, 0, playerOneGender),
      createPlayer("player_2", playerTwoName, 0, 0, playerTwoGender)
    ],
    currentPlayerIndex: 0,
    currentLevel: 1,
    levelOverride: null,
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
    turnAdvanceDueAt: null,
    pendingUnlockLevel: null,
    emptyDeckReason: null,
    specialSession: null,
    cardHistory: [],
    activePerfectRun: null,
    activeTimers: [],
    lipstickEvents: [],
    roundNotes: "",
    completedByPlayer: [0, 0],
    settingsSnapshot: {},
    timer: createDefaultTimer(),
    statistics: {}
  };
}

function createPlayer(id, name, completedCards, lipstickKisses, gender = "vrouw") {
  return {
    id,
    name,
    gender: normalizePlayerGender(gender, id === "player_2" ? DEFAULT_PLAYER_GENDERS[1] : DEFAULT_PLAYER_GENDERS[0]),
    completedCards,
    lipstickKisses,
    kisses: lipstickKisses
  };
}

function createDefaultPlayers() {
  return [
    createPlayer("player_1", DEFAULT_PLAYERS[0], 0, 0, DEFAULT_PLAYER_GENDERS[0]),
    createPlayer("player_2", DEFAULT_PLAYERS[1], 0, 0, DEFAULT_PLAYER_GENDERS[1])
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
    cardRatingsEnabled: false,
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
  const levelOverride = levelSystemEnabled ? normalizeLevelOverride(oldState.levelOverride) : null;
  const specialSession = normalizeSpecialSession(oldState.specialSession);
  const currentCardId = getCardById(oldState.currentCardId)
    ? oldState.currentCardId
    : specialSession?.parentCardId || null;
  const cardResolved = Boolean(oldState.cardResolved);
  const shouldResumeTurnAdvance = Boolean(
    oldState.activeGame &&
    currentCardId &&
    cardResolved &&
    !specialSession &&
    !oldState.pendingUnlockLevel
  );
  const timer = currentCardId && !cardResolved ? normalizeTimer(oldState.timer) : createDefaultTimer();

  return {
    ...fallbackGame,
    ...oldState,
    stateVersion: STATE_VERSION,
    appVersion: APP_VERSION,
    activeGame: Boolean(oldState.activeGame),
    startedAt: Number(oldState.startedAt) || Date.now(),
    endedAt: oldState.endedAt ? Number(oldState.endedAt) : null,
    players,
    currentPlayerIndex: clampPlayerIndex(oldState.currentPlayerIndex),
    currentLevel,
    levelOverride,
    unlockedLevels: normalizeUnlockedLevels(oldState.unlockedLevels, currentLevel),
    levelSystemEnabled,
    jacuzziMode: Boolean(oldState.jacuzziMode),
    jacuzziModeStartedAt: oldState.jacuzziModeStartedAt || null,
    usedCardIds: filterKnownCardIds(oldState.usedCardIds),
    completedCardIds: filterKnownCardIds(oldState.completedCardIds),
    skippedCardIds: filterKnownCardIds(oldState.skippedCardIds),
    temporaryRejectedCardIds: filterKnownCardIds(oldState.temporaryRejectedCardIds),
    currentCardId,
    cardResolved,
    pendingTurnAdvance: Boolean(oldState.pendingTurnAdvance || shouldResumeTurnAdvance),
    turnAdvanceDueAt: Number(oldState.turnAdvanceDueAt) || (shouldResumeTurnAdvance ? Date.now() : null),
    pendingUnlockLevel: oldState.pendingUnlockLevel ? clampLevel(oldState.pendingUnlockLevel) : null,
    emptyDeckReason: oldState.emptyDeckReason || null,
    specialSession,
    cardHistory: normalizeCardHistory(oldState.cardHistory, oldState.completedCardIds, oldState.skippedCardIds),
    activePerfectRun: specialSession?.type === "perfectRun" ? normalizeActivePerfectRun(oldState.activePerfectRun, specialSession) : null,
    activeTimers: normalizeActiveTimers(oldState.activeTimers, players),
    lipstickEvents: Array.isArray(oldState.lipstickEvents) ? oldState.lipstickEvents : [],
    roundNotes: String(oldState.roundNotes || "").slice(0, 2000),
    completedByPlayer: players.map((player) => player.completedCards),
    timer,
    statistics: normalizeStats(oldState.statistics)
  };
}

function loadSettings() {
  return normalizeSettings(loadJson(STORAGE_KEYS.settings, {}));
}

function loadCardRatings() {
  const rawRatings = loadJson(STORAGE_KEYS.cardRatings, {});
  if (!rawRatings || typeof rawRatings !== "object") {
    return {};
  }

  return Object.entries(rawRatings).reduce((normalized, [cardId, rating]) => {
    if (getCardById(cardId)) {
      normalized[cardId] = normalizeCardRating(rating);
    }
    return normalized;
  }, {});
}

function normalizeCardRating(rating = {}) {
  const ratings = {};
  RATING_TYPES.forEach((type) => {
    ratings[type] = Math.max(0, Number(rating?.ratings?.[type]) || 0);
  });
  return { ratings };
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
    cardRatingsEnabled: readBoolean(source.cardRatingsEnabled, defaults.cardRatingsEnabled),
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
  const gender = normalizePlayerGender(player?.gender, DEFAULT_PLAYER_GENDERS[index]);

  return createPlayer(
    player?.id || fallbackId,
    cleanName(player?.name, fallbackName),
    completedCards,
    lipstickKisses,
    gender
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
  game.stateVersion = STATE_VERSION;
  game.appVersion = APP_VERSION;
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

function saveCardRatings() {
  localStorage.setItem(STORAGE_KEYS.cardRatings, JSON.stringify(cardRatings));
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
    updateActiveTimers({ notify: false });
    saveGame();
    saveStats();
    updateWakeLock();
    return;
  }

  resumeJacuzziClock();
  resumeActiveTimers();
  saveGame();
  updateWakeLock();
}

function handlePageExit() {
  finalizeJacuzziTime();
  updateActiveTimers({ notify: false });
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

function normalizeLevelOverride(value) {
  const level = Number(value);
  return level === 4 || level === 5 ? level : null;
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

function normalizePlayerGender(value, fallback = "vrouw") {
  const normalizedValue = String(value || "").trim().toLowerCase();
  const aliases = {
    vrouw: "vrouw",
    female: "vrouw",
    woman: "vrouw",
    v: "vrouw",
    f: "vrouw",
    man: "man",
    male: "man",
    m: "man"
  };
  const gender = aliases[normalizedValue] || null;
  if (gender && PLAYER_GENDERS.has(gender)) {
    return gender;
  }

  if (fallback === null) {
    return null;
  }

  return fallback && PLAYER_GENDERS.has(fallback) ? fallback : "vrouw";
}

function normalizeRestrictionGender(value) {
  return normalizePlayerGender(value, null);
}

function getRadioValue(radios, fallback) {
  const selected = [...radios].find((radio) => radio.checked);
  return normalizePlayerGender(selected?.value, fallback);
}

function setRadioValue(radios, value) {
  const normalizedValue = normalizePlayerGender(value, "vrouw");
  radios.forEach((radio) => {
    radio.checked = radio.value === normalizedValue;
  });
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
      { frequency: 880, duration: 0.18, gain: 0.13, type: "square" },
      { frequency: 660, duration: 0.18, gain: 0.12, offset: 0.2, type: "square" },
      { frequency: 880, duration: 0.2, gain: 0.13, offset: 0.42, type: "square" },
      { frequency: 520, duration: 0.34, gain: 0.14, offset: 0.68, type: "sawtooth" }
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

function formatDutchCount(value) {
  const count = Number(value) || 0;
  const labels = {
    1: "één",
    2: "twee",
    3: "drie",
    4: "vier",
    5: "vijf",
    10: "tien"
  };
  return labels[count] || String(count);
}

function capitalizeFirst(value) {
  const text = String(value || "");
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "";
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
  pickRandomCard,
  getCardById,
  isSpecialCard,
  handleSpecialCard,
  completePendingTurnAdvance,
  createNewGame,
  createDefaultStats,
  createDefaultSettings,
  migrateGameState,
  normalizeStats,
  recalculateStatsFromHistory,
  createPlaytestExportData,
  addLipstickKiss,
  rateCurrentCard,
  switchTurn,
  getTimerRemainingSeconds,
  getActiveTimerRemainingSeconds,
  getDisplayCardTitle,
  getDisplayCardText,
  getDisplayCardSafetyNote,
  getEffectiveLevel,
  getNormalPlayableLevel,
  getCardWeight,
  isJacuzziCompatibleCard,
  stopTimerForResolvedCard,
  normalizeActiveTimers,
  stopActiveTimerInterval,
  clearIneligibleCurrentCard,
  createCardReportPayload,
  getLipstickPenaltyTask,
  validateCards: () => getCardValidationResult(),
  setRandomSource(nextRandomSource) {
    randomSource = typeof nextRandomSource === "function" ? nextRandomSource : Math.random;
  },
  resetRandomSource() {
    randomSource = Math.random;
  },
  setTestState(nextGame, nextStats = {}, nextSettings = {}) {
    settings = normalizeSettings({
      ...createDefaultSettings(),
      ...nextSettings
    });
    stats = normalizeStats(nextStats);
    cardRatings = {};
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
  getCardRatings() {
    return cardRatings;
  },
  getSettings() {
    return settings;
  }
};
