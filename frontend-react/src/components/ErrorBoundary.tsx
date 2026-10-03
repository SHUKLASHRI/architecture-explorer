import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

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
    console.error('Irminsul IDE UI Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-[#1e1e1e] text-[#cccccc] flex flex-col items-center justify-center p-6 font-sans select-none">
          <div className="max-w-xl w-full bg-[#252526] border border-[#3e3e42] rounded-[3px] p-5 shadow-2xl">
            <div className="flex items-center gap-2.5 text-[#f14c4c] font-semibold text-sm mb-3">
              <AlertCircle size={20} className="text-[#f14c4c]" />
              <span>Workbench Rendering Error</span>
            </div>
            <p className="text-xs text-[#858585] mb-3">
              An unexpected error occurred while rendering the workspace:
            </p>
            <div className="bg-[#1e1e1e] p-3 rounded-[2px] border border-[#3e3e42] text-[#f14c4c] font-mono text-xs overflow-x-auto mb-4 whitespace-pre-wrap">
              {this.state.error?.toString()}
            </div>
            {this.state.errorInfo && (
              <details className="text-[11px] text-[#858585] mb-4 font-mono">
                <summary className="cursor-pointer hover:text-[#cccccc] mb-1">Component Stack</summary>
                <pre className="bg-[#1e1e1e] p-2.5 rounded-[2px] border border-[#3e3e42] max-h-40 overflow-y-auto text-[10px] text-[#858585]">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#3e3e42]">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                  window.location.reload();
                }}
                className="bg-[#007acc] hover:bg-[#0098ff] text-[#ffffff] font-medium px-4 py-1.5 rounded-[2px] text-xs cursor-pointer transition-colors"
              >
                Reload Window
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
