import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Home,
  Receipt,
  Users,
  PieChart,
  Wallet,
  Settings,
  Plus,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Landmark,
} from 'lucide-react';
import { db } from '../db/schema';
import { QuickAddModal } from '../components/modals/QuickAddModal';
import { BackupModal } from '../components/modals/BackupModal';
import { OnboardingWizard } from '../components/OnboardingWizard';
import {
  type TimeframeMode,
  formatTimeframeLabel,
  navigateTimeframe,
} from '../utils/dateUtils';

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  timeframe: TimeframeMode;
  setTimeframe?: (tf: TimeframeMode) => void;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  selectedYear: string;
  setSelectedYear: (y: string) => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  timeframe,
  selectedDate,
  setSelectedDate,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
}) => {
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [isBackupOpen, setIsBackupOpen] = useState<boolean>(false);

  const accounts = useLiveQuery(() => db.accounts.filter(a => !a.deletedAt).toArray(), []);

  if (accounts !== undefined && accounts.length === 0) {
    return <OnboardingWizard />;
  }

  const handleNavigateDate = (direction: 'prev' | 'next') => {
    const updated = navigateTimeframe(
      timeframe,
      direction,
      selectedDate,
      selectedMonth,
      selectedYear
    );
    setSelectedDate(updated.date);
    setSelectedMonth(updated.month);
    setSelectedYear(updated.year);
  };

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'friends', label: 'Friends', icon: Users },
    { id: 'insights', label: 'Insights', icon: PieChart },
    { id: 'accounts', label: 'Accounts', icon: Wallet },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col md:flex-row antialiased">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-60 border-r border-[#E2E8F0] bg-white p-4 shrink-0 justify-between sticky top-0 h-screen">
        <div className="space-y-5">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5 px-2">
            <div className="p-2 bg-[#2A2F4F] text-white rounded-xl">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight leading-none text-[#1E293B]">
                SpendStudent
              </h1>
              <span className="text-[10px] font-medium text-slate-500">Personal Finance PWA</span>
            </div>
          </div>

          {/* Quick Record Button */}
          <button
            onClick={() => setIsQuickAddOpen(true)}
            className="w-full py-2.5 px-4 bg-[#2A2F4F] hover:bg-[#1E2238] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors text-xs shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Record Transaction
          </button>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#2A2F4F] text-white font-semibold'
                      : 'text-slate-600 hover:text-[#1E293B] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-[#E2E8F0] space-y-1">
          <button
            onClick={() => setIsBackupOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-[#1E293B] rounded-lg hover:bg-[#F8FAFC]"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Backup & Export
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
        {/* HEADER BAR */}
        <header className="sticky top-0 z-30 bg-white border-b border-[#E2E8F0] px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Top Line on Mobile: Brand Logo + Backup Action */}
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex md:hidden items-center gap-2">
              <div className="p-1.5 bg-[#2A2F4F] text-white rounded-lg shrink-0">
                <Landmark className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-[#1E293B] hidden sm:inline">SpendStudent</span>
            </div>

            <div className="flex sm:hidden items-center gap-1">
              <button
                onClick={() => setIsBackupOpen(true)}
                className="p-1.5 text-slate-600 hover:text-[#1E293B] hover:bg-[#F8FAFC] rounded-xl cursor-pointer"
                title="Backup & Export"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </button>
            </div>
          </div>

          {/* Contextual Date Selector */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto min-w-0">
            <div className="flex items-center justify-between gap-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-1.5 py-1 text-xs font-semibold min-w-0 max-w-full shrink">
              <button
                onClick={() => handleNavigateDate('prev')}
                className="p-1 text-slate-600 hover:text-[#1E293B] rounded-md cursor-pointer shrink-0 z-20"
                title="Previous"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <div className="relative flex items-center justify-center min-w-0 px-2 py-0.5 hover:bg-slate-100 rounded-md transition-colors cursor-pointer">
                <span className="px-1 text-center text-[#1E293B] font-medium truncate min-w-0 text-[11px] sm:text-xs pointer-events-none select-none">
                  {formatTimeframeLabel(timeframe, selectedDate, selectedMonth, selectedYear)}
                </span>

                {timeframe === 'day' && (
                  <input
                    type="date"
                    value={selectedDate.slice(0, 10)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker();
                      } catch {}
                    }}
                    onChange={(e) => {
                      if (e.target.value) {
                        const parsedDate = new Date(e.target.value + 'T00:00:00');
                        const y = String(parsedDate.getFullYear());
                        const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
                        const d = String(parsedDate.getDate()).padStart(2, '0');

                        const dateStr = `${y}-${m}-${d}`;
                        const monthStr = `${y}-${m}`;
                        const yearStr = y;

                        setSelectedDate(dateStr);
                        setSelectedMonth(monthStr);
                        setSelectedYear(yearStr);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-xs z-10"
                    title="Select Date"
                  />
                )}

                {timeframe === 'month' && (
                  <input
                    type="month"
                    value={selectedMonth.slice(0, 7)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker();
                      } catch {}
                    }}
                    onChange={(e) => {
                      if (e.target.value) {
                        const parsedDate = new Date(e.target.value + '-01T00:00:00');
                        const y = String(parsedDate.getFullYear());
                        const m = String(parsedDate.getMonth() + 1).padStart(2, '0');

                        const monthStr = `${y}-${m}`;
                        const dateStr = `${monthStr}-01`;
                        const yearStr = y;

                        setSelectedMonth(monthStr);
                        setSelectedYear(yearStr);
                        setSelectedDate(dateStr);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-xs z-10"
                    title="Select Month"
                  />
                )}

                {timeframe === 'year' && (
                  <select
                    value={selectedYear.slice(0, 4)}
                    onChange={(e) => {
                      if (e.target.value) {
                        const parsedDate = new Date(e.target.value + '-01-01T00:00:00');
                        const y = String(parsedDate.getFullYear());

                        const yearStr = y;
                        const monthStr = `${y}-01`;
                        const dateStr = `${y}-01-01`;

                        setSelectedYear(yearStr);
                        setSelectedMonth(monthStr);
                        setSelectedDate(dateStr);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-xs z-10"
                    title="Select Year"
                  >
                    {Array.from({ length: 11 }, (_, i) => 2020 + i).map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button
                onClick={() => handleNavigateDate('next')}
                className="p-1 text-slate-600 hover:text-[#1E293B] rounded-md cursor-pointer shrink-0 z-20"
                title="Next"
              >
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>

            {/* Desktop Backup Action */}
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={() => setIsBackupOpen(true)}
                className="p-2 text-slate-600 hover:text-[#1E293B] hover:bg-[#F8FAFC] rounded-xl cursor-pointer"
                title="Backup & Export"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </button>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 p-4 md:p-6 max-w-5xl w-full mx-auto">{children}</main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E2E8F0] px-2 py-1.5 flex items-center justify-around">
        {navItems.slice(0, 2).map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-[10px] font-medium transition-colors ${
                isActive ? 'text-[#2A2F4F] font-bold' : 'text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </button>
          );
        })}

        {/* Central Elevated '+' Quick Add Button */}
        <button
          onClick={() => setIsQuickAddOpen(true)}
          className="relative -top-3 p-3 bg-[#2A2F4F] hover:bg-[#1E2238] text-white rounded-full border-2 border-[var(--bg-primary)] transition-transform active:scale-95 shadow-md"
          title="Record Money"
        >
          <Plus className="w-6 h-6" />
        </button>

        {navItems.slice(2, 5).map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-[10px] font-medium transition-colors ${
                isActive ? 'text-[#2A2F4F] font-bold' : 'text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* MODALS */}
      <QuickAddModal isOpen={isQuickAddOpen} onClose={() => setIsQuickAddOpen(false)} />
      <BackupModal isOpen={isBackupOpen} onClose={() => setIsBackupOpen(false)} />
    </div>
  );
};
