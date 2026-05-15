"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[WidgetErrorBoundary]", error, errorInfo);
    import("@sentry/nextjs")
      .then((Sentry) => {
        if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
          Sentry.captureException(error, {
            contexts: {
              react: { componentStack: errorInfo.componentStack ?? undefined },
            },
          });
        }
      })
      .catch((err) => {
        // A failed Sentry-chunk load must not itself become an unhandled
        // rejection — log and move on.
        console.error("[WidgetErrorBoundary] failed to load Sentry", err);
      });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-widget border border-white/10 bg-surface p-widget text-center">
          <p className="text-sm text-gray-500">
            {this.props.fallbackTitle ?? "Feed unavailable"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="rounded-md bg-white/5 px-3 py-1 text-xs text-gray-400 transition-colors hover:bg-white/10"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
