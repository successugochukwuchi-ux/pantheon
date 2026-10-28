import * as React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[COLEARN] Uncaught ErrorBoundary error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-stone-900 border border-stone-800 rounded-2xl p-8 space-y-6 shadow-2xl">
            <div className="flex items-center gap-4 text-amber-500">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Something went wrong</h1>
                <p className="text-xs text-stone-400">CoLearn encountered an unexpected application issue.</p>
              </div>
            </div>

            {this.state.error && (
              <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-4 font-mono text-xs text-red-400 overflow-x-auto max-h-40">
                <p className="font-semibold text-red-300 mb-1">{this.state.error.toString()}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-[10px] text-stone-500 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm transition-all shadow-md"
              >
                <RefreshCw className="h-4 w-4" />
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl font-medium text-sm transition-all"
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
