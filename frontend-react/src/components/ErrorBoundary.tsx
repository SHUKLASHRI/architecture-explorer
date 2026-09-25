import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('PyArch Studio Uncaught Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-midnight-950 text-slate-200 flex flex-col items-center justify-center p-8 font-mono">
          <div className="max-w-xl w-full bg-midnight-900 border border-rose-500/40 rounded-xl p-6 shadow-2xl shadow-rose-950/50">
            <div className="flex items-center gap-3 text-rose-400 font-bold text-base mb-3">
              <span className="material-symbols-outlined text-2xl">error</span>
              <span>PyArch Studio Runtime Error</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              An unexpected error occurred during rendering:
            </p>
            <div className="bg-midnight-950 p-3 rounded-lg border border-slate-800 text-rose-300 text-xs overflow-x-auto mb-4">
              {this.state.error?.toString()}
            </div>
            {this.state.errorInfo && (
              <details className="text-[10px] text-slate-500 mb-4">
                <summary className="cursor-pointer hover:text-slate-400 mb-1">Stack Trace</summary>
                <pre className="bg-midnight-950 p-2 rounded max-h-48 overflow-y-auto">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.reload();
              }}
              className="bg-sky-500 hover:bg-sky-400 text-midnight-950 font-bold px-4 py-2 rounded-lg text-xs cursor-pointer transition-all shadow-lg shadow-sky-500/20"
            >
              Reload Studio
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
