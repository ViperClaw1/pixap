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

function parsePrice(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const numberValue = Number.parseInt(trimmed, 10);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function runParserSelfChecks() {
  const checks = [
    normalize("  YES!!! ") === "yes",
    parseYesNo("Yep") === "yes",
    parseYesNo("Nope.") === "no",
    parseYesNo("maybe") === null,
    parsePrice("150") === 150,
    parsePrice(" 0050 ") === 50,
    parsePrice("price is 42.99") === null,
    parsePrice("free") === null,
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
  parsePrice,
  runParserSelfChecks,
};
