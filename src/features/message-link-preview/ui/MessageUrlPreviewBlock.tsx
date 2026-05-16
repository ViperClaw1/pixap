import { useLinkPreview } from "../hooks/useLinkPreview";
import { LinkPreviewCard } from "./LinkPreviewCard";

type Props = {
  url: string;
};

export function MessageUrlPreviewBlock({ url }: Props) {
  const state = useLinkPreview(url);
  if (state.status === "idle") return null;
  if (state.status === "loading") {
    return <LinkPreviewCard url={url} loading data={null} />;
  }
  if (state.status === "ok") {
    return <LinkPreviewCard url={url} loading={false} data={state.data} />;
  }
  return null;
}
