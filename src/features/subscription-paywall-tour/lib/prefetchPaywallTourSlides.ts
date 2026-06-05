import { Asset } from "expo-asset";
import type { ImageSource } from "expo-image";
import type { PaywallTourSlide } from "../model/paywallTourSlides";

function toAssetModule(source: ImageSource): number | null {
  return typeof source === "number" ? source : null;
}

export function prefetchPaywallTourSlides(slides: PaywallTourSlide[]): void {
  const modules = slides
    .map((slide) => toAssetModule(slide.image))
    .filter((module): module is number => module != null);
  if (!modules.length) return;
  void Asset.loadAsync(modules).catch(() => undefined);
}
