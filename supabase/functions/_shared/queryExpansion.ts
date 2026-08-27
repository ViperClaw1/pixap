const EXPANSIONS: Record<string, string> = {
  пепперони: "пицца pizza итальянская italian",
  pepperoni: "pizza пицца italian итальянская",
  маргарита: "пицца pizza итальянская",
  margherita: "pizza пицца italian",
  карбонара: "паста pasta итальянская italian",
  carbonara: "pasta паста italian",
  хинкали: "грузинская georgian",
  хачапури: "грузинская georgian",
  плов: "узбекская uzbek",
  рамен: "ramen ramen японская japanese",
  ramen: "рамен японская japanese",
  "том ям": "тайская thai",
  "pad thai": "thai тайская",
  bibimbap: "korean корейская",
  бибимбап: "корейская korean",
  бурито: "мексиканская mexican",
  burrito: "mexican мексиканская",
  тирамису: "итальянская italian",
  tiramisu: "italian итальянская",
  роллы: "суши sushi японская japanese",
  rolls: "sushi суши japanese",
};

export function expandQuery(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const lower = trimmed.toLowerCase();
  const extras: string[] = [];
  for (const [keyword, expansion] of Object.entries(EXPANSIONS)) {
    if (lower.includes(keyword)) extras.push(expansion);
  }
  return extras.length ? `${trimmed} ${extras.join(" ")}` : trimmed;
}
