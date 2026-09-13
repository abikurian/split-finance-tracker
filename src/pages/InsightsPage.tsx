import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { CheckCircle2, TrendingDown, TrendingUp, PiggyBank, Users } from 'lucide-react';
import { db } from '../db/schema';
import { formatCurrency, paiseToRupees } from '../utils/formatters';
import { type TimeframeMode, formatTimeframeLabel } from '../utils/dateUtils';

interface InsightsPageProps {
  timeframe: TimeframeMode;
  setTimeframe?: (tf: TimeframeMode) => void;
  selectedDate: string;
  selectedMonth: string;
  selectedYear: string;
}

const COLOR_PALETTE = ['#2563eb', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#64748b'];

export const InsightsPage: React.FC<InsightsPageProps> = ({
  timeframe,
  setTimeframe,
  selectedDate,
  selectedMonth,
  selectedYear,
}) => {
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const allTransactions = useLiveQuery(
    () => db.transactions.filter((t) => !t.deletedAt).toArray(),
    []
  );

  const activeYear = selectedDate ? selectedDate.slice(0, 4) : selectedYear;

  // Filter transactions according to active timeframe
  const filteredTransactions = (allTransactions || []).filter((tx) => {
    if (timeframe === 'day') {
      return tx.date.startsWith(selectedDate);
    }
    if (timeframe === 'month') {
      return tx.date.startsWith(selectedMonth);
    }
    return tx.date.startsWith(activeYear);
  });

  // Calculate Summary Numbers
  let totalExpensesInPaise = 0;
  let totalIncomeInPaise = 0;
  let totalLentInPaise = 0;
  let totalTransfersInPaise = 0;
  const categoryExpenses: Record<string, number> = {};

  filteredTransactions.forEach((tx) => {
    if (tx.type === 'expense') {
      totalExpensesInPaise += tx.amountInPaise;
      if (tx.categoryId) {
        categoryExpenses[tx.categoryId] = (categoryExpenses[tx.categoryId] || 0) + tx.amountInPaise;
      }
    } else if (tx.type === 'income') {
      totalIncomeInPaise += tx.amountInPaise;
    } else if (tx.type === 'lending') {
      totalLentInPaise += tx.amountInPaise;
    } else if (tx.type === 'transfer' || tx.type === 'savings_withdrawal') {
      totalTransfersInPaise += tx.amountInPaise;
    }
  });

  // Build Pie Chart Data
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

  // Build Timeframe Trend Data for Bar Chart
  const trendData: { label: string; expense: number; income: number }[] = [];

  if (timeframe === 'day') {
    // 8 hourly buckets
    const hours = [0, 3, 6, 9, 12, 15, 18, 21];
    hours.forEach((h) => {
      const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
      let exp = 0;
      let inc = 0;
      filteredTransactions.forEach((tx) => {
        const txHour = new Date(tx.date).getHours();
        if (txHour >= h && txHour < h + 3) {
          if (tx.type === 'expense') exp += paiseToRupees(tx.amountInPaise);
          if (tx.type === 'income') inc += paiseToRupees(tx.amountInPaise);
        }
      });
      trendData.push({ label, expense: exp, income: inc });
    });
  } else if (timeframe === 'month') {
    // Days of the month (e.g. 1 to 31)
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const fullDateStr = `${selectedMonth}-${dayStr}`;
      let exp = 0;
      let inc = 0;
      filteredTransactions.forEach((tx) => {
        if (tx.date.startsWith(fullDateStr)) {
          if (tx.type === 'expense') exp += paiseToRupees(tx.amountInPaise);
          if (tx.type === 'income') inc += paiseToRupees(tx.amountInPaise);
        }
      });
      trendData.push({ label: `${day}`, expense: exp, income: inc });
    }
  } else {
    // 12 Months of the Year
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    monthNames.forEach((name, idx) => {
      const mStr = `${activeYear}-${String(idx + 1).padStart(2, '0')}`;
      let exp = 0;
      let inc = 0;
      filteredTransactions.forEach((tx) => {
        if (tx.date.startsWith(mStr)) {
          if (tx.type === 'expense') exp += paiseToRupees(tx.amountInPaise);
          if (tx.type === 'income') inc += paiseToRupees(tx.amountInPaise);
        }
      });
      trendData.push({ label: name, expense: exp, income: inc });
    });
  }

  // Generate Calculated Insights
  const insights: string[] = [];
  if (totalExpensesInPaise > 0 && categoryData.length > 0) {
    const topCat = [...categoryData].sort((a, b) => b.value - a.value)[0];
    insights.push(`Top spending category: ${topCat.name} (${formatCurrency(topCat.amountPaise)}).`);
  }
  if (totalTransfersInPaise > 0) {
    insights.push(`Saved or transferred ${formatCurrency(totalTransfersInPaise)} during this period.`);
  }
  if (totalIncomeInPaise > totalExpensesInPaise) {
    const netSavings = totalIncomeInPaise - totalExpensesInPaise;
    insights.push(`Positive cashflow! Net surplus of ${formatCurrency(netSavings)}.`);
  }

  const timeframeLabel = formatTimeframeLabel(timeframe, selectedDate, selectedMonth, selectedYear);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--text-primary)]">Financial Insights</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Breakdown & cashflow for {timeframeLabel}
          </p>
        </div>

        {/* Timeframe Selector Pills */}
        <div className="flex bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-1 text-xs font-semibold shadow-xs shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setTimeframe?.('day')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              timeframe === 'day'
                ? 'bg-[#2A2F4F] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#1E293B]'
            }`}
          >
            Day
          </button>
          <button
            onClick={() => setTimeframe?.('month')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              timeframe === 'month'
                ? 'bg-[#2A2F4F] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#1E293B]'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setTimeframe?.('year')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              timeframe === 'year'
                ? 'bg-[#2A2F4F] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#1E293B]'
            }`}
          >
            Year
          </button>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="p-3 sm:p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-xs min-w-0">
          <span className="text-[10px] sm:text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider block truncate">
            Total Spent
          </span>
          <div className="text-sm sm:text-base md:text-lg font-bold text-red-500 mt-1 flex items-center gap-1 truncate">
            <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">{formatCurrency(totalExpensesInPaise)}</span>
          </div>
        </div>

        <div className="p-3 sm:p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-xs min-w-0">
          <span className="text-[10px] sm:text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider block truncate">
            Money Received
          </span>
          <div className="text-sm sm:text-base md:text-lg font-bold text-emerald-600 mt-1 flex items-center gap-1 truncate">
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">{formatCurrency(totalIncomeInPaise)}</span>
          </div>
        </div>

        <div className="p-3 sm:p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-xs min-w-0">
          <span className="text-[10px] sm:text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider block truncate">
            Money Lent
          </span>
          <div className="text-sm sm:text-base md:text-lg font-bold text-amber-600 mt-1 flex items-center gap-1 truncate">
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">{formatCurrency(totalLentInPaise)}</span>
          </div>
        </div>

        <div className="p-3 sm:p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-xs min-w-0">
          <span className="text-[10px] sm:text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider block truncate">
            Saved / Moved
          </span>
          <div className="text-sm sm:text-base md:text-lg font-bold text-[var(--text-primary)] mt-1 flex items-center gap-1 truncate">
            <PiggyBank className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-blue-600" />
            <span className="truncate">{formatCurrency(totalTransfersInPaise)}</span>
          </div>
        </div>
      </div>

      {/* Timeframe Cashflow Bar Chart */}
      <div className="p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl space-y-3 shadow-xs">
        <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
          {timeframe === 'day'
            ? 'Hourly Cashflow Trend'
            : timeframe === 'month'
            ? 'Daily Cashflow Trend'
            : 'Monthly Cashflow Trend'}
        </h2>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value: any) => [`₹${Number(value || 0).toFixed(2)}`, '']} />
              <Bar dataKey="expense" fill="#ef4444" name="Expense" radius={[4, 4, 0, 0]} />
              <Bar dataKey="income" fill="#10b981" name="Income" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Pie Chart Card */}
      <div className="p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl space-y-4 shadow-xs">
        <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
          Spending by Category ({timeframeLabel})
        </h2>

        {categoryData.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="h-52 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={2}
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

            {/* Category Legend List */}
            <div className="space-y-2 text-xs">
              {categoryData.map((cat, idx) => (
                <div key={cat.name} className="flex items-center justify-between p-2 rounded-xl bg-[var(--bg-surface-elevated)]">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: COLOR_PALETTE[idx % COLOR_PALETTE.length] }}
                    />
                    <span className="font-semibold text-[var(--text-primary)]">{cat.name}</span>
                  </div>
                  <span className="font-bold text-[var(--text-primary)]">
                    {formatCurrency(cat.amountPaise)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-[var(--text-tertiary)] italic">
            No category expenses recorded for this timeframe.
          </div>
        )}
      </div>

      {/* Calculated Insights List */}
      {insights.length > 0 && (
        <div className="p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl space-y-3 shadow-xs">
          <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600" /> Key Insights
          </h2>
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <div key={i} className="p-3 bg-[var(--bg-surface-elevated)] rounded-xl text-xs text-[var(--text-secondary)] font-medium">
                • {insight}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
