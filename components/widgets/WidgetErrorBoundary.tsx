"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
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

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[120px] items-center justify-center rounded-widget border border-white/10 bg-surface p-widget text-center">
          <p className="text-sm text-gray-500">
            {this.props.fallbackTitle ?? "Feed unavailable"}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
