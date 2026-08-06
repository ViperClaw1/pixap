import { describe, expect, it } from "vitest";
import { isCategoryBookingAllowed } from "./categoryCapabilities";
import { buildHomeCategoryList, isHomeCategorySelectable } from "./homeCategoryList";

describe("Tourism category capabilities", () => {
  it("is active for browsing when the database category exists", () => {
    const categories = [
      {
        id: "c7feef80-2984-49fd-85f1-d615f5a3ce9c",
        name: "Tourism",
        business_cards_count: 4,
      },
    ];

    const tourism = buildHomeCategoryList(categories).find((category) => category.name === "Tourism");

    expect(tourism).toMatchObject({
      id: "c7feef80-2984-49fd-85f1-d615f5a3ce9c",
      isComingSoon: false,
    });
    expect(tourism && isHomeCategorySelectable(tourism)).toBe(true);
  });

  it("blocks booking only for Tourism", () => {
    expect(isCategoryBookingAllowed(" Tourism ")).toBe(false);
    expect(isCategoryBookingAllowed("Restaurants")).toBe(true);
    expect(isCategoryBookingAllowed(null)).toBe(true);
  });
});
