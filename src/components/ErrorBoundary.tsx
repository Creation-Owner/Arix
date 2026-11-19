import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Arix UI crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#060E1F] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#0B152B] border border-red-500/40 rounded-xl p-6 space-y-4">
            <h1 className="text-base font-semibold text-red-300">
              Arix encountered a display error
            </h1>
            <p className="text-xs font-mono bg-[#060E1F] border border-slate-800 rounded-lg p-3 text-slate-300 break-words">
              {this.state.error.message || 'Unknown rendering error'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-sky-500 text-slate-950 text-xs font-semibold rounded-lg hover:bg-sky-400 cursor-pointer"
            >
              Reload Arix
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
