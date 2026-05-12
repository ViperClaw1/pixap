import { Entypo, FontAwesome5, Fontisto, Ionicons } from "@expo/vector-icons";

export type CategoryIconSpec =
  | { family: "ionicons"; name: keyof typeof Ionicons.glyphMap }
  | { family: "entypo"; name: keyof typeof Entypo.glyphMap }
  | { family: "fontawesome5"; name: keyof typeof FontAwesome5.glyphMap }
  | { family: "fontisto"; name: keyof typeof Fontisto.glyphMap };

const CATEGORY_ICON_BY_NAME: Record<string, CategoryIconSpec> = {
  bars: { family: "entypo", name: "drink" },
  clubs: { family: "fontawesome5", name: "users" },
  entertainment: { family: "fontawesome5", name: "glass-cheers" },
  hotels: { family: "fontisto", name: "hotel" },
  tourism: { family: "fontawesome5", name: "umbrella-beach" },
  restaurants: { family: "ionicons", name: "restaurant-outline" },
  restaurant: { family: "ionicons", name: "restaurant-outline" },
  beauty: { family: "ionicons", name: "sparkles-outline" },
  events: { family: "ionicons", name: "ticket-outline" },
  shopping: { family: "ionicons", name: "bag-handle-outline" },
  fitness: { family: "ionicons", name: "barbell-outline" },
  spa: { family: "ionicons", name: "flower-outline" },
  nightlife: { family: "ionicons", name: "wine-outline" },
  kids: { family: "ionicons", name: "happy-outline" },
};

const DEFAULT_CATEGORY_ICON: CategoryIconSpec = { family: "ionicons", name: "grid-outline" };

export function resolveCategoryIconSpec(name: string): CategoryIconSpec {
  return CATEGORY_ICON_BY_NAME[name.trim().toLowerCase()] ?? DEFAULT_CATEGORY_ICON;
}

type Props = {
  spec: CategoryIconSpec;
  color: string;
  size: number;
};

export function CategoryIcon({ spec, color, size }: Props) {
  switch (spec.family) {
    case "entypo":
      return <Entypo name={spec.name} size={size} color={color} />;
    case "fontawesome5":
      return <FontAwesome5 name={spec.name} size={size} color={color} />;
    case "fontisto":
      return <Fontisto name={spec.name} size={size} color={color} />;
    default:
      return <Ionicons name={spec.name} size={size} color={color} />;
  }
}
