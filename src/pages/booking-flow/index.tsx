import BookingFlowPage from "./ui/BookingFlowPage";
import { ScreenErrorBoundary } from "@/shared/ui/error-boundary";

export default function BookingFlowScreen() {
  return (
    <ScreenErrorBoundary scope="booking">
      <BookingFlowPage />
    </ScreenErrorBoundary>
  );
}
