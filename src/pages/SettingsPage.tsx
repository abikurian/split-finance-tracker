import React, { useState } from 'react';
import { ShieldCheck, FileSpreadsheet, Trash2, LogOut, User } from 'lucide-react';
import { exportTransactionsToCSV, downloadFile } from '../lib/export/csvExport';
import { clearAllDatabaseData } from '../db/schema';
import { useAuth } from '../hooks/useAuth';

interface SettingsPageProps {
  onOpenBackupModal: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onOpenBackupModal }) => {
  const { user, signOut } = useAuth();
  const [isResetting, setIsResetting] = useState(false);

  const handleExportCSV = async () => {
    const csv = await exportTransactionsToCSV();
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadFile(csv, `student_finance_transactions_${dateStr}.csv`, 'text/csv');
  };

  const handleClearData = async () => {
    if (confirm('Are you sure you want to clear all data? This will reset your database to start fresh.')) {
      setIsResetting(true);
      try {
        await clearAllDatabaseData();
        alert('Database cleared successfully.');
      } catch (err: unknown) {
        alert(`Error clearing data: ${(err as Error).message}`);
      } finally {
        setIsResetting(false);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-extrabold text-[var(--text-primary)]">Settings & Data Management</h1>
        <p className="text-xs text-[var(--text-secondary)]">Export data, manage backups, and configure preferences</p>
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl divide-y divide-[var(--border-subtle)] shadow-xs overflow-hidden text-xs">
        {/* User Account Info & Sign Out */}
        <div className="p-4 flex items-center justify-between bg-[var(--bg-surface-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-[var(--text-primary)]">Account Profile</div>
              <div className="text-[var(--text-secondary)] text-[11px]">
                {user?.email || 'Logged In User'}
              </div>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="px-3.5 py-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

        {/* Backup & JSON Restore */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <div className="font-bold text-[var(--text-primary)]">Complete Backup & Restore</div>
            <div className="text-[var(--text-secondary)] text-[11px] mt-0.5">
              Export complete JSON backup or validate & restore past backups.
            </div>
          </div>
          <button
            onClick={onOpenBackupModal}
            className="px-3.5 py-2 bg-[var(--accent-light)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" /> Open Backup Tool
          </button>
        </div>

        {/* CSV Export */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <div className="font-bold text-[var(--text-primary)]">Export CSV Spreadsheet</div>
            <div className="text-[var(--text-secondary)] text-[11px] mt-0.5">
              Download human-readable CSV of all transactions for Excel/Sheets.
            </div>
          </div>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent)] text-[var(--text-primary)] text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Export CSV
          </button>
        </div>

        {/* Reset / Clear Data */}
        <div className="p-4 flex items-center justify-between bg-red-500/5">
          <div>
            <div className="font-bold text-red-500">Clear All Data</div>
            <div className="text-[var(--text-secondary)] text-[11px] mt-0.5">
              Reset database and clear all local financial records to start onboarding again.
            </div>
          </div>
          <button
            onClick={handleClearData}
            disabled={isResetting}
            className="px-3.5 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" /> Reset Database
          </button>
        </div>
      </div>
    </div>
  );
};
