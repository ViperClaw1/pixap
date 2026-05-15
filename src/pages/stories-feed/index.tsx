import StoriesFeedPage from "./ui/StoriesFeedPage";
import { ScreenErrorBoundary } from "@/shared/ui/error-boundary";

export default function StoriesFeedScreen() {
  return (
    <ScreenErrorBoundary scope="feed">
      <StoriesFeedPage />
    </ScreenErrorBoundary>
  );
}
