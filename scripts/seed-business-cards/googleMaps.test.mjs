import assert from "node:assert/strict";
import test from "node:test";
import { cityLabelFromAddressComponents } from "./googleMaps.mjs";

const component = (long_name, short_name, ...types) => ({ long_name, short_name, types });

test("uses Turkish province instead of district as city", () => {
  const components = [
    component("Fatih", "Fatih", "administrative_area_level_2"),
    component("İstanbul", "İstanbul", "administrative_area_level_1"),
    component("Türkiye", "TR", "country"),
  ];

  assert.equal(cityLabelFromAddressComponents(components), "İstanbul, Türkiye");
});

test("keeps locality as the preferred city", () => {
  const components = [
    component("Alanya", "Alanya", "locality"),
    component("Antalya", "Antalya", "administrative_area_level_1"),
    component("Türkiye", "TR", "country"),
  ];

  assert.equal(cityLabelFromAddressComponents(components), "Alanya, Türkiye");
});
