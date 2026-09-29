import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import type { ToastNotification } from '../types';

interface ToastContainerProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-8 right-4 z-50 flex flex-col gap-2 pointer-events-none select-none max-w-sm w-full">
      {toasts.map((toast) => {
        const icon =
          toast.type === 'error' ? (
            <AlertCircle size={16} className="text-[#f14c4c] flex-shrink-0" />
          ) : toast.type === 'warning' ? (
            <AlertTriangle size={16} className="text-[#cca700] flex-shrink-0" />
          ) : toast.type === 'success' ? (
            <CheckCircle2 size={16} className="text-[#4ec9b0] flex-shrink-0" />
          ) : (
            <Info size={16} className="text-[#007acc] flex-shrink-0" />
          );

        return (
          <div
            key={toast.id}
            className="pointer-events-auto bg-[#252526] border border-[#3e3e42] rounded-[3px] shadow-2xl p-2.5 flex items-center justify-between gap-2.5 text-xs text-[#cccccc] font-sans animate-in slide-in-from-bottom-2 fade-in duration-200"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {icon}
              <span className="truncate text-[11px] leading-tight text-[#e0e0e0]">
                {toast.message}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {toast.actionLabel && toast.onAction && (
                <button
                  onClick={() => {
                    toast.onAction!();
                    onDismiss(toast.id);
                  }}
                  className="px-2 py-0.5 bg-[#007acc] hover:bg-[#0098ff] text-white rounded-[2px] text-[11px] font-medium transition-colors"
                >
                  {toast.actionLabel}
                </button>
              )}
              <button
                onClick={() => onDismiss(toast.id)}
                className="text-[#858585] hover:text-[#cccccc] p-1 rounded-[2px] transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
