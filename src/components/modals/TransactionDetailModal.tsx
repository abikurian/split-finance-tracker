import React, { useState } from 'react';
import { X, Trash2, Calendar, Tag, CreditCard, User, AlertTriangle } from 'lucide-react';
import { type Transaction } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { LedgerEngine } from '../../lib/ledger/ledgerEngine';

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  accountName?: string;
  categoryName?: string;
  personName?: string;
  onClose: () => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  accountName,
  categoryName,
  personName,
  onClose,
}) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!transaction) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await LedgerEngine.deleteTransaction(transaction.id);
      onClose();
    } catch (err: unknown) {
      alert(`Deletion error: ${(err as Error).message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const getLabelAndColor = () => {
    switch (transaction.type) {
      case 'expense':
        return { label: 'Expense', color: 'text-red-500 bg-red-500/10' };
      case 'income':
        return { label: 'Money In', color: 'text-emerald-500 bg-emerald-500/10' };
      case 'transfer':
      case 'savings_withdrawal':
        return { label: 'Transfer', color: 'text-blue-500 bg-blue-500/10' };
      case 'lending':
        return { label: 'Lent Money', color: 'text-amber-500 bg-amber-500/10' };
      case 'borrowing':
        return { label: 'Borrowed Money', color: 'text-indigo-500 bg-indigo-500/10' };
      case 'repayment_received':
        return { label: 'Repayment Received', color: 'text-teal-500 bg-teal-500/10' };
      case 'repayment_paid':
        return { label: 'Repayment Paid', color: 'text-purple-500 bg-purple-500/10' };
      case 'split_bill':
        return { label: 'Split Bill', color: 'text-purple-500 bg-purple-500/10' };
      default:
        return { label: transaction.type, color: 'text-gray-500 bg-gray-500/10' };
    }
  };

  const badge = getLabelAndColor();
  const dateFormatted = new Date(transaction.date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
            {badge.label}
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 text-center space-y-1 border-b border-[var(--border-subtle)]">
          <div className="text-3xl font-extrabold text-[var(--text-primary)]">
            {formatCurrency(transaction.amountInPaise)}
          </div>
          {transaction.note && (
            <p className="text-xs text-[var(--text-secondary)] font-medium">"{transaction.note}"</p>
          )}
        </div>

        <div className="p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between py-1">
            <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Date
            </span>
            <span className="font-medium text-[var(--text-primary)]">{dateFormatted}</span>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Account
            </span>
            <span className="font-medium text-[var(--text-primary)]">{accountName || 'N/A'}</span>
          </div>

          {categoryName && (
            <div className="flex items-center justify-between py-1">
              <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Category
              </span>
              <span className="font-medium text-[var(--text-primary)]">{categoryName}</span>
            </div>
          )}

          {personName && (
            <div className="flex items-center justify-between py-1">
              <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Person
              </span>
              <span className="font-medium text-[var(--text-primary)]">{personName}</span>
            </div>
          )}

          <div className="flex items-center justify-between py-1 text-[var(--text-tertiary)] font-mono text-[10px]">
            <span>Operation ID</span>
            <span>{transaction.operationId.slice(0, 8)}...</span>
          </div>
        </div>

        {/* Delete Reversal Action */}
        <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
          {isConfirmingDelete ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                This will safely reverse account & friend balances. Continue?
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsConfirmingDelete(false)}
                  className="py-2 text-xs font-semibold rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="py-2 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-xs"
                >
                  {isDeleting ? 'Reversing...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsConfirmingDelete(true)}
              className="w-full py-2.5 text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Delete & Reverse Transaction
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
