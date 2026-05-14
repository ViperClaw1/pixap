import { useEffect, useState } from "react";
import { fetchLinkPreview, type LinkPreviewData } from "../api/fetchLinkPreview";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: LinkPreviewData }
  | { status: "error" };

export function useLinkPreview(url: string | null): State {
  const [state, setState] = useState<State>({ status: "idle" });

  useEffect(() => {
    if (!url) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    void fetchLinkPreview(url)
      .then((data) => {
        if (cancelled) return;
        const hasAny = Boolean(data.title || data.description || data.imageUrl);
        setState(hasAny ? { status: "ok", data } : { status: "error" });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
