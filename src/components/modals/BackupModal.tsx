import React, { useState } from 'react';
import { X, Download, Upload, CheckCircle2, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { exportTransactionsToCSV, downloadFile } from '../../lib/export/csvExport';
import { exportJSONBackup, validateJSONBackup, restoreJSONBackup, type BackupValidationResult } from '../../lib/export/jsonBackup';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose }) => {
  const [jsonInput, setJsonInput] = useState<string>('');
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const [validatedPayload, setValidatedPayload] = useState<any>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleExportCSV = async () => {
    const csv = await exportTransactionsToCSV();
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadFile(csv, `student_finance_transactions_${dateStr}.csv`, 'text/csv');
  };

  const handleExportJSON = async () => {
    const json = await exportJSONBackup();
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadFile(json, `student_finance_backup_${dateStr}.json`, 'application/json');
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const text = event.target?.result as string;
      setJsonInput(text);
      runValidation(text);
    };
    reader.readAsText(file);
  };

  const runValidation = (text: string) => {
    setRestoreSuccess(false);
    const { result, payload } = validateJSONBackup(text);
    setValidationResult(result);
    setValidatedPayload(payload);
  };

  const handleExecuteRestore = async () => {
    if (!validatedPayload) return;
    setIsRestoring(true);
    try {
      await restoreJSONBackup(validatedPayload);
      setRestoreSuccess(true);
      setValidationResult(null);
      setValidatedPayload(null);
      setJsonInput('');
    } catch (err: unknown) {
      alert(`Restore failed: ${(err as Error).message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Data Backup & Restore</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-6 text-sm">
          {/* Export Section */}
          <div className="space-y-3">
            <h3 className="font-semibold text-[var(--text-primary)] text-xs uppercase tracking-wider text-[var(--text-secondary)]">
              Export Your Data
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleExportCSV}
                className="p-3 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent)] rounded-xl flex items-center gap-2 font-medium text-[var(--text-primary)] transition-all text-xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                Export CSV Spreadsheet
              </button>
              <button
                onClick={handleExportJSON}
                className="p-3 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent)] rounded-xl flex items-center gap-2 font-medium text-[var(--text-primary)] transition-all text-xs"
              >
                <Download className="w-4 h-4 text-blue-500" />
                Export Complete JSON
              </button>
            </div>
          </div>

          <hr className="border-[var(--border-subtle)]" />

          {/* Restore Section */}
          <div className="space-y-3">
            <h3 className="font-semibold text-[var(--text-primary)] text-xs uppercase tracking-wider text-[var(--text-secondary)]">
              Restore From JSON Backup
            </h3>

            {restoreSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-xl text-xs flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Backup successfully validated and restored into IndexedDB!
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Upload Backup File (.json)
              </label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="w-full text-xs text-[var(--text-secondary)] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[var(--accent-light)] file:text-[var(--accent)] hover:file:bg-[var(--accent)] hover:file:text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-[var(--text-secondary)]">
                Or Paste JSON Content Directly
              </label>
              <textarea
                rows={4}
                placeholder="Paste backup JSON payload..."
                value={jsonInput}
                onChange={e => {
                  setJsonInput(e.target.value);
                  if (e.target.value.trim()) runValidation(e.target.value);
                }}
                className="w-full p-2.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Validation Feedback */}
            {validationResult && (
              <div className="p-3 rounded-xl border text-xs space-y-2 bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)]">
                <div className="flex items-center justify-between font-semibold">
                  <span className={validationResult.isValid ? 'text-emerald-500' : 'text-red-500'}>
                    {validationResult.isValid ? '✅ Validation Passed' : '❌ Validation Failed'}
                  </span>
                  {validationResult.summary && (
                    <span className="text-[var(--text-tertiary)] font-normal">
                      {validationResult.summary.transactionCount} transactions found
                    </span>
                  )}
                </div>

                {validationResult.errors.length > 0 && (
                  <ul className="text-red-500 list-disc list-inside space-y-1">
                    {validationResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}

                {validationResult.warnings.length > 0 && (
                  <ul className="text-amber-500 list-disc list-inside space-y-1">
                    {validationResult.warnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                )}

                {validationResult.isValid && validatedPayload && (
                  <button
                    onClick={handleExecuteRestore}
                    disabled={isRestoring}
                    className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 text-xs"
                  >
                    <Upload className="w-4 h-4" />
                    Confirm & Overwrite Database
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
