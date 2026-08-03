import { CHAOS_CARDS } from "./chaos.js";
import { MAKEUP_CARDS } from "./makeup.js";
import { BLINDFOLD_CARDS } from "./blindfold.js";
import { CUTE_CARDS } from "./cute.js";
import { FLIRTY_CARDS } from "./flirty.js";
import { OOHLALA_CARDS } from "./oohlala.js";
import { DISNEY_CARDS } from "./disney.js";
import { JACUZZI_CARDS } from "./jacuzzi.js";
import { SPECIAL_CARDS } from "./special.js";

export const ALL_CARDS = [
  ...CHAOS_CARDS,
  ...MAKEUP_CARDS,
  ...BLINDFOLD_CARDS,
  ...CUTE_CARDS,
  ...FLIRTY_CARDS,
  ...OOHLALA_CARDS,
  ...DISNEY_CARDS,
  ...JACUZZI_CARDS,
  ...SPECIAL_CARDS,
];

export const CARD_COUNTS = ALL_CARDS.reduce((acc, card) => {
  acc.total += 1;
  acc.byCategory[card.category] = (acc.byCategory[card.category] || 0) + 1;
  acc.byLevel[card.level] = (acc.byLevel[card.level] || 0) + 1;
  return acc;
}, { total: 0, byCategory: {}, byLevel: {} });

export function validateCards(cards = ALL_CARDS) {
  const errors = [];
  const ids = new Set();
  const validCategories = new Set([
    "chaos", "makeup", "blindfold", "cute", "flirty",
    "oohlala", "disney", "jacuzzi", "special"
  ]);
  const validRestrictions = new Set([null, "player_1", "player_2", "winnie", "tijgertje"]);

  for (const card of cards) {
    if (!card.id || typeof card.id !== "string") errors.push("Kaart zonder geldige id.");
    if (ids.has(card.id)) errors.push(`Dubbele id: ${card.id}`);
    ids.add(card.id);
    if (!validCategories.has(card.category)) errors.push(`Ongeldige categorie bij ${card.id}`);
    if (!card.title || !card.text) errors.push(`Titel of tekst ontbreekt bij ${card.id}`);
    if (!Number.isInteger(card.level) || card.level < 1 || card.level > 5) {
      errors.push(`Ongeldig level bij ${card.id}`);
    }
    if (card.timerSeconds !== null && (!Number.isFinite(card.timerSeconds) || card.timerSeconds <= 0)) {
      errors.push(`Ongeldige timer bij ${card.id}`);
    }
    if (!validRestrictions.has(card.playerRestriction)) {
      errors.push(`Ongeldige playerRestriction bij ${card.id}`);
    }
    if (card.requiresJacuzzi && card.category !== "jacuzzi") {
      errors.push(`requiresJacuzzi buiten jacuzzi-categorie bij ${card.id}`);
    }
  }
  return errors;
}
