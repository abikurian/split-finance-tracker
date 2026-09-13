import React, { useState, useEffect } from 'react';
import { X, Scale, Check } from 'lucide-react';
import { type Account } from '../../types';
import { formatCurrency, rupeesToPaise, paiseToRupees } from '../../utils/formatters';
import { LedgerEngine } from '../../lib/ledger/ledgerEngine';

interface AdjustBalanceModalProps {
  isOpen: boolean;
  account: Account | null;
  onClose: () => void;
}

export const AdjustBalanceModal: React.FC<AdjustBalanceModalProps> = ({
  isOpen,
  account,
  onClose,
}) => {
  const [targetBalance, setTargetBalance] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (account) {
      setTargetBalance(String(paiseToRupees(account.balanceInPaise)));
      setNote('');
      setError(null);
    }
  }, [account]);

  if (!isOpen || !account) return null;

  const currentPaise = account.balanceInPaise;
  const targetPaise = rupeesToPaise(parseFloat(targetBalance) || 0);
  const diffPaise = targetPaise - currentPaise;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(parseFloat(targetBalance))) {
      setError('Please enter a valid numeric target balance.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await LedgerEngine.adjustAccountBalance({
        accountId: account.id,
        targetBalanceInPaise: targetPaise,
        date: new Date().toISOString(),
        note: note.trim() || `Manual adjustment to ${formatCurrency(targetPaise)}`,
      });
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-500/10 text-purple-600 rounded-lg">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Adjust Account Balance</h3>
              <p className="text-[10px] text-[var(--text-secondary)]">{account.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-[var(--bg-surface-elevated)] rounded-xl space-y-1 text-xs">
            <div className="flex items-center justify-between text-[var(--text-secondary)]">
              <span>Current Recorded Balance:</span>
              <span className="font-bold text-[var(--text-primary)]">{formatCurrency(currentPaise)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Adjustment Difference:</span>
              <span className={`font-bold ${diffPaise >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {diffPaise >= 0 ? '+' : ''}{formatCurrency(diffPaise)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Actual Current Balance (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--text-secondary)]">₹</span>
              <input
                type="number"
                step="any"
                placeholder="0"
                value={targetBalance}
                onChange={e => setTargetBalance(e.target.value)}
                autoFocus
                required
                className="w-full pl-8 pr-3 py-2.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl text-lg font-bold text-[var(--text-primary)] focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Reason / Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Bank reconciliation, cash recount"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full p-2.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)]"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-semibold rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Save Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
