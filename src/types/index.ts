export type TransactionType =
  | 'expense'
  | 'income'
  | 'transfer'
  | 'savings_withdrawal'
  | 'lending'
  | 'borrowing'
  | 'repayment_received'
  | 'repayment_paid'
  | 'split_bill'
  | 'reimbursement'
  | 'balance_adjustment';

export type AccountType = 'bank' | 'savings' | 'cash' | 'wallet' | 'other';

export type SyncStatus = 'synced' | 'pending' | 'conflict';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balanceInPaise: number;
  currency: string;
  icon: string;
  description?: string;
  isPrimarySpending: boolean;
  isSavings: boolean;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  deletedAt?: string | null;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: 'expense' | 'income';
  isCustom: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  operationId: string;
  type: TransactionType;
  amountInPaise: number;
  date: string; // ISO date format
  accountId: string;
  destinationAccountId?: string; // for transfers
  categoryId?: string;
  friendId?: string; // for lending, borrowing, repayment
  sourceOfIncome?: string;
  note?: string;
  status: 'completed' | 'pending' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  splitBillId?: string;
  reimbursementForTransactionId?: string;
}

export type LedgerDirection = 'in' | 'out';

export interface LedgerEntry {
  id: string;
  transactionId: string;
  operationId: string;
  accountId: string;
  entityType: 'account' | 'category' | 'friend_receivable' | 'friend_payable' | 'income_source' | 'adjustment';
  entityId: string;
  amountInPaise: number;
  direction: LedgerDirection;
  createdAt: string;
}

export interface Person {
  id: string;
  name: string;
  avatar?: string;
  phone?: string;
  netBalanceInPaise: number; // Positive: Friend owes user. Negative: User owes friend.
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Debt {
  id: string;
  transactionId: string;
  personId: string;
  amountInPaise: number;
  type: 'they_owe_me' | 'i_owe_them';
  settledAmountInPaise: number;
  status: 'pending' | 'partially_paid' | 'paid';
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SplitBill {
  id: string;
  transactionId: string;
  totalAmountInPaise: number;
  userShareInPaise: number;
  paidByPersonId?: string;
  payerType: 'user' | 'friend';
  note?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface SplitParticipant {
  id: string;
  splitBillId: string;
  personId: string;
  shareAmountInPaise: number;
  settledAmountInPaise: number;
  status: 'pending' | 'paid';
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  categoryId?: string;
  limitInPaise: number;
  period: 'monthly';
  createdAt: string;
  updatedAt: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmountInPaise: number;
  currentAmountInPaise: number;
  targetDate?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTransaction {
  id: string;
  type: TransactionType;
  amountInPaise: number;
  accountId: string;
  categoryId?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  nextDueDate: string;
  note?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BackupPayload {
  backupVersion: number;
  exportedAt: string;
  appVersion: string;
  data: {
    accounts: Account[];
    categories: Category[];
    transactions: Transaction[];
    ledgerEntries: LedgerEntry[];
    people: Person[];
    debts: Debt[];
    splitBills: SplitBill[];
    splitParticipants: SplitParticipant[];
    budgets: Budget[];
    savingsGoals: SavingsGoal[];
    recurringTransactions: RecurringTransaction[];
  };
}

export interface MonthlyFinancialSummary {
  yearMonth: string;
  totalExpensesInPaise: number;
  totalIncomeInPaise: number;
  totalReimbursementsInPaise: number;
  totalTransfersInPaise: number;
  totalLentInPaise: number;
  totalBorrowedInPaise: number;
  totalRepaymentsInPaise: number;
  totalSavedTransferredInPaise: number;
  categoryExpenses: Record<string, number>;
}
