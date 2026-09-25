import React, { useState, useEffect } from 'react';
import { useExplorer } from '../context/ExplorerContext';
import { X, Edit3, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import * as api from '../api/client';
import type { RenamePlan } from '../types';

export const SafeRenameModal: React.FC = () => {
  const {
    renameModalNode,
    closeRenameModal,
    projectPath,
    handleRenameSuccess,
  } = useExplorer();

  const [newName, setNewName] = useState('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [plan, setPlan] = useState<RenamePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (renameModalNode) {
      setNewName(`${renameModalNode.name}_renamed`);
      setPlan(null);
      setError(null);
      setSuccessMessage(null);
    }
  }, [renameModalNode]);

  if (!renameModalNode) return null;

  const handlePreview = async () => {
    if (!newName.trim()) {
      setError('Please provide a new symbol name');
      return;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newName)) {
      setError('Name must be a valid Python identifier (letters, digits, underscores)');
      return;
    }
    if (newName === renameModalNode.name) {
      setError('New name must be different from original name');
      return;
    }

    setIsPreviewing(true);
    setError(null);
    try {
      const res = await api.previewRename(projectPath, renameModalNode.id, newName);
      if (!res.ok) {
        setError(res.error || 'Failed to plan rename');
      } else {
        setPlan(res);
      }
    } catch (err: any) {
      setError(err.message || 'Error generating rename preview');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleApply = async () => {
    if (!plan) return;
    setIsApplying(true);
    setError(null);
    try {
      const res = await api.applyRename(projectPath, renameModalNode.id, newName);
      if (!res.success) {
        setError(res.error || 'Failed to execute refactor');
      } else {
        setSuccessMessage(
          `Successfully refactored ${plan.substitutions.length} references across ${res.files_modified.length} files.`
        );
        setTimeout(() => {
          handleRenameSuccess(res);
        }, 1200);
      }
    } catch (err: any) {
      setError(err.message || 'Error executing refactor rename');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={closeRenameModal}
    >
      <div
        className="w-[580px] max-w-[92vw] max-h-[85vh] bg-[#121216] border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden font-sans select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Edit3 size={15} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Safe AST Rename Refactor
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono">
                Symbol: <strong className="text-zinc-200">{renameModalNode.name}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={closeRenameModal}
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 code-scroll">
          {/* New Name Input Row */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5 font-mono">
              New Identifier Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setPlan(null);
                }}
                placeholder="e.g. generate_auth_token"
                className="flex-1 bg-[#16161c] border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
              />
              <button
                onClick={handlePreview}
                disabled={isPreviewing}
                className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 rounded-lg text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isPreviewing && <Loader2 size={13} className="animate-spin" />}
                <span>Preview</span>
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs">
              <AlertTriangle size={15} className="text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs">
              <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Diff Preview List */}
          {plan && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400 font-semibold">
                  Planned Substitutions ({plan.substitutions.length})
                </span>
                <span className="text-[10px] text-zinc-500">
                  {new Set(plan.substitutions.map((s) => s.file)).size} files affected
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto code-scroll">
                {plan.substitutions.map((sub, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg bg-[#0e0e12] border border-zinc-800/80 font-mono text-[11px] space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-zinc-500 text-[10px]">
                      <span className="text-zinc-400 truncate">{sub.file}</span>
                      <span>Line {sub.line}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="p-1 rounded bg-rose-950/30 text-rose-300/90 border border-rose-900/30 overflow-x-auto truncate">
                        - {sub.old}
                      </div>
                      <div className="p-1 rounded bg-emerald-950/30 text-emerald-300/90 border border-emerald-900/30 overflow-x-auto truncate">
                        + {sub.new}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-[#0e0e11] flex items-center justify-between">
          <button
            onClick={closeRenameModal}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleApply}
            disabled={!plan || isApplying}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              plan && !isApplying
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            {isApplying && <Loader2 size={13} className="animate-spin" />}
            <span>Apply Refactor ({plan ? plan.substitutions.length : 0})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
