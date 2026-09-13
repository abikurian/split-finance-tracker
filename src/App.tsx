import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AuthPage } from './pages/AuthPage';
import { AppLayout } from './layouts/AppLayout';
import { HomePage } from './pages/HomePage';
import { TransactionsPage } from './pages/TransactionsPage';
import { FriendsPage } from './pages/FriendsPage';
import { InsightsPage } from './pages/InsightsPage';
import { AccountsPage } from './pages/AccountsPage';
import { SettingsPage } from './pages/SettingsPage';
import { QuickAddModal } from './components/modals/QuickAddModal';
import { BackupModal } from './components/modals/BackupModal';
import type { TimeframeMode } from './utils/dateUtils';

function AuthenticatedApp() {
  const { user, loading } = useAuth();

  const [activeTab, setActiveTab] = useState<string>('home');

  // Timeframe State
  const todayISO = new Date().toISOString().slice(0, 10);
  const [timeframe, setTimeframe] = useState<TimeframeMode>('month');
  const [selectedDate, setSelectedDate] = useState<string>(todayISO); // YYYY-MM-DD
  const [selectedMonth, setSelectedMonth] = useState<string>(todayISO.slice(0, 7)); // YYYY-MM
  const [selectedYear, setSelectedYear] = useState<string>(todayISO.slice(0, 4)); // YYYY

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddDefaultTab, setQuickAddDefaultTab] = useState<'expense' | 'income' | 'transfer' | 'friend'>('expense');
  const [isQuickAddFriendContextOnly, setIsQuickAddFriendContextOnly] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin mb-2" />
        <p className="text-xs font-semibold text-[var(--text-secondary)]">Checking authentication...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const handleOpenQuickAdd = (
    defaultTab: 'expense' | 'income' | 'transfer' | 'friend' = 'expense',
    isFriendContext: boolean = false
  ) => {
    setQuickAddDefaultTab(defaultTab);
    setIsQuickAddFriendContextOnly(isFriendContext);
    setIsQuickAddOpen(true);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'home') {
      setTimeframe('month');
    }
  };

  const renderActivePage = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomePage
            selectedMonth={selectedMonth}
            onNavigate={handleTabChange}
            onOpenQuickAdd={handleOpenQuickAdd}
          />
        );
      case 'transactions':
        return (
          <TransactionsPage
            timeframe={timeframe}
            setTimeframe={setTimeframe}
            selectedDate={selectedDate}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onOpenQuickAdd={() => handleOpenQuickAdd('expense')}
          />
        );
      case 'friends':
        return <FriendsPage onOpenQuickAdd={(tab, isFriendContext) => handleOpenQuickAdd(tab, isFriendContext)} />;
      case 'insights':
        return (
          <InsightsPage
            timeframe={timeframe}
            setTimeframe={setTimeframe}
            selectedDate={selectedDate}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        );
      case 'accounts':
        return <AccountsPage onOpenQuickAdd={handleOpenQuickAdd} />;
      case 'settings':
        return <SettingsPage onOpenBackupModal={() => setIsBackupOpen(true)} />;
      default:
        return (
          <HomePage
            selectedMonth={selectedMonth}
            onNavigate={handleTabChange}
            onOpenQuickAdd={handleOpenQuickAdd}
          />
        );
    }
  };

  return (
    <>
      <AppLayout
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
      >
        {renderActivePage()}
      </AppLayout>

      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        defaultTab={quickAddDefaultTab}
        isFriendContextOnly={isQuickAddFriendContextOnly}
      />

      <BackupModal isOpen={isBackupOpen} onClose={() => setIsBackupOpen(false)} />
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

export default App;
