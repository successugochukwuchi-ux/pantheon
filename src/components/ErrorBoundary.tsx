import * as React from 'react';
import { AlertTriangle, RefreshCw, Home, WifiOff } from 'lucide-react';
import {
  canAttemptChunkReload,
  isChunkLoadError,
  triggerChunkRecoveryReload,
} from '../lib/chunkRecovery';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  isChunkIssue: boolean;
  isAutoReloading: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      isChunkIssue: false,
      isAutoReloading: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    const chunkIssue = isChunkLoadError(error);
    const shouldAutoReload = chunkIssue && canAttemptChunkReload();
    return {
      hasError: true,
      isChunkIssue: chunkIssue,
      isAutoReloading: shouldAutoReload,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[COLEARN] Uncaught ErrorBoundary error:", error, errorInfo);

    if (this.state.isAutoReloading) {
      triggerChunkRecoveryReload(true);
    }
  }

  private handleReload = () => {
    triggerChunkRecoveryReload(this.state.isChunkIssue);
  };

  private handleGoHome = () => {
    window.location.replace('/');
  };

  render() {
    if (this.state.hasError) {
      if (this.state.isAutoReloading) {
        return (
          <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-6">
            <div className="max-w-sm w-full bg-stone-900 border border-stone-800 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
              <div className="space-y-1">
                <h1 className="text-lg font-bold tracking-tight">Updating CoLearn...</h1>
                <p className="text-xs text-stone-400">
                  Loading the latest version of this page.
                </p>
              </div>
            </div>
          </div>
        );
      }

      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

      const title = isOffline
        ? "You're currently offline"
        : this.state.isChunkIssue
          ? 'Page needs a quick refresh'
          : 'This page ran into a hiccup';

      const description = isOffline
        ? 'Please check your internet connection and tap Refresh Page to continue studying.'
        : this.state.isChunkIssue
          ? 'A newer version of CoLearn is available or your connection dropped briefly while loading this page. Refreshing will load the latest version.'
          : 'Something interrupted this view unexpectedly. Refreshing the page or returning home usually gets everything working again.';

      return (
        <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-stone-900 border border-stone-800 rounded-2xl p-8 space-y-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 shrink-0">
                {isOffline ? (
                  <WifiOff className="h-7 w-7" />
                ) : (
                  <AlertTriangle className="h-7 w-7" />
                )}
              </div>
              <div className="space-y-1.5">
                <h1 className="text-xl font-bold tracking-tight text-stone-100">{title}</h1>
                <p className="text-sm text-stone-400 leading-relaxed">{description}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm transition-all shadow-md cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl font-medium text-sm transition-all cursor-pointer"
              >
                <Home className="h-4 w-4" />
                Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
