import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, ArrowDownRight, ArrowUpRight, Receipt, Plus } from 'lucide-react';
import { db } from '../db/schema';
import { formatCurrency } from '../utils/formatters';
import type { Transaction } from '../types';
import { TransactionDetailModal } from '../components/modals/TransactionDetailModal';
import { type TimeframeMode, formatTimeframeLabel } from '../utils/dateUtils';

interface TransactionsPageProps {
  timeframe: TimeframeMode;
  setTimeframe?: (tf: TimeframeMode) => void;
  selectedDate: string;
  selectedMonth: string;
  selectedYear: string;
  onOpenQuickAdd: () => void;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({
  timeframe,
  setTimeframe,
  selectedDate,
  selectedMonth,
  selectedYear,
  onOpenQuickAdd,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');

  const activeYearStr = selectedDate ? selectedDate.slice(0, 4) : selectedYear;

  // Query transactions based on timeframe
  const transactions = useLiveQuery(
    () =>
      db.transactions
        .filter((t) => {
          if (t.deletedAt) return false;
          if (timeframe === 'day') return t.date.startsWith(selectedDate);
          if (timeframe === 'month') return t.date.startsWith(selectedMonth);
          return t.date.startsWith(activeYearStr);
        })
        .toArray(),
    [timeframe, selectedDate, selectedMonth, selectedYear, activeYearStr]
  );

  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const people = useLiveQuery(() => db.people.toArray(), []);

  // Filter & Search Logic
  const filteredTransactions = (transactions || [])
    .filter((tx) => {
      if (selectedTypeFilter !== 'all') {
        if (selectedTypeFilter === 'expense' && tx.type !== 'expense' && tx.type !== 'split_bill') return false;
        if (selectedTypeFilter === 'income' && tx.type !== 'income') return false;
        if (selectedTypeFilter === 'transfer' && tx.type !== 'transfer' && tx.type !== 'savings_withdrawal') return false;
        if (selectedTypeFilter === 'friend' && !['lending', 'borrowing', 'repayment_received', 'repayment_paid', 'split_bill'].includes(tx.type)) return false;
      }

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const noteMatch = (tx.note || '').toLowerCase().includes(query);
        const category = categories?.find((c) => c.id === tx.categoryId);
        const categoryMatch = (category?.name || '').toLowerCase().includes(query);
        const sourceMatch = (tx.sourceOfIncome || '').toLowerCase().includes(query);
        return noteMatch || categoryMatch || sourceMatch;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortOrder === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortOrder === 'highest') return b.amountInPaise - a.amountInPaise;
      if (sortOrder === 'lowest') return a.amountInPaise - b.amountInPaise;
      return 0;
    });

  // Group transactions depending on timeframe (Daily: single list, Monthly: grouped by day, Yearly: grouped by month)
  const groupedTransactions: Record<string, Transaction[]> = {};

  filteredTransactions.forEach((tx) => {
    let groupKey = '';
    if (timeframe === 'day') {
      groupKey = tx.date.slice(0, 10);
    } else if (timeframe === 'month') {
      groupKey = tx.date.slice(0, 10);
    } else {
      // Yearly: group by YYYY-MM
      groupKey = tx.date.slice(0, 7);
    }

    if (!groupedTransactions[groupKey]) groupedTransactions[groupKey] = [];
    groupedTransactions[groupKey].push(tx);
  });

  const formatDateHeader = (groupKey: string) => {
    if (timeframe === 'year') {
      const [year, month] = groupKey.split('-').map(Number);
      const dateObj = new Date(year, month - 1, 1);
      return dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (groupKey === todayStr) return 'TODAY';
    if (groupKey === yesterdayStr) return 'YESTERDAY';

    return new Date(groupKey).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).toUpperCase();
  };

  const timeframeLabel = formatTimeframeLabel(timeframe, selectedDate, selectedMonth, selectedYear);

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--text-primary)]">Transactions</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Chronological ledger view for {timeframeLabel}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Timeframe Selector Pills */}
          <div className="flex bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-1 text-xs font-semibold shadow-xs shrink-0">
            <button
              onClick={() => setTimeframe?.('day')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                timeframe === 'day'
                  ? 'bg-[#2A2F4F] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#1E293B]'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setTimeframe?.('month')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                timeframe === 'month'
                  ? 'bg-[#2A2F4F] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#1E293B]'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setTimeframe?.('year')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                timeframe === 'year'
                  ? 'bg-[#2A2F4F] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#1E293B]'
              }`}
            >
              Year
            </button>
          </div>

          <button
            onClick={onOpenQuickAdd}
            className="py-2 px-3 sm:py-2.5 sm:px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Search & Sorting bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] shadow-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="py-2.5 px-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-secondary)] focus:outline-none"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="highest">Highest Amount</option>
            <option value="lowest">Lowest Amount</option>
          </select>
        </div>
      </div>

      {/* Quick Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'all', label: 'All' },
          { id: 'expense', label: 'Expenses' },
          { id: 'income', label: 'Money In' },
          { id: 'transfer', label: 'Transfers' },
          { id: 'friend', label: 'Friends & Debts' },
        ].map((chip) => (
          <button
            key={chip.id}
            onClick={() => setSelectedTypeFilter(chip.id)}
            className={`px-3 py-1.5 rounded-xl font-medium border whitespace-nowrap transition-all cursor-pointer ${
              selectedTypeFilter === chip.id
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-xs'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Grouped Transaction Feed */}
      {Object.keys(groupedTransactions).length > 0 ? (
        <div className="space-y-4">
          {Object.entries(groupedTransactions).map(([groupKey, txList]) => (
            <div key={groupKey} className="space-y-1.5">
              <div className="text-[11px] font-bold tracking-wider text-[var(--text-tertiary)] uppercase px-1">
                {formatDateHeader(groupKey)}
              </div>

              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl divide-y divide-[var(--border-subtle)] shadow-xs overflow-hidden">
                {txList.map((tx) => {
                  const account = accounts?.find((a) => a.id === tx.accountId);
                  const category = categories?.find((c) => c.id === tx.categoryId);
                  const person = tx.friendId ? people?.find((p) => p.id === tx.friendId) : null;

                  const isNegative = tx.type === 'expense' || tx.type === 'lending' || tx.type === 'repayment_paid';

                  return (
                    <div
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="p-3.5 flex items-center justify-between hover:bg-[var(--bg-surface-elevated)] transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2.5 rounded-xl text-xs font-bold ${
                            isNegative ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'
                          }`}
                        >
                          {isNegative ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>

                        <div>
                          <div className="text-xs font-semibold text-[var(--text-primary)]">
                            {tx.note || category?.name || tx.sourceOfIncome || tx.type}
                          </div>
                          <div className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1.5 mt-0.5">
                            <span className="capitalize">{tx.type.replace('_', ' ')}</span>
                            <span>·</span>
                            <span>{account?.name || 'Cash'}</span>
                            {person && (
                              <>
                                <span>·</span>
                                <span className="font-medium text-[var(--accent)]">{person.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={`text-sm font-bold ${isNegative ? 'text-[var(--text-primary)]' : 'text-emerald-500'}`}>
                        {isNegative ? '-' : '+'}{formatCurrency(tx.amountInPaise)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl space-y-3 shadow-xs">
          <Receipt className="w-10 h-10 text-[var(--text-tertiary)] mx-auto opacity-50" />
          <div className="text-sm font-semibold text-[var(--text-primary)]">No matching transactions</div>
          <p className="text-xs text-[var(--text-secondary)]">
            No transactions found for {timeframeLabel}. Try selecting a different timeframe or date.
          </p>
        </div>
      )}

      {/* Transaction Detail Drawer */}
      {selectedTx && (
        <TransactionDetailModal
          transaction={selectedTx}
          accountName={accounts?.find((a) => a.id === selectedTx.accountId)?.name}
          categoryName={categories?.find((c) => c.id === selectedTx.categoryId)?.name}
          personName={selectedTx.friendId ? people?.find((p) => p.id === selectedTx.friendId)?.name : undefined}
          onClose={() => setSelectedTx(null)}
        />
      )}
    </div>
  );
};
