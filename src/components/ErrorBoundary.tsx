"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Compass, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[noirme] Uncaught error in ErrorBoundary:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-zinc-50 text-zinc-900 select-none z-[99999]">
          <div className="w-16 h-16 rounded-full bg-white shadow-xl flex items-center justify-center border border-zinc-150 mb-6">
            <Compass className="w-8 h-8 text-black" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">Something went wrong</h2>
          <p className="text-xs text-zinc-500 mt-2 max-w-xs text-center leading-relaxed">
            An unexpected error occurred. You can reload the app to recover your session.
          </p>
          {this.state.error && (
            <pre className="mt-4 p-3 bg-zinc-100 rounded-xl border border-zinc-200 text-[10px] font-mono max-w-sm overflow-x-auto text-zinc-500">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            className="mt-6 px-5 py-3 rounded-2xl bg-zinc-900 hover:bg-black text-white text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-md cursor-pointer"
          >
            <RefreshCw size={13} /> Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
