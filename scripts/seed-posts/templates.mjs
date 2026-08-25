import { pickFrom, pickInt } from "./lib.mjs";

const OPENERS = [
  ({ name }) => `Just left ${name}.`,
  ({ name }) => `${name} hit different tonight.`,
  ({ name }) => `Finally made it to ${name}.`,
  ({ name }) => `Spontaneous stop at ${name}.`,
  ({ name }) => `Quick notes from ${name}.`,
  ({ name }) => `Soft launch for my new favorite: ${name}.`,
  ({ name }) => `${name} — logged.`,
  ({ name }) => `Came for one drink at ${name}, stayed longer.`,
  ({ name }) => `Caught golden hour at ${name}.`,
  ({ name }) => `Took friends to ${name} and no regrets.`,
  ({ name, city }) => `${city ? `${city}: ` : ""}${name} delivered.`,
  ({ name }) => `Low-key obsessed with ${name} already.`,
];

const MIDDLES = [
  () => "The lighting alone was worth the visit.",
  () => "Service was sharp without being stiff.",
  () => "Music was perfect — loud enough, not trying too hard.",
  () => "Crowd felt right: local, relaxed, zero tourist chaos.",
  () => "Food came out fast and actually looked like the photos.",
  () => "Seats by the window = free therapy.",
  () => "Interior details are ridiculous in a good way.",
  () => "Staff remembered the order without prompting.",
  () => "Not overhyped for once.",
  () => "The playlist + smell of coffee combo works weirdly well.",
  () => "Felt expensive without the attitude.",
  () => "Tiny place, huge personality.",
  () => "Would bring a date here without overthinking it.",
  () => "The kind of spot you don't tell everyone about.",
  () => "Walked in skeptical, walked out converting friends.",
  () => "Portions were honest. Atmosphere even better.",
  () => "Clean, calm, and somehow still lively.",
  () => "That corner booth is dangerous — too comfortable.",
];

const CLOSERS = [
  () => "Saving this one.",
  () => "Already planning round two.",
  () => "Hard recommend.",
  () => "10/10 would wander in again.",
  () => "Bookmarked.",
  () => "Add it to your list.",
  () => "Not leaving town without another visit.",
  () => "This stays in my rotation.",
  () => "Bring someone who gets good vibes.",
  () => "That's the post.",
  () => "No notes.",
  () => "Worth the detour.",
];

/** Longer single-shot templates for variety beyond opener/middle/closer. */
const FULL_TEMPLATES = [
  ({ name }) =>
    `Found ${name} by accident and stayed longer than planned. The vibe is quiet confidence — nothing flashy, just right.`,
  ({ name, city }) =>
    `${name}${city ? ` in ${city}` : ""} feels like the place people keep to themselves. Glad I didn't.`,
  ({ name }) =>
    `First visit to ${name}. Came for the photos, stayed for the room temperature chaos and perfect espresso.`,
  ({ name }) =>
    `If ${name} was a mood board: warm wood, soft chatter, zero rush. Exactly what I needed.`,
  ({ name, city }) =>
    `Rainy afternoon in ${city || "the city"} → ${name}. Ordered without looking at the menu. Still happy.`,
  ({ name }) =>
    `${name} at golden hour is unfair. Bring a jacket and someone who won't rush you.`,
  ({ name }) =>
    `Took a client to ${name} — conversation flowed, food didn't interrupt. Rare combo.`,
  ({ name }) =>
    `Late-night ${name}. Empty enough to talk, full enough to feel alive. Peak setting.`,
  ({ name }) =>
    `${name} quietly fixed my week. No drama, just good seating and better coffee than expected.`,
  ({ name, city }) =>
    `Map said walk 12 minutes. ${name}${city ? ` (${city})` : ""} said stay 2 hours. Fair trade.`,
  ({ name }) =>
    `Honest review of ${name}: noisy in the best way, staff who actually care, and a dessert I will dream about.`,
  ({ name }) =>
    `Stopped by ${name} before a meeting. Left with a better mood and sticky notes for next time.`,
  ({ name }) =>
    `${name} doesn't try to be everything. That focus shows — every corner has intention.`,
  ({ name }) =>
    `Group of 4 at ${name}, zero negotiation on the bill-splitting trauma. Smooth night.`,
  ({ name }) =>
    `Solo table at ${name}. Laptop closed after 10 minutes. Priority: people-watching.`,
  ({ name, city }) =>
    `Travel tip for ${city || "anywhere"}: skip the obvious places, go to ${name} first.`,
  ({ name }) =>
    `${name} smells like citrus and ambition. Weird sentence. Accurate place.`,
  ({ name }) =>
    `Came back to ${name} a second time this week. That's the review.`,
  ({ name }) =>
    `The playlist at ${name} deserves its own Spotify follow. Atmosphere does half the work.`,
  ({ name }) =>
    `Understated luxury at ${name} — no velvet ropes, just better bread and calmer people.`,
  ({ name }) =>
    `Birthday dinner at ${name}. Cake arrived without a spectacle. Appreciated.`,
  ({ name }) =>
    `${name} is the answer when someone says "where should we go?" and you want zero risk.`,
  ({ name }) =>
    `Caught the soft opening energy at ${name} even though they've been open forever. Still feels fresh.`,
  ({ name }) =>
    `Walked past ${name} three times. Finally went in. Lesson learned.`,
  ({ name }) =>
    `Brunch at ${name} cured my decision fatigue. Ordered the house special. No notes.`,
  ({ name }) =>
    `${name}: good lighting for bad hair days. Also good coffee. Priorities.`,
  ({ name }) =>
    `Friends argued about dessert. ${name} settled it with one shared plate. Diplomacy.`,
  ({ name }) =>
    `Quiet table, loud opinions about the cocktail list at ${name}. Both were correct.`,
  ({ name }) =>
    `This is my "impress out-of-town friends" card now: ${name}.`,
  ({ name }) =>
    `${name} between meetings = illegal levels of calm. Highly suggest.`,
];

function buildCompositeContent(card, rng) {
  const ctx = {
    name: card.name?.trim() || "this place",
    city: card.city?.trim() || "",
  };
  const opener = pickFrom(rng, OPENERS)(ctx);
  const middleCount = pickInt(rng, 1, 2);
  const middles = [];
  const used = new Set();
  while (middles.length < middleCount) {
    const middle = pickFrom(rng, MIDDLES)();
    if (used.has(middle)) continue;
    used.add(middle);
    middles.push(middle);
  }
  const closer = pickFrom(rng, CLOSERS)();
  return [opener, ...middles, closer].join(" ");
}

/**
 * @param {{ name?: string | null, city?: string | null }} card
 * @param {number} index
 * @param {(() => number) | null} [rng]
 */
export function buildPostContent(card, index, rng = null) {
  const ctx = {
    name: card.name?.trim() || "this place",
    city: card.city?.trim() || "",
  };

  if (rng) {
    // ~55% composite (more natural variance), ~45% full template
    if (rng() < 0.55) return buildCompositeContent(card, rng);
    return pickFrom(rng, FULL_TEMPLATES)(ctx);
  }

  const template = FULL_TEMPLATES[index % FULL_TEMPLATES.length];
  return template(ctx);
}
