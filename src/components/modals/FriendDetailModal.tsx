import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, Check, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { db } from '../../db/schema';
import { LedgerEngine } from '../../lib/ledger/ledgerEngine';
import { formatCurrency, rupeesToPaise } from '../../utils/formatters';
import type { Person } from '../../types';

interface FriendDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  person: Person | null;
}

export const FriendDetailModal: React.FC<FriendDetailModalProps> = ({
  isOpen,
  onClose,
  person,
}) => {
  const [isSettling, setIsSettling] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleAccountId, setSettleAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const accounts = useLiveQuery(() => db.accounts.filter(a => !a.deletedAt).toArray(), []);

  // Fetch debts and transactions for this person
  const personDebts = useLiveQuery(
    () => (person ? db.debts.where('personId').equals(person.id).toArray() : []),
    [person]
  );

  const personTransactions = useLiveQuery(
    () =>
      person
        ? db.transactions
            .filter(t => !t.deletedAt && t.friendId === person.id)
            .reverse()
            .sortBy('date')
        : [],
    [person]
  );

  if (!isOpen || !person) return null;

  const netBalance = person.netBalanceInPaise;
  const isTheyOwe = netBalance > 0;
  const isUserOwes = netBalance < 0;

  const primaryAccount = accounts?.find(a => a.isPrimarySpending) || accounts?.[0];

  const handleOpenSettle = () => {
    setSettleAmount(String(Math.abs(netBalance) / 100));
    setSettleAccountId(primaryAccount?.id || '');
    setError(null);
    setIsSettling(true);
  };

  const handleExecuteSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleAmount) return;

    const amountInPaise = rupeesToPaise(parseFloat(settleAmount));
    if (amountInPaise <= 0) {
      setError('Please enter a valid settlement amount greater than ₹0');
      return;
    }

    const accId = settleAccountId || primaryAccount?.id;
    if (!accId) {
      setError('Please select an account for settlement');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await LedgerEngine.recordRepayment({
        amountInPaise,
        accountId: accId,
        friendId: person.id,
        repaymentDirection: isTheyOwe ? 'received' : 'paid',
        date: new Date().toISOString(),
        note: `Settlement with ${person.name}`,
      });

      setIsSettling(false);
      setSettleAmount('');
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center font-bold text-base">
              {person.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">{person.name}</h2>
              <div className="text-xs font-semibold mt-0.5">
                {netBalance === 0 && <span className="text-[var(--text-tertiary)]">Settled (₹0.00)</span>}
                {isTheyOwe && (
                  <span className="text-emerald-600">
                    Owes you {formatCurrency(netBalance)}
                  </span>
                )}
                {isUserOwes && (
                  <span className="text-red-500">
                    You owe {formatCurrency(Math.abs(netBalance))}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Prominent Settle Up Card */}
          {netBalance !== 0 && !isSettling && (
            <div className="p-4 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-[var(--text-secondary)]">Outstanding Net Balance</div>
                <div className={`text-xl font-extrabold mt-0.5 ${isTheyOwe ? 'text-emerald-600' : 'text-red-500'}`}>
                  {isTheyOwe ? `Owes you ${formatCurrency(netBalance)}` : `You owe ${formatCurrency(Math.abs(netBalance))}`}
                </div>
              </div>

              <button
                onClick={handleOpenSettle}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-xs transition-colors ${
                  isTheyOwe ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Settle Up
              </button>
            </div>
          )}

          {/* Settlement Input Form */}
          {isSettling && (
            <form onSubmit={handleExecuteSettle} className="p-4 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Record Settlement with {person.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsSettling(false)}
                  className="text-xs text-[var(--text-tertiary)] hover:underline"
                >
                  Cancel
                </button>
              </div>

              {error && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Settlement Amount (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="0"
                  value={settleAmount}
                  onChange={e => setSettleAmount(e.target.value)}
                  autoFocus
                  required
                  className="w-full p-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl text-base font-bold text-[var(--text-primary)] focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  {isTheyOwe ? 'Deposit Into Account' : 'Deduct From Account'}
                </label>
                <select
                  value={settleAccountId}
                  onChange={e => setSettleAccountId(e.target.value)}
                  className="w-full p-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)]"
                >
                  {accounts?.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatCurrency(a.balanceInPaise)})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> Confirm & Record Settlement
              </button>
            </form>
          )}

          {/* Activity / Debt History */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Transaction History
            </h3>

            {personDebts && personDebts.length > 0 ? (
              <div className="space-y-2">
                {personDebts.map(debt => {
                  const isReceivable = debt.type === 'they_owe_me';
                  const outstandingPaise = debt.amountInPaise - debt.settledAmountInPaise;

                  return (
                    <div
                      key={debt.id}
                      className="p-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-2 rounded-lg text-xs ${
                            isReceivable ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'
                          }`}
                        >
                          {isReceivable ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="font-bold text-[var(--text-primary)]">
                            {debt.note || (isReceivable ? 'Lent / Split Share' : 'Borrowed / Split Share')}
                          </div>
                          <div className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1 mt-0.5">
                            <span>Status: <strong className="uppercase">{debt.status}</strong></span>
                            {debt.settledAmountInPaise > 0 && (
                              <span>· Settled: {formatCurrency(debt.settledAmountInPaise)}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={`font-extrabold ${isReceivable ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isReceivable ? '+' : '-'}{formatCurrency(outstandingPaise)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : personTransactions && personTransactions.length > 0 ? (
              <div className="space-y-2">
                {personTransactions.map(tx => (
                  <div
                    key={tx.id}
                    className="p-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-[var(--text-primary)]">
                        {tx.note || tx.type.replace('_', ' ')}
                      </div>
                      <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                        {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    <div className="font-bold text-[var(--text-primary)]">
                      {formatCurrency(tx.amountInPaise)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-[var(--text-tertiary)] italic bg-[var(--bg-surface-elevated)] rounded-xl">
                No past transactions or active debt records with {person.name}.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
