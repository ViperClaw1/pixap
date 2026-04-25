function normalize(text) {
  if (typeof text !== "string") return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseYesNo(text) {
  const normalized = normalize(text);
  if (!normalized) return null;

  const words = new Set(normalized.split(" "));
  const yesWords = ["yes", "yeah", "yep", "y"];
  const noWords = ["no", "nope", "n"];

  for (const word of yesWords) {
    if (words.has(word)) return "yes";
  }
  for (const word of noWords) {
    if (words.has(word)) return "no";
  }
  return null;
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
    parsePaymentLink("https://pay.example.com/invoice/abc") === "https://pay.example.com/invoice/abc",
    parsePaymentLink("http://pay.example.com") === "http://pay.example.com/",
    parsePaymentLink("pay.example.com/invoice/abc") === null,
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
  parsePaymentLink,
  runParserSelfChecks,
};
