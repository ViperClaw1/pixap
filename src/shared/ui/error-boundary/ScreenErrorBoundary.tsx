import type { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { ErrorFallback } from "./ErrorFallback";

export type ScreenErrorBoundaryScope = "feed" | "booking";

const SCOPE_KEYS: Record<
  ScreenErrorBoundaryScope,
  { titleKey: string; descriptionKey: string }
> = {
  feed: {
    titleKey: "errorBoundary.feedTitle",
    descriptionKey: "errorBoundary.feedDescription",
  },
  booking: {
    titleKey: "errorBoundary.bookingTitle",
    descriptionKey: "errorBoundary.bookingDescription",
  },
};

type ScreenErrorBoundaryProps = {
  children: ReactNode;
  scope: ScreenErrorBoundaryScope;
};

export function ScreenErrorBoundary({ children, scope }: ScreenErrorBoundaryProps) {
  const { titleKey, descriptionKey } = SCOPE_KEYS[scope];

  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <ErrorFallback
          error={error}
          resetError={resetError}
          titleKey={titleKey}
          descriptionKey={descriptionKey}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
