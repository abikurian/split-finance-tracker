import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Wallet,
  PiggyBank,
  ArrowDownRight,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  Receipt,
  Plus,
  ArrowLeftRight,
  Scale,
} from 'lucide-react';
import { db } from '../db/schema';
import { LedgerEngine } from '../lib/ledger/ledgerEngine';
import { formatCurrency, paiseToRupees } from '../utils/formatters';
import type { Transaction, MonthlyFinancialSummary, Account } from '../types';
import { TransactionDetailModal } from '../components/modals/TransactionDetailModal';
import { AdjustBalanceModal } from '../components/modals/AdjustBalanceModal';

interface HomePageProps {
  selectedMonth: string;
  onNavigate: (tab: string) => void;
  onOpenQuickAdd: (defaultTab?: 'expense' | 'income' | 'transfer' | 'friend') => void;
}

const COLOR_PALETTE = ['#2563eb', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#64748b'];

export const HomePage: React.FC<HomePageProps> = ({
  selectedMonth,
  onNavigate,
  onOpenQuickAdd,
}) => {
  const [summary, setSummary] = useState<MonthlyFinancialSummary | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [adjustingAccount, setAdjustingAccount] = useState<Account | null>(null);

  const accounts = useLiveQuery(() => db.accounts.filter(a => !a.deletedAt).toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);

  const transactions = useLiveQuery(
    () =>
      db.transactions
        .filter(t => !t.deletedAt && t.date.startsWith(selectedMonth))
        .reverse()
        .sortBy('date'),
    [selectedMonth]
  );

  useEffect(() => {
    LedgerEngine.calculateMonthlySummary(selectedMonth).then(setSummary);
  }, [selectedMonth, transactions]);

  // Derived Account Balances
  const primaryAccounts = accounts?.filter(a => a.isPrimarySpending) || [];
  const savingsAccounts = accounts?.filter(a => a.isSavings) || [];

  const availableToSpendInPaise = primaryAccounts.reduce((sum, a) => sum + a.balanceInPaise, 0);
  const totalSavingsInPaise = savingsAccounts.reduce((sum, a) => sum + a.balanceInPaise, 0);
  const totalMoneyInPaise = (accounts || []).reduce((sum, a) => sum + a.balanceInPaise, 0);

  const defaultAccount = primaryAccounts[0] || accounts?.[0] || null;

  // Monthly Spending Breakdown Data
  const categoryExpenses: Record<string, number> = {};
  (transactions || []).forEach((tx) => {
    if (tx.type === 'expense' && tx.categoryId) {
      categoryExpenses[tx.categoryId] = (categoryExpenses[tx.categoryId] || 0) + tx.amountInPaise;
    }
  });

  const categoryData = Object.entries(categoryExpenses)
    .map(([catId, amountPaise]) => {
      const catObj = categories?.find((c) => c.id === catId);
      return {
        name: catObj?.name || 'Other',
        value: paiseToRupees(amountPaise),
        amountPaise,
      };
    })
    .filter((item) => item.value > 0);

  return (
    <div className="space-y-6">
      {/* 1. PRIMARY BALANCE OVERVIEW CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Available To Spend Hero */}
        <div className="p-6 bg-[#2A2F4F] text-white rounded-2xl border border-[#3A4068] flex flex-col justify-between min-h-[140px] relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-purple-400" /> Available to Spend
            </span>
            <span className="px-2.5 py-0.5 bg-[#3D4470] text-white rounded-md text-[10px] font-bold">
              Primary Account
            </span>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-extrabold tracking-tight mt-2 text-white">
              {formatCurrency(availableToSpendInPaise)}
            </div>
            <div className="text-xs text-slate-300 mt-1">
              {primaryAccounts.map(a => `${a.name}: ${formatCurrency(a.balanceInPaise)}`).join(' · ') || 'No primary account'}
            </div>
          </div>
        </div>

        {/* Savings Card */}
        <div className="p-6 bg-white border border-[#E2E8F0] rounded-2xl flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <PiggyBank className="w-4 h-4 text-emerald-600" /> Savings
            </span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              Slice Savings
            </span>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-extrabold text-[#1E293B] mt-2">
              {formatCurrency(totalSavingsInPaise)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Total Wealth: {formatCurrency(totalMoneyInPaise)}
            </div>
          </div>
        </div>
      </div>

      {/* 2. SPENDING BY CATEGORY CHART */}
      <div className="p-5 bg-white border border-[#E2E8F0] rounded-2xl space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Spending by Category ({selectedMonth})
          </h2>
          {categoryData.length > 0 && (
            <button
              onClick={() => onNavigate('insights')}
              className="text-xs text-purple-600 font-semibold hover:underline cursor-pointer"
            >
              Detailed Insights →
            </button>
          )}
        </div>

        {categoryData.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="h-44 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLOR_PALETTE[index % COLOR_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [`₹${Number(value || 0).toFixed(2)}`, 'Spent']} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5 text-xs">
              {categoryData.slice(0, 4).map((cat, idx) => (
                <div key={cat.name} className="flex items-center justify-between p-2 rounded-xl bg-[#F8FAFC]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: COLOR_PALETTE[idx % COLOR_PALETTE.length] }}
                    />
                    <span className="font-semibold text-[#1E293B] truncate">{cat.name}</span>
                  </div>
                  <span className="font-bold text-[#1E293B] shrink-0 ml-2">
                    {formatCurrency(cat.amountPaise)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-400 italic">
            No expenses recorded for {selectedMonth}.
          </div>
        )}
      </div>

      {/* 2. PROMINENT QUICK-ACTIONS ROW */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
          Quick Actions
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Add Income / Money In */}
          <button
            onClick={() => onOpenQuickAdd('income')}
            className="p-4 bg-white border border-[#E2E8F0] hover:border-emerald-500 rounded-2xl flex items-center gap-3 transition-all text-left shadow-xs group"
          >
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl group-hover:scale-105 transition-transform">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#1E293B]">Add Income</div>
              <div className="text-[10px] text-slate-500">Money received</div>
            </div>
          </button>

          {/* Add Expense */}
          <button
            onClick={() => onOpenQuickAdd('expense')}
            className="p-4 bg-white border border-[#E2E8F0] hover:border-red-500 rounded-2xl flex items-center gap-3 transition-all text-left shadow-xs group"
          >
            <div className="p-2.5 bg-red-500/10 text-red-500 rounded-xl group-hover:scale-105 transition-transform">
              <ArrowDownRight className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#1E293B]">Add Expense</div>
              <div className="text-[10px] text-slate-500">Record spending</div>
            </div>
          </button>

          {/* Transfer */}
          <button
            onClick={() => onOpenQuickAdd('transfer')}
            className="p-4 bg-white border border-[#E2E8F0] hover:border-blue-600 rounded-2xl flex items-center gap-3 transition-all text-left shadow-xs group"
          >
            <div className="p-2.5 bg-blue-600/10 text-blue-600 rounded-xl group-hover:scale-105 transition-transform">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#1E293B]">Transfer</div>
              <div className="text-[10px] text-slate-500">Between accounts</div>
            </div>
          </button>

          {/* Adjust Balance */}
          <button
            onClick={() => setAdjustingAccount(defaultAccount)}
            className="p-4 bg-white border border-[#E2E8F0] hover:border-purple-600 rounded-2xl flex items-center gap-3 transition-all text-left shadow-xs group"
          >
            <div className="p-2.5 bg-purple-500/10 text-purple-600 rounded-xl group-hover:scale-105 transition-transform">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#1E293B]">Adjust Balance</div>
              <div className="text-[10px] text-slate-500">Fix discrepancy</div>
            </div>
          </button>
        </div>
      </div>

      {/* 3. THIS MONTH OVERVIEW STATS */}
      <div className="p-5 bg-white border border-[#E2E8F0] rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            This Month Overview ({selectedMonth})
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3.5 bg-[#F8FAFC] rounded-xl space-y-0.5">
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 font-medium">
              <TrendingDown className="w-3.5 h-3.5 text-red-500" /> Spent
            </div>
            <div className="text-lg font-extrabold text-red-500">
              {formatCurrency(summary?.totalExpensesInPaise || 0)}
            </div>
          </div>

          <div className="p-3.5 bg-[#F8FAFC] rounded-xl space-y-0.5">
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 font-medium">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Money In
            </div>
            <div className="text-lg font-extrabold text-emerald-600">
              {formatCurrency(summary?.totalIncomeInPaise || 0)}
            </div>
          </div>

          <div className="p-3.5 bg-[#F8FAFC] rounded-xl space-y-0.5">
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 font-medium">
              <PiggyBank className="w-3.5 h-3.5 text-purple-600" /> Saved / Moved
            </div>
            <div className="text-lg font-extrabold text-[#1E293B]">
              {formatCurrency(summary?.totalTransfersInPaise || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* 4. RECENT TRANSACTIONS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recent Activity</h2>
          <button
            onClick={() => onNavigate('transactions')}
            className="text-xs text-purple-600 font-semibold hover:underline"
          >
            See All →
          </button>
        </div>

        {transactions && transactions.length > 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl divide-y divide-[#E2E8F0] overflow-hidden">
            {transactions.slice(0, 5).map(tx => {
              const account = accounts?.find(a => a.id === tx.accountId);
              const category = categories?.find(c => c.id === tx.categoryId);

              const isNegative = tx.type === 'expense' || tx.type === 'lending' || tx.type === 'repayment_paid';

              return (
                <div
                  key={tx.id}
                  onClick={() => setSelectedTx(tx)}
                  className="p-4 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-xl text-xs font-bold ${
                        isNegative ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-600'
                      }`}
                    >
                      {isNegative ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#1E293B]">
                        {tx.note || category?.name || tx.sourceOfIncome || tx.type.replace('_', ' ')}
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span>{new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        <span>·</span>
                        <span>{account?.name || 'Cash'}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`text-xs font-bold ${isNegative ? 'text-[#1E293B]' : 'text-emerald-600'}`}>
                    {isNegative ? '-' : '+'}{formatCurrency(tx.amountInPaise)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center bg-white border border-[#E2E8F0] rounded-2xl space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#1E293B]">Nothing here yet</div>
              <div className="text-xs text-slate-500 max-w-xs mx-auto mt-0.5">
                No transactions recorded for this month. Record your first income or expense to start tracking your finances!
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={() => onOpenQuickAdd('income')}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Income
              </button>
              <button
                onClick={() => onOpenQuickAdd('expense')}
                className="px-3.5 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Expense
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer Modal */}
      {selectedTx && (
        <TransactionDetailModal
          transaction={selectedTx}
          accountName={accounts?.find(a => a.id === selectedTx.accountId)?.name}
          categoryName={categories?.find(c => c.id === selectedTx.categoryId)?.name}
          onClose={() => setSelectedTx(null)}
        />
      )}

      {/* Adjust Balance Modal */}
      <AdjustBalanceModal
        isOpen={!!adjustingAccount}
        account={adjustingAccount}
        onClose={() => setAdjustingAccount(null)}
      />
    </div>
  );
};
