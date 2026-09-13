import React, { useState } from 'react';
import {
  PiggyBank,
  Landmark,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/schema';
import { rupeesToPaise } from '../utils/formatters';
import { LedgerEngine } from '../lib/ledger/ledgerEngine';
import type { Category } from '../types';
import { supabase } from '../lib/supabase';

const DEFAULT_EXPENSE_CATEGORIES: Omit<Category, 'createdAt' | 'updatedAt'>[] = [
  { id: 'cat-food', name: 'Food & Dining', icon: 'Utensils', type: 'expense', isCustom: false, sortOrder: 1 },
  { id: 'cat-groceries', name: 'Groceries', icon: 'ShoppingCart', type: 'expense', isCustom: false, sortOrder: 2 },
  { id: 'cat-travel', name: 'Travel & Cab', icon: 'Car', type: 'expense', isCustom: false, sortOrder: 3 },
  { id: 'cat-shopping', name: 'Shopping', icon: 'ShoppingBag', type: 'expense', isCustom: false, sortOrder: 4 },
  { id: 'cat-entertainment', name: 'Entertainment', icon: 'Film', type: 'expense', isCustom: false, sortOrder: 5 },
  { id: 'cat-recharge', name: 'Recharge & Data', icon: 'Smartphone', type: 'expense', isCustom: false, sortOrder: 6 },
  { id: 'cat-bills', name: 'Bills & Utilities', icon: 'Zap', type: 'expense', isCustom: false, sortOrder: 7 },
  { id: 'cat-education', name: 'Education & Books', icon: 'BookOpen', type: 'expense', isCustom: false, sortOrder: 8 },
  { id: 'cat-health', name: 'Health & Fitness', icon: 'Activity', type: 'expense', isCustom: false, sortOrder: 9 },
  { id: 'cat-personal', name: 'Personal Care', icon: 'User', type: 'expense', isCustom: false, sortOrder: 10 },
  { id: 'cat-work', name: 'Work & Tools', icon: 'Briefcase', type: 'expense', isCustom: false, sortOrder: 11 },
  { id: 'cat-other', name: 'Other', icon: 'MoreHorizontal', type: 'expense', isCustom: false, sortOrder: 12 },
];

const DEFAULT_INCOME_CATEGORIES: Omit<Category, 'createdAt' | 'updatedAt'>[] = [
  { id: 'cat-income-allowance', name: 'Allowance', icon: 'HeartHandshake', type: 'income', isCustom: false, sortOrder: 1 },
  { id: 'cat-income-freelance', name: 'Freelance', icon: 'Laptop', type: 'income', isCustom: false, sortOrder: 2 },
  { id: 'cat-income-salary', name: 'Salary / Stipend', icon: 'Building', type: 'income', isCustom: false, sortOrder: 3 },
  { id: 'cat-income-other', name: 'Gifts & Other', icon: 'Gift', type: 'income', isCustom: false, sortOrder: 4 },
];

interface OnboardingWizardProps {
  onComplete?: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 State: Primary Account
  const [primaryName, setPrimaryName] = useState('');
  const [primaryBalance, setPrimaryBalance] = useState('');

  // Step 2 State: Savings Account
  const [hasSavings, setHasSavings] = useState(true);
  const [savingsName, setSavingsName] = useState('');
  const [savingsBalance, setSavingsBalance] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!primaryName.trim()) {
      setError('Please enter a name for your primary account.');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (hasSavings && !savingsName.trim()) {
      setError('Please enter a name for your savings account.');
      return;
    }

    setIsSubmitting(true);

    try {
      const timestamp = new Date().toISOString();
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;

      if (!userId) {
        throw new Error('User authentication session not found. Please log in again.');
      }

      // Prepare Category payloads
      const categoriesPayload = [
        ...DEFAULT_EXPENSE_CATEGORIES,
        ...DEFAULT_INCOME_CATEGORIES,
      ].map(c => ({
        id: c.id,
        user_id: userId,
        name: c.name,
        icon: c.icon,
        type: c.type,
        is_custom: c.isCustom,
        isCustom: c.isCustom,
        sort_order: c.sortOrder,
        sortOrder: c.sortOrder,
        created_at: timestamp,
        updated_at: timestamp,
      }));

      // Prepare Primary Account payload
      const primaryId = uuidv4();
      const primaryPaise = rupeesToPaise(parseFloat(primaryBalance) || 0);

      const accountsPayload: any[] = [
        {
          id: primaryId,
          user_id: userId,
          name: primaryName.trim(),
          type: 'bank',
          balance_in_paise: primaryPaise,
          balanceInPaise: primaryPaise,
          currency: 'INR',
          icon: 'Landmark',
          description: 'Primary Spending Account',
          is_primary_spending: true,
          isPrimarySpending: true,
          is_savings: false,
          isSavings: false,
          created_at: timestamp,
          updated_at: timestamp,
        },
      ];

      // Prepare Savings Account payload if applicable
      let savingsId: string | null = null;
      let savingsPaise = 0;
      if (hasSavings) {
        savingsId = uuidv4();
        savingsPaise = rupeesToPaise(parseFloat(savingsBalance) || 0);
        accountsPayload.push({
          id: savingsId,
          user_id: userId,
          name: savingsName.trim(),
          type: 'savings',
          balance_in_paise: savingsPaise,
          balanceInPaise: savingsPaise,
          currency: 'INR',
          icon: 'PiggyBank',
          description: 'Savings & Contingency Fund',
          is_primary_spending: false,
          isPrimarySpending: false,
          is_savings: true,
          isSavings: true,
          created_at: timestamp,
          updated_at: timestamp,
        });
      }

      // --- EXECUTE & AWAIT SUPABASE INSERTS FIRST ---
      const { error: catErr } = await supabase.from('categories').upsert(categoriesPayload);
      if (catErr) {
        console.error('Supabase Onboarding Categories Error:', catErr.code, catErr.message, catErr.details);
        setError(`Cloud Setup Failed [Code ${catErr.code || 'RLS'}]: ${catErr.message}`);
        setIsSubmitting(false);
        return;
      }

      const { error: accErr } = await supabase.from('accounts').upsert(accountsPayload);
      if (accErr) {
        console.error('Supabase Onboarding Accounts Error:', accErr.code, accErr.message, accErr.details);
        setError(`Cloud Setup Failed [Code ${accErr.code || 'RLS'}]: ${accErr.message}`);
        setIsSubmitting(false);
        return;
      }

      // --- NOW WRITE TO LOCAL DEXIE DB ---
      await db.categories.bulkPut(
        categoriesPayload.map(c => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          type: c.type as any,
          isCustom: c.isCustom,
          sortOrder: c.sortOrder,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        }))
      );

      // Create primary account in Dexie
      await db.accounts.add({
        id: primaryId,
        name: primaryName.trim(),
        type: 'bank',
        balanceInPaise: 0,
        currency: 'INR',
        icon: 'Landmark',
        description: 'Primary Spending Account',
        isPrimarySpending: true,
        isSavings: false,
        syncStatus: 'synced',
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      if (primaryPaise > 0) {
        await LedgerEngine.adjustAccountBalance({
          accountId: primaryId,
          targetBalanceInPaise: primaryPaise,
          date: timestamp,
          note: 'Initial starting balance',
        });
      }

      if (hasSavings && savingsId) {
        await db.accounts.add({
          id: savingsId,
          name: savingsName.trim(),
          type: 'savings',
          balanceInPaise: 0,
          currency: 'INR',
          icon: 'PiggyBank',
          description: 'Savings & Contingency Fund',
          isPrimarySpending: false,
          isSavings: true,
          syncStatus: 'synced',
          createdAt: timestamp,
          updatedAt: timestamp,
        });

        if (savingsPaise > 0) {
          await LedgerEngine.adjustAccountBalance({
            accountId: savingsId,
            targetBalanceInPaise: savingsPaise,
            date: timestamp,
            note: 'Initial savings balance',
          });
        }
      }

      if (onComplete) {
        onComplete();
      }
    } catch (err: unknown) {
      console.error('Failed to complete onboarding wizard:', err);
      setError((err as Error).message || 'Failed to save setup. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-primary)] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl p-6 sm:p-8 shadow-lg my-auto">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[var(--accent)] text-white shadow-xs mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
            Welcome to Student Finance
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1 font-medium">
            Let's set up your starting financial accounts to get started
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8 px-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === 1
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-emerald-500 text-white'
              }`}
            >
              {step > 1 ? <Check className="w-4 h-4" /> : '1'}
            </div>
            <span className="text-xs font-bold text-[var(--text-primary)]">Primary Account</span>
          </div>

          <div className="h-0.5 flex-1 bg-[var(--border-subtle)] mx-3" />

          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === 2
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-primary)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]'
              }`}
            >
              2
            </div>
            <span
              className={`text-xs font-bold ${
                step === 2 ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
              }`}
            >
              Savings Account
            </span>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-medium">
            {error}
          </div>
        )}

        {/* STEP 1: Primary Account Form */}
        {step === 1 && (
          <form onSubmit={handleNext} className="space-y-5 animate-fadeIn">
            <div className="p-4 bg-[var(--accent-light)] border border-[var(--border-subtle)] rounded-2xl flex items-center gap-3">
              <div className="p-2.5 bg-white text-[var(--accent)] rounded-xl shadow-xs">
                <Landmark className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--text-primary)]">
                  Main Daily Spending Account
                </div>
                <div className="text-[11px] text-[var(--text-secondary)]">
                  Where you pay for food, cabs, recharge, and everyday spending.
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                Account Name
              </label>
              <input
                type="text"
                value={primaryName}
                onChange={(e) => setPrimaryName(e.target.value)}
                placeholder="e.g., State Bank, HDFC, or Cash"
                required
                className="w-full px-3.5 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-subtle)] focus:border-[var(--accent)] focus:bg-white rounded-xl text-xs font-medium text-[var(--text-primary)] transition-all outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                Current Starting Balance (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--text-tertiary)]">
                  ₹
                </span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={primaryBalance}
                  onChange={(e) => setPrimaryBalance(e.target.value)}
                  placeholder="0"
                  required
                  className="w-full pl-8 pr-3.5 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-subtle)] focus:border-[var(--accent)] focus:bg-white rounded-xl text-sm font-bold text-[var(--text-primary)] transition-all outline-none"
                />
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1 font-medium">
                Log your actual balance today. You can adjust this anytime later.
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              <span>Continue to Savings</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 2: Savings Account Form */}
        {step === 2 && (
          <form onSubmit={handleFinish} className="space-y-5 animate-fadeIn">
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white text-emerald-600 rounded-xl shadow-xs">
                  <PiggyBank className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-950">
                    Separate Savings Pool
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    Emergency fund, savings account, or fixed deposit.
                  </div>
                </div>
              </div>

              <input
                type="checkbox"
                id="hasSavingsToggle"
                checked={hasSavings}
                onChange={(e) => setHasSavings(e.target.checked)}
                className="w-5 h-5 accent-emerald-600 cursor-pointer"
              />
            </div>

            {hasSavings ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Savings Account Name
                  </label>
                  <input
                    type="text"
                    value={savingsName}
                    onChange={(e) => setSavingsName(e.target.value)}
                    placeholder="e.g., Fixed Deposit or Piggy Bank"
                    required={hasSavings}
                    className="w-full px-3.5 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-subtle)] focus:border-[var(--accent)] focus:bg-white rounded-xl text-xs font-medium text-[var(--text-primary)] transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Savings Starting Balance (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--text-tertiary)]">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={savingsBalance}
                      onChange={(e) => setSavingsBalance(e.target.value)}
                      placeholder="0"
                      required={hasSavings}
                      className="w-full pl-8 pr-3.5 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-subtle)] focus:border-[var(--accent)] focus:bg-white rounded-xl text-sm font-bold text-[var(--text-primary)] transition-all outline-none"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="p-4 bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-2xl text-center text-xs text-[var(--text-secondary)] font-medium">
                You can add a savings account anytime later from the Accounts tab.
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={isSubmitting}
                className="py-3 px-4 bg-[var(--bg-primary)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Setting Up Accounts...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Finish Setup & Open App</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Footer info */}
        <div className="mt-6 text-center text-[11px] text-[var(--text-tertiary)] flex items-center justify-center gap-1.5 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Ledger-backed mathematical balance accuracy</span>
        </div>
      </div>
    </div>
  );
};
