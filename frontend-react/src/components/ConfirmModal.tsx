import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import type { ConfirmDialogOptions } from '../types';

interface ConfirmModalProps {
  options: ConfirmDialogOptions | null;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ options, onClose }) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!options) return;

    // Focus confirm button or cancel button
    confirmBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (options.onCancel) options.onCancel();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        options.onConfirm();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options, onClose]);

  if (!options) return null;

  const {
    title,
    message,
    detail,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false,
    onConfirm,
    onCancel,
  } = options;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/65 z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
      onClick={handleCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-[460px] max-w-[94vw] bg-[#252526] border border-[#3e3e42] rounded-[4px] shadow-2xl overflow-hidden font-sans flex flex-col scale-100 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="h-9 px-3.5 bg-[#2d2d2d] border-b border-[#3e3e42] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isDestructive ? (
              <AlertTriangle size={15} className="text-[#f14c4c]" />
            ) : (
              <Info size={15} className="text-[#007acc]" />
            )}
            <span className="text-xs font-semibold text-[#ffffff]">{title}</span>
          </div>
          <button
            onClick={handleCancel}
            className="text-[#858585] hover:text-[#ffffff] p-1 rounded-[2px] hover:bg-[#383838] transition-colors"
            title="Cancel (Esc)"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-2.5 text-xs text-[#cccccc]">
          <p className="leading-relaxed font-sans">{message}</p>

          {detail && (
            <div className="p-2.5 bg-[#1e1e1e] border border-[#3e3e42] rounded-[3px] font-mono text-[11px] text-[#858585] max-h-36 overflow-y-auto leading-relaxed whitespace-pre-wrap">
              {detail}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="px-4 py-2.5 bg-[#2d2d2d] border-t border-[#3e3e42] flex items-center justify-end gap-2">
          <button
            onClick={handleCancel}
            className="px-3 py-1 bg-[#333333] hover:bg-[#3e3e42] border border-[#3e3e42] rounded-[2px] text-xs font-sans text-[#cccccc] hover:text-[#ffffff] transition-colors"
          >
            {cancelText}
          </button>

          <button
            ref={confirmBtnRef}
            onClick={handleConfirm}
            className={`px-3.5 py-1 rounded-[2px] text-xs font-sans font-medium text-white transition-colors shadow-sm ${
              isDestructive
                ? 'bg-[#c52828] hover:bg-[#e03030]'
                : 'bg-[#007acc] hover:bg-[#0098ff]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
