import type { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { ErrorFallback } from "./ErrorFallback";

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <ErrorFallback
          error={error}
          resetError={resetError}
          titleKey="errorBoundary.appTitle"
          descriptionKey="errorBoundary.appDescription"
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
