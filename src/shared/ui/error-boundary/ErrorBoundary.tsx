import { Component, type ErrorInfo, type ReactNode } from "react";
import { devError } from "@/shared/lib/devLog";

export type ErrorBoundaryFallbackProps = {
  error: Error;
  resetError: () => void;
};

export type ErrorBoundaryProps = {
  children: ReactNode;
  fallback: (props: ErrorBoundaryFallbackProps) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    devError("[ErrorBoundary]", error.message, info.componentStack);
    this.props.onError?.(error, info);
  }

  private resetError = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (error) {
      return this.props.fallback({ error, resetError: this.resetError });
    }
    return this.props.children;
  }
}
