function normalize(text) {
  if (typeof text !== "string") return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s\u0400-\u04ff$€£₽]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseYesNo(text) {
  const normalized = normalize(text);
  if (!normalized) return null;

  const words = new Set(normalized.split(" "));
  const yesWords = ["yes", "yeah", "yep", "y", "да"];
  const noWords = ["no", "nope", "n", "нет"];

  for (const word of yesWords) {
    if (words.has(word)) return "yes";
  }
  for (const word of noWords) {
    if (words.has(word)) return "no";
  }
  return null;
}

/** @returns {"yes"|"no"|null} */
function parseAvailabilityReply(text) {
  const normalized = normalize(text);
  if (!normalized) return null;

  const yesPatterns = [
    "yes available",
    "yes, available",
    "да доступен",
    "да, доступен",
  ];
  const noPatterns = [
    "no not available",
    "no, not available",
    "нет не доступен",
    "нет, не доступен",
    "нет недоступен",
    "нет, недоступен",
  ];

  for (const p of yesPatterns) {
    if (normalized.includes(p) || normalized === p.replace(/,/g, "")) return "yes";
  }
  for (const p of noPatterns) {
    if (normalized.includes(p) || normalized === p.replace(/,/g, "")) return "no";
  }

  const yesNo = parseYesNo(normalized);
  if (yesNo === "yes" && /\bavailable\b|\bдоступен\b/.test(normalized)) return "yes";
  if (yesNo === "no" && /\bnot available\b|\bнедоступен\b|\bне доступен\b/.test(normalized)) return "no";

  return null;
}

/** @returns {"free"|"send_price"|null} */
function parseFreeOrPriceReply(text) {
  const normalized = normalize(text);
  if (!normalized) return null;

  const freePatterns = ["it s free", "its free", "free", "бесплатно"];
  const pricePatterns = ["send the price", "send price", "назвать стоимость", "указать стоимость"];

  for (const p of freePatterns) {
    if (normalized === p || normalized.includes(p)) return "free";
  }
  for (const p of pricePatterns) {
    if (normalized.includes(p)) return "send_price";
  }

  return null;
}

const CURRENCY_SYMBOLS = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "₽": "RUB",
  "֏": "AMD",
  "₸": "KZT",
  "₴": "UAH",
  "₾": "GEL",
  "₼": "AZN",
};

/** ISO 4217 codes matched case-insensitively as whole words in owner price replies. */
const ISO_CURRENCY_CODES = [
  "USD",
  "RUB",
  "EUR",
  "GBP",
  "AMD",
  "KZT",
  "GEL",
  "UAH",
  "BYN",
  "AZN",
  "UZS",
  "CHF",
  "CNY",
  "JPY",
  "TRY",
  "AED",
  "SAR",
  "ILS",
  "PLN",
  "CZK",
  "SEK",
  "NOK",
  "DKK",
  "CAD",
  "AUD",
  "INR",
  "THB",
  "VND",
  "IDR",
  "MYR",
  "PHP",
  "HKD",
  "SGD",
  "KRW",
  "MXN",
  "BRL",
  "ARS",
  "CLP",
  "COP",
  "PEN",
  "EGP",
  "QAR",
  "KWD",
  "BHD",
  "OMR",
  "JOD",
  "LBP",
  "MDL",
  "RON",
  "HUF",
  "BGN",
  "HRK",
  "RSD",
  "ISK",
];

const CURRENCY_WORDS = [
  { re: /\b(usd|dollars?|dollar)\b/i, code: "USD" },
  { re: /\b(eur|euros?)\b/i, code: "EUR" },
  { re: /\b(gbp|pounds?|sterling)\b/i, code: "GBP" },
  { re: /\b(rub|ruble?s?|руб(?:лей|ля|ль)?|рубл(?:ей|я|ь)?)\b/i, code: "RUB" },
  { re: /\b(kzt|tenge|тенге|тг)\b/i, code: "KZT" },
  { re: /\b(amd|dram|драм(?:ов)?)\b/i, code: "AMD" },
  { re: /\b(uah|гривн(?:а|ы|е|ей)?|грн)\b/i, code: "UAH" },
  { re: /\b(byn|бел(?:орусский)?\s*руб(?:лей|ля|ль)?)\b/i, code: "BYN" },
  { re: /\b(azn|манат(?:ов)?)\b/i, code: "AZN" },
  { re: /\b(uzs|сум(?:ов)?)\b/i, code: "UZS" },
  { re: /\b(gel|лари)\b/i, code: "GEL" },
  { re: /\b(chf|francs?)\b/i, code: "CHF" },
  { re: /\b(cny|yuan|rmb|юан(?:и|ей)?)\b/i, code: "CNY" },
  { re: /\b(jpy|yen)\b/i, code: "JPY" },
  { re: /\b(try|lira|лир(?:а|ы)?)\b/i, code: "TRY" },
  { re: /\b(aed|dirham|дирхам(?:ов)?)\b/i, code: "AED" },
  { re: /\b(cad|canadian\s*dollars?)\b/i, code: "CAD" },
  { re: /\b(aud|australian\s*dollars?)\b/i, code: "AUD" },
];

