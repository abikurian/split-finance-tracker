import Dexie, { type Table } from 'dexie';
import type {
  Account,
  Category,
  Transaction,
  LedgerEntry,
  Person,
  Debt,
  SplitBill,
  SplitParticipant,
  Budget,
  SavingsGoal,
  RecurringTransaction,
} from '../types';

export class StudentFinanceDatabase extends Dexie {
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  ledgerEntries!: Table<LedgerEntry, string>;
  people!: Table<Person, string>;
  debts!: Table<Debt, string>;
  splitBills!: Table<SplitBill, string>;
  splitParticipants!: Table<SplitParticipant, string>;
  budgets!: Table<Budget, string>;
  savingsGoals!: Table<SavingsGoal, string>;
  recurringTransactions!: Table<RecurringTransaction, string>;

  constructor() {
    super('StudentFinanceDB');

    // Version 1 Schema Definition
    this.version(1).stores({
      accounts: 'id, name, type, isPrimarySpending, isSavings, syncStatus, deletedAt',
      categories: 'id, name, type, sortOrder',
      transactions: 'id, &operationId, type, date, accountId, categoryId, friendId, deletedAt',
      ledgerEntries: 'id, transactionId, operationId, accountId, entityType, entityId',
      people: 'id, name, deletedAt',
      debts: 'id, transactionId, personId, type, status',
      splitBills: 'id, transactionId, paidByPersonId, date',
      splitParticipants: 'id, splitBillId, personId, status',
      budgets: 'id, categoryId',
      savingsGoals: 'id, name',
      recurringTransactions: 'id, type, accountId, isActive',
    });
  }
}

export const db = new StudentFinanceDatabase();

export async function clearAllDatabaseData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map(table => table.clear()));
  });
}
