import type { ThemeColors } from "@/shared/theme/palettes";
import { useLinkPreview } from "../hooks/useLinkPreview";
import { LinkPreviewCard } from "./LinkPreviewCard";

type Props = {
  url: string;
  colors: ThemeColors;
};

export function MessageUrlPreviewBlock({ url, colors }: Props) {
  const state = useLinkPreview(url);
  if (state.status === "idle") return null;
  if (state.status === "loading") {
    return <LinkPreviewCard url={url} colors={colors} loading data={null} />;
  }
  if (state.status === "ok") {
    return <LinkPreviewCard url={url} colors={colors} loading={false} data={state.data} />;
  }
  return null;
}
