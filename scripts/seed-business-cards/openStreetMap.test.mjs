import assert from "node:assert/strict";
import test from "node:test";
import { cityLabelFromNominatimResult } from "./openStreetMap.mjs";

test("uses Turkish province instead of county as city", () => {
  const result = {
    address: {
      county: "Fatih",
      state: "İstanbul",
      country: "Türkiye",
      country_code: "tr",
    },
  };

  assert.equal(cityLabelFromNominatimResult(result), "İstanbul, Türkiye");
});
