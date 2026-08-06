const POST_TEMPLATES = [
  ({ name }) => `Found this place by accident and loved the atmosphere at ${name}. Definitely coming back.`,
  ({ name }) => `${name} was exactly what I needed today. Great vibe, friendly people, and a genuinely memorable visit.`,
  ({ name, city }) => `A small highlight from ${city || "today"}: ${name}. Worth adding to your list.`,
  ({ name }) => `First time at ${name} and it exceeded expectations. The details here make all the difference.`,
  ({ name }) => `Quick recommendation: ${name}. Everything felt effortless, welcoming, and well thought out.`,
  ({ name, city }) => `One of my favorite recent discoveries in ${city || "the city"} — ${name}.`,
  ({ name }) => `The energy at ${name} is hard to capture in one photo, but this comes close.`,
  ({ name }) => `Spent a great evening at ${name}. Saving this spot for the next visit.`,
  ({ name }) => `${name} delivered on the hype. Good atmosphere and plenty of reasons to return.`,
  ({ name, city }) => `If you are around ${city || "here"}, take a look at ${name}. A very easy recommendation.`,
  ({ name }) => `A few moments from ${name}. This place has its own character and gets the mood just right.`,
  ({ name }) => `Already planning another visit to ${name}. This one belongs in the favorites.`,
];

export function buildPostContent(card, index) {
  const template = POST_TEMPLATES[index % POST_TEMPLATES.length];
  return template({
    name: card.name?.trim() || "this place",
    city: card.city?.trim() || "",
  });
}