function detectIsoCurrencyCode(raw) {
  for (const code of ISO_CURRENCY_CODES) {
    if (new RegExp(`\\b${code}\\b`, "i").test(raw)) {
      return code;
    }
  }
  return "";
}

function detectCurrency(raw, normalized) {
  const iso = detectIsoCurrencyCode(raw);
  if (iso) return iso;

  for (const [sym, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (raw.includes(sym)) return sym.length === 1 ? sym : code;
  }
  for (const { re, code } of CURRENCY_WORDS) {
    if (re.test(normalized) || re.test(raw)) return code;
  }
  return "";
}

/**
 * Extract numeric amount and currency from free-form owner message.
 * @returns {{ amount: string, currency: string, display: string } | null}
 */
function parsePriceAndCurrency(text) {
  if (typeof text !== "string") return null;
  const raw = text.trim();
  if (!raw) return null;

  const normalized = normalize(raw);
  const amountCandidates = raw.match(/\d+(?:[.,]\d+)?/g);
  if (!amountCandidates?.length) return null;

  let amount = amountCandidates[0];
  let bestNumeric = 0;
  for (const candidate of amountCandidates) {
    const numeric = Number(candidate.replace(/,/g, ""));
    if (Number.isFinite(numeric) && numeric >= bestNumeric) {
      bestNumeric = numeric;
      amount = candidate;
    }
  }

  amount = amount.replace(/,/g, ".");
  if (amount.includes(".") && amount.split(".")[1]?.length === 3) {
    amount = amount.replace(/\./g, "");
  }

  const currency = detectCurrency(raw, normalized);
  const display = currency.length === 1 ? `${amount} ${currency}` : currency ? `${amount} ${currency}` : amount;

  return { amount, currency, display: display.trim() };
}

function parsePaymentLink(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  return parsed.toString();
}

function runParserSelfChecks() {
  const checks = [
    normalize("  YES!!! ") === "yes",
    parseYesNo("Yep") === "yes",
    parseYesNo("Nope.") === "no",
    parseYesNo("maybe") === null,
    parseAvailabilityReply("Yes, available") === "yes",
    parseAvailabilityReply("No, not available") === "no",
    parseAvailabilityReply("Да, доступен") === "yes",
    parseAvailabilityReply("Нет, не доступен") === "no",
    parseFreeOrPriceReply("It's free") === "free",
    parseFreeOrPriceReply("Бесплатно") === "free",
    parseFreeOrPriceReply("Send the price") === "send_price",
    parseFreeOrPriceReply("Назвать стоимость") === "send_price",
    parsePriceAndCurrency("The price will be 25 USD")?.display === "25 USD",
    parsePriceAndCurrency("1500 руб")?.amount === "1500",
    parsePriceAndCurrency("$50")?.display.includes("50"),
    parsePriceAndCurrency("10000 kzt")?.currency === "KZT",
    parsePriceAndCurrency("15000 KZT")?.currency === "KZT",
    parsePriceAndCurrency("5000 amd")?.currency === "AMD",
    parsePriceAndCurrency("120 EUR")?.currency === "EUR",
    parsePriceAndCurrency("3000 rub")?.currency === "RUB",
    parsePaymentLink("https://pay.example.com/invoice/abc") === "https://pay.example.com/invoice/abc",
    parsePaymentLink("ftp://pay.example.com") === null,
  ];
  const allPassed = checks.every(Boolean);
  if (!allPassed) {
    throw new Error("[parser] self-checks failed");
  }
  console.log("[parser] self-checks passed");
}

module.exports = {
  normalize,
  parseYesNo,
  parseAvailabilityReply,
  parseFreeOrPriceReply,
  parsePriceAndCurrency,
  parsePaymentLink,
  runParserSelfChecks,
};
