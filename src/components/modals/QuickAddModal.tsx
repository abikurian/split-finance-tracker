import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, ArrowDownRight, ArrowUpRight, ArrowLeftRight, Users, Check, AlertCircle } from 'lucide-react';
import { db } from '../../db/schema';
import { LedgerEngine } from '../../lib/ledger/ledgerEngine';
import { rupeesToPaise, formatCurrency } from '../../utils/formatters';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'expense' | 'income' | 'transfer' | 'friend';
  preselectedAccountId?: string;
  isFriendContextOnly?: boolean;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'expense',
  preselectedAccountId,
  isFriendContextOnly = false,
}) => {
  const [activeTab, setActiveTab] = useState<'expense' | 'income' | 'transfer' | 'friend'>(
    isFriendContextOnly ? 'friend' : defaultTab
  );
  const [friendSubTab, setFriendSubTab] = useState<'lent' | 'borrowed' | 'repayment'>('lent');

  useEffect(() => {
    if (isOpen && isFriendContextOnly) {
      setActiveTab('friend');
    }
  }, [isOpen, isFriendContextOnly]);

  // Form states
  const [amount, setAmount] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [destinationAccountId, setDestinationAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [sourceOfIncome, setSourceOfIncome] = useState<string>('Parents / Family');
  const [friendId, setFriendId] = useState<string>('');
  const [repaymentDirection, setRepaymentDirection] = useState<'received' | 'paid'>('received');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState<string>('');
  const [isSavingsWithdrawal, setIsSavingsWithdrawal] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Database queries
  const accounts = useLiveQuery(() => db.accounts.filter(a => !a.deletedAt).toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const people = useLiveQuery(() => db.people.filter(p => !p.deletedAt).toArray(), []);

  useEffect(() => {
    if (preselectedAccountId && isOpen) {
      setAccountId(preselectedAccountId);
    }
  }, [preselectedAccountId, isOpen]);

  // Set default account when accounts load
  useEffect(() => {
    if (accounts && accounts.length > 0 && !accountId && !preselectedAccountId) {
      const primary = accounts.find(a => a.isPrimarySpending) || accounts[0];
      setAccountId(primary.id);
      const savings = accounts.find(a => a.isSavings && a.id !== primary.id) || accounts[1];
      if (savings) setDestinationAccountId(savings.id);
    }
  }, [accounts, accountId, preselectedAccountId]);

  // Set default category
  useEffect(() => {
    if (categories && categories.length > 0 && !categoryId) {
      const foodCat = categories.find(c => c.id === 'cat-food') || categories[0];
      setCategoryId(foodCat.id);
    }
  }, [categories, categoryId]);

  // Set default friend selection
  useEffect(() => {
    if (people && people.length > 0 && !friendId) {
      setFriendId(people[0].id);
    }
  }, [people, friendId]);

  if (!isOpen) return null;

  const resetForm = () => {
    setAmount('');
    setNote('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const parsePaise = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return 0;
    return rupeesToPaise(num);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountInPaise = parsePaise(amount);
    if (amountInPaise <= 0) {
      setError('Please enter a valid amount greater than ₹0');
      return;
    }

    setIsSubmitting(true);

    try {
      const isoDate = new Date(date).toISOString();

      if (activeTab === 'expense') {
        if (!accountId) throw new Error('Please select an account');
        await LedgerEngine.recordExpense({
          amountInPaise,
          accountId,
          categoryId,
          date: isoDate,
          note,
        });
      } else if (activeTab === 'income') {
        if (!accountId) throw new Error('Please select an account');
        await LedgerEngine.recordIncome({
          amountInPaise,
          accountId,
          sourceOfIncome,
          date: isoDate,
          note,
        });
      } else if (activeTab === 'transfer') {
        if (!accountId || !destinationAccountId) throw new Error('Please select source & destination accounts');
        if (accountId === destinationAccountId) throw new Error('Source and destination accounts must be different');
        await LedgerEngine.recordTransfer({
          amountInPaise,
          sourceAccountId: accountId,
          destinationAccountId,
          isSavingsWithdrawal,
          date: isoDate,
          note,
        });
      } else if (activeTab === 'friend') {
        if (!friendId) throw new Error('Please select a friend first');
        if (!accountId) throw new Error('Please select an account');

        if (friendSubTab === 'lent') {
          await LedgerEngine.recordLending({
            amountInPaise,
            accountId,
            friendId,
            date: isoDate,
            note,
          });
        } else if (friendSubTab === 'borrowed') {
          await LedgerEngine.recordBorrowing({
            amountInPaise,
            accountId,
            friendId,
            date: isoDate,
            note,
          });
        } else if (friendSubTab === 'repayment') {
          await LedgerEngine.recordRepayment({
            amountInPaise,
            accountId,
            friendId,
            repaymentDirection,
            date: isoDate,
            note,
          });
        }
      }

      handleClose();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Quick Record</h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Primary Flow Selector */}
        {!isFriendContextOnly && (
          <div className="grid grid-cols-4 p-2 gap-1 bg-[var(--bg-surface-elevated)] mx-4 mt-4 rounded-xl text-xs font-medium">
            <button
              type="button"
              onClick={() => { setActiveTab('expense'); setError(null); }}
              className={`py-2 rounded-lg flex items-center justify-center gap-1 transition-colors ${
                activeTab === 'expense'
                  ? 'bg-red-500/10 text-red-500 font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5" />
              Expense
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('income'); setError(null); }}
              className={`py-2 rounded-lg flex items-center justify-center gap-1 transition-colors ${
                activeTab === 'income'
                  ? 'bg-emerald-500/10 text-emerald-600 font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Money In
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('transfer'); setError(null); }}
              className={`py-2 rounded-lg flex items-center justify-center gap-1 transition-colors ${
                activeTab === 'transfer'
                  ? 'bg-blue-600/10 text-blue-600 font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Transfer
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('friend'); setError(null); }}
              className={`py-2 rounded-lg flex items-center justify-center gap-1 transition-colors ${
                activeTab === 'friend'
                  ? 'bg-purple-500/10 text-purple-600 font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Friend/Debt
            </button>
          </div>
        )}

        {/* Friend Sub-Flow Selector - Strictly 3 Actions */}
        {activeTab === 'friend' && (
          <div className="grid grid-cols-3 px-4 pt-3 gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setFriendSubTab('lent')}
              className={`py-2 rounded-lg border text-center font-medium transition-colors ${
                friendSubTab === 'lent'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-600 font-bold'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              I Lent Money
            </button>
            <button
              type="button"
              onClick={() => setFriendSubTab('borrowed')}
              className={`py-2 rounded-lg border text-center font-medium transition-colors ${
                friendSubTab === 'borrowed'
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 font-bold'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              I Borrowed Money
            </button>
            <button
              type="button"
              onClick={() => setFriendSubTab('repayment')}
              className={`py-2 rounded-lg border text-center font-medium transition-colors ${
                friendSubTab === 'repayment'
                  ? 'border-teal-500 bg-teal-500/10 text-teal-600 font-bold'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Record Repayment
            </button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Amount Field */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-[var(--text-secondary)]">₹</span>
              <input
                type="number"
                step="any"
                placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                autoFocus
                required
                className="w-full pl-8 pr-4 py-3 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl text-2xl font-bold text-[var(--text-primary)] focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* EXPENSE FLOW */}
          {activeTab === 'expense' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className="w-full p-2.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)]"
                >
                  {categories?.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Paid From Account
                </label>
                <select
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  className="w-full p-2.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)]"
                >
                  {accounts?.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatCurrency(a.balanceInPaise)})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* INCOME FLOW */}
          {activeTab === 'income' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Source of Money
                </label>
                <select
                  value={sourceOfIncome}
                  onChange={e => setSourceOfIncome(e.target.value)}
                  className="w-full p-2.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)]"
                >
                  <option value="Parents / Family">Parents / Family</option>
                  <option value="Part-time work">Part-time work</option>
                  <option value="Freelance">Freelance</option>
                  <option value="Salary / Stipend">Salary / Stipend</option>
                  <option value="Gift">Gift</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Deposit Into Account
                </label>
                <select
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  className="w-full p-2.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)]"
                >
                  {accounts?.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatCurrency(a.balanceInPaise)})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* TRANSFER FLOW */}
          {activeTab === 'transfer' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">From Account</label>
                  <select
                    value={accountId}
                    onChange={e => setAccountId(e.target.value)}
                    className="w-full p-2.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)]"
                  >
                    {accounts?.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">To Account</label>
                  <select
                    value={destinationAccountId}
                    onChange={e => setDestinationAccountId(e.target.value)}
                    className="w-full p-2.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)]"
                  >
                    {accounts?.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSavingsWithdrawal}
                  onChange={e => setIsSavingsWithdrawal(e.target.checked)}
                  className="rounded border-[var(--border-subtle)] text-blue-600"
                />
                Mark as Savings Withdrawal
              </label>
            </>
          )}

          {/* FRIEND/DEBT FLOWS */}
          {activeTab === 'friend' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Select Friend
                </label>
                {people && people.length > 0 ? (
                  <select
                    value={friendId}
                    onChange={e => setFriendId(e.target.value)}
                    className="w-full p-2.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)]"
                  >
                    {people.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.netBalanceInPaise !== 0 ? `(${p.netBalanceInPaise > 0 ? 'Owes you' : 'You owe'} ${formatCurrency(Math.abs(p.netBalanceInPaise))})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-medium">
                    No friends added yet. Please add a friend in the Friends tab first.
                  </div>
                )}
              </div>

              {friendSubTab === 'repayment' && (
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Repayment Direction</label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setRepaymentDirection('received')}
                      className={`py-2 rounded-xl border font-medium ${
                        repaymentDirection === 'received'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 font-semibold'
                          : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      Friend Paid Me
                    </button>
                    <button
                      type="button"
                      onClick={() => setRepaymentDirection('paid')}
                      className={`py-2 rounded-xl border font-medium ${
                        repaymentDirection === 'paid'
                          ? 'border-blue-600 bg-blue-600/10 text-blue-600 font-semibold'
                          : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      I Paid Friend
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  {friendSubTab === 'lent' ? 'Deduct From Account (Source)' : friendSubTab === 'borrowed' ? 'Deposit Into Account (Destination)' : 'Account'}
                </label>
                <select
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  className="w-full p-2.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)]"
                >
                  {accounts?.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balanceInPaise)})</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Date & Note Common Fields */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                className="w-full p-2.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Note (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Lunch, taxi fare"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full p-2.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)]"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-3 text-xs font-semibold rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 text-xs font-semibold rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Save Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
