import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Landmark, PiggyBank, Plus, ArrowLeftRight, Scale, ArrowUpRight } from 'lucide-react';
import { db } from '../db/schema';
import { formatCurrency, rupeesToPaise } from '../utils/formatters';
import { v4 as uuidv4 } from 'uuid';
import type { Account, AccountType } from '../types';
import { AdjustBalanceModal } from '../components/modals/AdjustBalanceModal';
import { QuickAddModal } from '../components/modals/QuickAddModal';

import { pushAccountToSupabase } from '../lib/supabaseSync';

interface AccountsPageProps {
  onOpenQuickAdd: (defaultTab?: 'expense' | 'income' | 'transfer' | 'friend') => void;
}

export const AccountsPage: React.FC<AccountsPageProps> = ({ onOpenQuickAdd }) => {
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [adjustingAccount, setAdjustingAccount] = useState<Account | null>(null);
  const [quickAddAccount, setQuickAddAccount] = useState<Account | null>(null);

  // New Account form state
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [balance, setBalance] = useState('');
  const [isPrimarySpending, setIsPrimarySpending] = useState(true);
  const [isSavings, setIsSavings] = useState(false);

  const accounts = useLiveQuery(() => db.accounts.filter(a => !a.deletedAt).toArray(), []);

  const primaryAccounts = accounts?.filter(a => a.isPrimarySpending) || [];
  const savingsAccounts = accounts?.filter(a => a.isSavings) || [];

  const availableToSpendInPaise = primaryAccounts.reduce((sum, a) => sum + a.balanceInPaise, 0);
  const totalSavingsInPaise = savingsAccounts.reduce((sum, a) => sum + a.balanceInPaise, 0);
  const totalMoneyInPaise = (accounts || []).reduce((sum, a) => sum + a.balanceInPaise, 0);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !balance) return;

    const initialBalanceInPaise = rupeesToPaise(parseFloat(balance));
    const now = new Date().toISOString();

    const newAccount: Account = {
      id: uuidv4(),
      name: name.trim(),
      type,
      balanceInPaise: initialBalanceInPaise,
      currency: 'INR',
      icon: type === 'savings' ? 'PiggyBank' : 'Landmark',
      isPrimarySpending,
      isSavings,
      syncStatus: 'synced',
      createdAt: now,
      updatedAt: now,
    };

    await db.accounts.add(newAccount);
    pushAccountToSupabase(newAccount).catch(console.error);

    setName('');
    setBalance('');
    setIsAddAccountOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--text-primary)]">Accounts & Savings</h1>
          <p className="text-xs text-[var(--text-secondary)]">Manage accounts, add money, and adjust total balances</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenQuickAdd('transfer')}
            className="py-2.5 px-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-purple-600 text-[var(--text-primary)] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4 text-purple-600" /> Self Transfer
          </button>
          <button
            onClick={() => setIsAddAccountOpen(true)}
            className="py-2.5 px-4 bg-[#2A2F4F] hover:bg-[#1E2238] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" /> Add Account
          </button>
        </div>
      </div>

      {/* Balance Summary Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-5 bg-[#2A2F4F] text-white rounded-2xl border border-[#3A4068]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">Available Spending</span>
          <div className="text-2xl font-extrabold mt-1 text-white">{formatCurrency(availableToSpendInPaise)}</div>
        </div>

        <div className="p-5 bg-white border border-[#E2E8F0] rounded-2xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Savings</span>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">{formatCurrency(totalSavingsInPaise)}</div>
        </div>

        <div className="p-5 bg-white border border-[#E2E8F0] rounded-2xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Net Wealth</span>
          <div className="text-2xl font-extrabold text-[#1E293B] mt-1">{formatCurrency(totalMoneyInPaise)}</div>
        </div>
      </div>

      {/* Account Directory Cards */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Your Accounts</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {accounts?.map(acc => (
            <div
              key={acc.id}
              className="p-5 bg-white border border-[#E2E8F0] rounded-2xl space-y-4 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${acc.isSavings ? 'bg-emerald-500/10 text-emerald-600' : 'bg-purple-500/10 text-purple-600'}`}>
                    {acc.isSavings ? <PiggyBank className="w-5 h-5" /> : <Landmark className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#1E293B]">{acc.name}</h3>
                    <span className="text-[10px] text-slate-500 capitalize">{acc.type} account</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {acc.isPrimarySpending && (
                    <span className="px-2.5 py-0.5 bg-blue-500/10 text-blue-600 text-[10px] font-bold rounded-md">
                      Primary
                    </span>
                  )}
                  {acc.isSavings && (
                    <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 text-[10px] font-bold rounded-md">
                      Savings
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-baseline justify-between pt-2 border-t border-[#E2E8F0]">
                <span className="text-xs text-slate-500 font-medium">Recorded Balance:</span>
                <span className="text-xl font-extrabold text-[#1E293B]">
                  {formatCurrency(acc.balanceInPaise)}
                </span>
              </div>

              {/* Action Buttons for this specific account */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E2E8F0]">
                <button
                  onClick={() => setQuickAddAccount(acc)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-[#1E293B] rounded-xl text-xs font-semibold transition-colors"
                >
                  <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                  Add Money
                </button>

                <button
                  onClick={() => setAdjustingAccount(acc)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-[#1E293B] rounded-xl text-xs font-semibold transition-colors"
                >
                  <Scale className="w-4 h-4 text-purple-600" />
                  Adjust Balance
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Account Modal */}
      {isAddAccountOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm bg-white border border-[#E2E8F0] rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-[#1E293B]">Add New Account</h3>
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Account Name</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank, Pocket Cash"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="w-full p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-medium text-[#1E293B] focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Account Type</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as AccountType)}
                  className="w-full p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#1E293B]"
                >
                  <option value="bank">Bank Account</option>
                  <option value="savings">Savings Account</option>
                  <option value="cash">Cash</option>
                  <option value="wallet">Wallet</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Initial Balance (₹)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0"
                  value={balance}
                  onChange={e => setBalance(e.target.value)}
                  required
                  className="w-full p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#1E293B] focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-500">
                  <input
                    type="checkbox"
                    checked={isPrimarySpending}
                    onChange={e => setIsPrimarySpending(e.target.checked)}
                    className="rounded border-slate-300 text-purple-600"
                  />
                  Set as Primary Spending Account
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-500">
                  <input
                    type="checkbox"
                    checked={isSavings}
                    onChange={e => setIsSavings(e.target.checked)}
                    className="rounded border-slate-300 text-purple-600"
                  />
                  Mark as Savings Account
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddAccountOpen(false)}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl border border-[#E2E8F0] text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-[#2A2F4F] text-white transition-colors"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Balance Modal */}
      <AdjustBalanceModal
        isOpen={!!adjustingAccount}
        account={adjustingAccount}
        onClose={() => setAdjustingAccount(null)}
      />

      {/* Quick Add Modal */}
      <QuickAddModal
        isOpen={!!quickAddAccount}
        onClose={() => setQuickAddAccount(null)}
        defaultTab="income"
        preselectedAccountId={quickAddAccount?.id}
      />
    </div>
  );
};
