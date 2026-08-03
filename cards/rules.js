export const GAME_RULES = {
  safeWord: "WALIBI",
  lipstickRule:
    "Durf of wil je een opdracht niet doen? Dan krijgt de huidige speler één lippenstiftafdruk op een afgesproken plek. De afdruk blijft zitten tot het einde van het spel.",
  lipstickPenaltyTask: "Laat de ander een lippenstiftafdruk achterlaten.",
  consentNotice:
    "Alle opdrachten zijn optioneel en mogen altijd worden aangepast of gestopt. WALIBI betekent onmiddellijk stoppen en loslaten.",
  levelRequirementsPerPlayer: {
    1: 0,
    2: 4,
    3: 8,
    4: 10,
    5: 16
  },
  categoryUnlocks: {
    1: ["chaos", "cute", "disney", "jacuzzi"],
    2: ["makeup", "flirty"],
    3: ["blindfold"],
    4: ["oohlala"],
    5: ["special"]
  },
  specialRules: {
    roulette: {
      candidateCount: 10,
      requiredCount: 3
    },
    perfectRun: {
      requiredCount: 5
    }
  },
  jacuzziMode: {
    includeRequiresJacuzzi: true,
    includeBubbleCards: true,
    includeWellnessOrChaos: true,
    includeRegularJacuzziAllowed: true
  },
  categoryWeightMultipliers: {
    makeup: 0.65
  }
};
