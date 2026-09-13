import { db } from '../../db/schema';
import type { BackupPayload } from '../../types';

export async function exportJSONBackup(): Promise<string> {
  const accounts = await db.accounts.toArray();
  const categories = await db.categories.toArray();
  const transactions = await db.transactions.toArray();
  const ledgerEntries = await db.ledgerEntries.toArray();
  const people = await db.people.toArray();
  const debts = await db.debts.toArray();
  const splitBills = await db.splitBills.toArray();
  const splitParticipants = await db.splitParticipants.toArray();
  const budgets = await db.budgets.toArray();
  const savingsGoals = await db.savingsGoals.toArray();
  const recurringTransactions = await db.recurringTransactions.toArray();

  const payload: BackupPayload = {
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    data: {
      accounts,
      categories,
      transactions,
      ledgerEntries,
      people,
      debts,
      splitBills,
      splitParticipants,
      budgets,
      savingsGoals,
      recurringTransactions,
    },
  };

  return JSON.stringify(payload, null, 2);
}

export interface BackupValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary?: {
    accountCount: number;
    transactionCount: number;
    peopleCount: number;
    splitBillCount: number;
  };
}

export function validateJSONBackup(jsonString: string): {
  result: BackupValidationResult;
  payload?: BackupPayload;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  let payload: BackupPayload;

  try {
    payload = JSON.parse(jsonString);
  } catch (err: unknown) {
    return {
      result: {
        isValid: false,
        errors: [`Invalid JSON format: ${(err as Error).message}`],
        warnings: [],
      },
    };
  }

  if (!payload || typeof payload !== 'object') {
    return {
      result: {
        isValid: false,
        errors: ['Backup content is not a valid JSON object.'],
        warnings: [],
      },
    };
  }

  if (payload.backupVersion !== 1) {
    errors.push(`Unsupported backup version: ${payload.backupVersion}. Expected version 1.`);
  }

  if (!payload.data || typeof payload.data !== 'object') {
    errors.push('Backup missing data container.');
    return { result: { isValid: false, errors, warnings } };
  }

  const { data } = payload;

  // Validate accounts
  if (!Array.isArray(data.accounts)) {
    errors.push('Data error: accounts array is missing or invalid.');
  } else {
    for (const acc of data.accounts) {
      if (!acc.id || !acc.name || typeof acc.balanceInPaise !== 'number') {
        errors.push(`Invalid account record: ${acc.id || 'unknown ID'}`);
      }
    }
  }

  // Validate transactions
  if (!Array.isArray(data.transactions)) {
    errors.push('Data error: transactions array is missing or invalid.');
  } else {
    for (const tx of data.transactions) {
      if (!tx.id || !tx.operationId || typeof tx.amountInPaise !== 'number') {
        errors.push(`Invalid transaction record: ${tx.id || 'unknown ID'}`);
      }
    }
  }

  // Check Foreign Key Integrity
  if (Array.isArray(data.accounts) && Array.isArray(data.transactions)) {
    const accountIds = new Set(data.accounts.map(a => a.id));
    for (const tx of data.transactions) {
      if (tx.accountId !== 'none' && !accountIds.has(tx.accountId)) {
        warnings.push(`Transaction ${tx.id} references non-existent account ID ${tx.accountId}.`);
      }
    }
  }

  const isValid = errors.length === 0;

  return {
    result: {
      isValid,
      errors,
      warnings,
      summary: isValid
        ? {
            accountCount: data.accounts?.length || 0,
            transactionCount: data.transactions?.length || 0,
            peopleCount: data.people?.length || 0,
            splitBillCount: data.splitBills?.length || 0,
          }
        : undefined,
    },
    payload: isValid ? payload : undefined,
  };
}

export async function restoreJSONBackup(payload: BackupPayload): Promise<void> {
  const { data } = payload;

  await db.transaction(
    'rw',
    [
      db.accounts,
      db.categories,
      db.transactions,
      db.ledgerEntries,
      db.people,
      db.debts,
      db.splitBills,
      db.splitParticipants,
      db.budgets,
      db.savingsGoals,
      db.recurringTransactions,
    ],
    async () => {
      // Clear existing records
      await db.accounts.clear();
      await db.categories.clear();
      await db.transactions.clear();
      await db.ledgerEntries.clear();
      await db.people.clear();
      await db.debts.clear();
      await db.splitBills.clear();
      await db.splitParticipants.clear();
      await db.budgets.clear();
      await db.savingsGoals.clear();
      await db.recurringTransactions.clear();

      // Bulk insert validated backup records
      if (data.accounts?.length) await db.accounts.bulkAdd(data.accounts);
      if (data.categories?.length) await db.categories.bulkAdd(data.categories);
      if (data.transactions?.length) await db.transactions.bulkAdd(data.transactions);
      if (data.ledgerEntries?.length) await db.ledgerEntries.bulkAdd(data.ledgerEntries);
      if (data.people?.length) await db.people.bulkAdd(data.people);
      if (data.debts?.length) await db.debts.bulkAdd(data.debts);
      if (data.splitBills?.length) await db.splitBills.bulkAdd(data.splitBills);
      if (data.splitParticipants?.length) await db.splitParticipants.bulkAdd(data.splitParticipants);
      if (data.budgets?.length) await db.budgets.bulkAdd(data.budgets);
      if (data.savingsGoals?.length) await db.savingsGoals.bulkAdd(data.savingsGoals);
      if (data.recurringTransactions?.length) await db.recurringTransactions.bulkAdd(data.recurringTransactions);
    }
  );
}
