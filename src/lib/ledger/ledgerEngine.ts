import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db/schema';
import { formatCurrency } from '../../utils/formatters';
import type {
  Transaction,
  LedgerEntry,
  TransactionType,
  MonthlyFinancialSummary,
  SplitParticipant,
} from '../../types';
import {
  pushTransactionToSupabase,
  pushAccountToSupabase,
  pushPersonToSupabase,
} from '../supabaseSync';

// Helper to get ISO string for current date/time
const nowISO = () => new Date().toISOString();

export class LedgerEngine {
  /**
   * Idempotency Check: Verify if an operationId has already been executed.
   */
  static async isOperationProcessed(operationId: string): Promise<boolean> {
    const existing = await db.transactions.where('operationId').equals(operationId).first();
    return !!existing;
  }

  /**
   * 1. RECORD EXPENSE
   */
  static async recordExpense(params: {
    amountInPaise: number;
    accountId: string;
    categoryId?: string;
    date: string;
    note?: string;
    operationId?: string;
  }): Promise<Transaction> {
    const opId = params.operationId || uuidv4();

    const txResult = await db.transaction(
      'rw',
      [db.accounts, db.transactions, db.ledgerEntries],
      async () => {
        const existing = await db.transactions.where('operationId').equals(opId).first();
        if (existing) return existing;

        const txId = uuidv4();
        const timestamp = nowISO();

        const account = await db.accounts.get(params.accountId);
        if (!account) throw new Error('Account not found');

        const tx: Transaction = {
          id: txId,
          operationId: opId,
          type: 'expense',
          amountInPaise: params.amountInPaise,
          date: params.date,
          accountId: params.accountId,
          categoryId: params.categoryId,
          note: params.note,
          status: 'completed',
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        const outEntry: LedgerEntry = {
          id: uuidv4(),
          transactionId: txId,
          operationId: opId,
          accountId: params.accountId,
          entityType: 'account',
          entityId: params.accountId,
          amountInPaise: params.amountInPaise,
          direction: 'out',
          createdAt: timestamp,
        };

        const categoryEntry: LedgerEntry = {
          id: uuidv4(),
          transactionId: txId,
          operationId: opId,
          accountId: params.accountId,
          entityType: 'category',
          entityId: params.categoryId || 'uncategorized',
          amountInPaise: params.amountInPaise,
          direction: 'in',
          createdAt: timestamp,
        };

        await db.transactions.add(tx);
        await db.ledgerEntries.bulkAdd([outEntry, categoryEntry]);

        await db.accounts.update(params.accountId, {
          balanceInPaise: account.balanceInPaise - params.amountInPaise,
          updatedAt: timestamp,
        });

        return tx;
      }
    );

    // Sync with Supabase Cloud
    pushTransactionToSupabase(txResult).catch(console.error);
    db.accounts.get(params.accountId).then((acc) => {
      if (acc) pushAccountToSupabase(acc).catch(console.error);
    });

    return txResult;
  }

  /**
   * 2. RECORD INCOME / MONEY IN
   */
  static async recordIncome(params: {
    amountInPaise: number;
    accountId: string;
    sourceOfIncome?: string;
    categoryId?: string;
    date: string;
    note?: string;
    operationId?: string;
  }): Promise<Transaction> {
    const opId = params.operationId || uuidv4();

    const txResult = await db.transaction(
      'rw',
      [db.accounts, db.transactions, db.ledgerEntries],
      async () => {
        const existing = await db.transactions.where('operationId').equals(opId).first();
        if (existing) return existing;

        const txId = uuidv4();
        const timestamp = nowISO();

        const account = await db.accounts.get(params.accountId);
        if (!account) throw new Error('Account not found');

        const tx: Transaction = {
          id: txId,
          operationId: opId,
          type: 'income',
          amountInPaise: params.amountInPaise,
          date: params.date,
          accountId: params.accountId,
          categoryId: params.categoryId,
          sourceOfIncome: params.sourceOfIncome,
          note: params.note,
          status: 'completed',
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        const inEntry: LedgerEntry = {
          id: uuidv4(),
          transactionId: txId,
          operationId: opId,
          accountId: params.accountId,
          entityType: 'account',
          entityId: params.accountId,
          amountInPaise: params.amountInPaise,
          direction: 'in',
          createdAt: timestamp,
        };

        const sourceEntry: LedgerEntry = {
          id: uuidv4(),
          transactionId: txId,
          operationId: opId,
          accountId: params.accountId,
          entityType: 'income_source',
          entityId: params.sourceOfIncome || 'general',
          amountInPaise: params.amountInPaise,
          direction: 'out',
          createdAt: timestamp,
        };

        await db.transactions.add(tx);
        await db.ledgerEntries.bulkAdd([inEntry, sourceEntry]);

        await db.accounts.update(params.accountId, {
          balanceInPaise: account.balanceInPaise + params.amountInPaise,
          updatedAt: timestamp,
        });

        return tx;
      }
    );

    // Sync with Supabase Cloud
    pushTransactionToSupabase(txResult).catch(console.error);
    db.accounts.get(params.accountId).then((acc) => {
      if (acc) pushAccountToSupabase(acc).catch(console.error);
    });

    return txResult;
  }

  /**
   * 3. RECORD TRANSFER
   */
  static async recordTransfer(params: {
    amountInPaise: number;
    sourceAccountId: string;
    destinationAccountId: string;
    date: string;
    note?: string;
    isSavingsWithdrawal?: boolean;
    operationId?: string;
  }): Promise<Transaction> {
    if (params.sourceAccountId === params.destinationAccountId) {
      throw new Error('Source and destination accounts must be different');
    }

    const opId = params.operationId || uuidv4();

    const txResult = await db.transaction(
      'rw',
      [db.accounts, db.transactions, db.ledgerEntries],
      async () => {
        const existing = await db.transactions.where('operationId').equals(opId).first();
        if (existing) return existing;

        const txId = uuidv4();
        const timestamp = nowISO();

        const srcAccount = await db.accounts.get(params.sourceAccountId);
        const destAccount = await db.accounts.get(params.destinationAccountId);

        if (!srcAccount || !destAccount) throw new Error('Account not found');

        const type: TransactionType = params.isSavingsWithdrawal
          ? 'savings_withdrawal'
          : 'transfer';

        const tx: Transaction = {
          id: txId,
          operationId: opId,
          type,
          amountInPaise: params.amountInPaise,
          date: params.date,
          accountId: params.sourceAccountId,
          destinationAccountId: params.destinationAccountId,
          note: params.note,
          status: 'completed',
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        const outEntry: LedgerEntry = {
          id: uuidv4(),
          transactionId: txId,
          operationId: opId,
          accountId: params.sourceAccountId,
          entityType: 'account',
          entityId: params.sourceAccountId,
          amountInPaise: params.amountInPaise,
          direction: 'out',
          createdAt: timestamp,
        };

        const inEntry: LedgerEntry = {
          id: uuidv4(),
          transactionId: txId,
          operationId: opId,
          accountId: params.destinationAccountId,
          entityType: 'account',
          entityId: params.destinationAccountId,
          amountInPaise: params.amountInPaise,
          direction: 'in',
          createdAt: timestamp,
        };

        await db.transactions.add(tx);
        await db.ledgerEntries.bulkAdd([outEntry, inEntry]);

        await db.accounts.update(params.sourceAccountId, {
          balanceInPaise: srcAccount.balanceInPaise - params.amountInPaise,
          updatedAt: timestamp,
        });

        await db.accounts.update(params.destinationAccountId, {
          balanceInPaise: destAccount.balanceInPaise + params.amountInPaise,
          updatedAt: timestamp,
        });

        return tx;
      }
    );

    // Sync with Supabase Cloud
    pushTransactionToSupabase(txResult).catch(console.error);
    db.accounts.get(params.sourceAccountId).then((acc) => {
      if (acc) pushAccountToSupabase(acc).catch(console.error);
    });
    db.accounts.get(params.destinationAccountId).then((acc) => {
      if (acc) pushAccountToSupabase(acc).catch(console.error);
    });

    return txResult;
  }

  /**
   * 4. RECORD LENDING
   */
  static async recordLending(params: {
    amountInPaise: number;
    accountId: string;
    friendId: string;
    date: string;
    note?: string;
    operationId?: string;
  }): Promise<Transaction> {
    const opId = params.operationId || uuidv4();

    const txResult = await db.transaction(
      'rw',
      [db.accounts, db.transactions, db.ledgerEntries, db.people, db.debts],
      async () => {
        const existing = await db.transactions.where('operationId').equals(opId).first();
        if (existing) return existing;

        const txId = uuidv4();
        const timestamp = nowISO();

        const account = await db.accounts.get(params.accountId);
        const person = await db.people.get(params.friendId);

        if (!account) throw new Error('Account not found');
        if (!person) throw new Error('Friend not found');

        const tx: Transaction = {
          id: txId,
          operationId: opId,
          type: 'lending',
          amountInPaise: params.amountInPaise,
          date: params.date,
          accountId: params.accountId,
          friendId: params.friendId,
          note: params.note,
          status: 'completed',
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        const outAccountEntry: LedgerEntry = {
          id: uuidv4(),
          transactionId: txId,
          operationId: opId,
          accountId: params.accountId,
          entityType: 'account',
          entityId: params.accountId,
          amountInPaise: params.amountInPaise,
          direction: 'out',
          createdAt: timestamp,
        };

        const receivableEntry: LedgerEntry = {
          id: uuidv4(),
          transactionId: txId,
          operationId: opId,
          accountId: params.accountId,
          entityType: 'friend_receivable',
          entityId: params.friendId,
          amountInPaise: params.amountInPaise,
          direction: 'in',
          createdAt: timestamp,
        };

        const debt = {
          id: uuidv4(),
          transactionId: txId,
          personId: params.friendId,
          amountInPaise: params.amountInPaise,
          type: 'they_owe_me' as const,
          settledAmountInPaise: 0,
          status: 'pending' as const,
          note: params.note,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        await db.transactions.add(tx);
        await db.ledgerEntries.bulkAdd([outAccountEntry, receivableEntry]);
        await db.debts.add(debt);

        await db.accounts.update(params.accountId, {
          balanceInPaise: account.balanceInPaise - params.amountInPaise,
          updatedAt: timestamp,
        });

        await db.people.update(params.friendId, {
          netBalanceInPaise: person.netBalanceInPaise + params.amountInPaise,
          updatedAt: timestamp,
        });

        return tx;
      }
    );

    // Sync with Supabase Cloud
    pushTransactionToSupabase(txResult).catch(console.error);
    db.accounts.get(params.accountId).then((acc) => {
      if (acc) pushAccountToSupabase(acc).catch(console.error);
    });
    db.people.get(params.friendId).then((p) => {
      if (p) pushPersonToSupabase(p).catch(console.error);
    });

    return txResult;
  }

  /**
   * 5. RECORD BORROWING
   */
  static async recordBorrowing(params: {
    amountInPaise: number;
    accountId: string;
    friendId: string;
    date: string;
    note?: string;
    operationId?: string;
  }): Promise<Transaction> {
    const opId = params.operationId || uuidv4();

    const txResult = await db.transaction(
      'rw',
      [db.accounts, db.transactions, db.ledgerEntries, db.people, db.debts],
      async () => {
        const existing = await db.transactions.where('operationId').equals(opId).first();
        if (existing) return existing;

        const txId = uuidv4();
        const timestamp = nowISO();

        const account = await db.accounts.get(params.accountId);
        const person = await db.people.get(params.friendId);

        if (!account) throw new Error('Account not found');
        if (!person) throw new Error('Friend not found');

        const tx: Transaction = {
          id: txId,
          operationId: opId,
          type: 'borrowing',
          amountInPaise: params.amountInPaise,
          date: params.date,
          accountId: params.accountId,
          friendId: params.friendId,
          note: params.note,
          status: 'completed',
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        const inAccountEntry: LedgerEntry = {
          id: uuidv4(),
          transactionId: txId,
          operationId: opId,
          accountId: params.accountId,
          entityType: 'account',
          entityId: params.accountId,
          amountInPaise: params.amountInPaise,
          direction: 'in',
          createdAt: timestamp,
        };

        const payableEntry: LedgerEntry = {
          id: uuidv4(),
          transactionId: txId,
          operationId: opId,
          accountId: params.accountId,
          entityType: 'friend_payable',
          entityId: params.friendId,
          amountInPaise: params.amountInPaise,
          direction: 'out',
          createdAt: timestamp,
        };

        const debt = {
          id: uuidv4(),
          transactionId: txId,
          personId: params.friendId,
          amountInPaise: params.amountInPaise,
          type: 'i_owe_them' as const,
          settledAmountInPaise: 0,
          status: 'pending' as const,
          note: params.note,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        await db.transactions.add(tx);
        await db.ledgerEntries.bulkAdd([inAccountEntry, payableEntry]);
        await db.debts.add(debt);

        await db.accounts.update(params.accountId, {
          balanceInPaise: account.balanceInPaise + params.amountInPaise,
          updatedAt: timestamp,
        });

        await db.people.update(params.friendId, {
          netBalanceInPaise: person.netBalanceInPaise - params.amountInPaise,
          updatedAt: timestamp,
        });

        return tx;
      }
    );

    // Sync with Supabase Cloud
    pushTransactionToSupabase(txResult).catch(console.error);
    db.accounts.get(params.accountId).then((acc) => {
      if (acc) pushAccountToSupabase(acc).catch(console.error);
    });
    db.people.get(params.friendId).then((p) => {
      if (p) pushPersonToSupabase(p).catch(console.error);
    });

    return txResult;
  }

  /**
   * 6. RECORD REPAYMENT
   */
  static async recordRepayment(params: {
    amountInPaise: number;
    accountId: string;
    friendId: string;
    repaymentDirection: 'received' | 'paid';
    date: string;
    note?: string;
    operationId?: string;
  }): Promise<Transaction> {
    const opId = params.operationId || uuidv4();

    const txResult = await db.transaction(
      'rw',
      [db.accounts, db.transactions, db.ledgerEntries, db.people, db.debts],
      async () => {
        const existing = await db.transactions.where('operationId').equals(opId).first();
        if (existing) return existing;

        const txId = uuidv4();
        const timestamp = nowISO();

        const account = await db.accounts.get(params.accountId);
        const person = await db.people.get(params.friendId);

        if (!account) throw new Error('Account not found');
        if (!person) throw new Error('Friend not found');

        const isReceived = params.repaymentDirection === 'received';
        const type: TransactionType = isReceived ? 'repayment_received' : 'repayment_paid';

        const tx: Transaction = {
          id: txId,
          operationId: opId,
          type,
          amountInPaise: params.amountInPaise,
          date: params.date,
          accountId: params.accountId,
          friendId: params.friendId,
          note: params.note,
          status: 'completed',
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        const accountEntry: LedgerEntry = {
          id: uuidv4(),
          transactionId: txId,
          operationId: opId,
          accountId: params.accountId,
          entityType: 'account',
          entityId: params.accountId,
          amountInPaise: params.amountInPaise,
          direction: isReceived ? 'in' : 'out',
          createdAt: timestamp,
        };

        const friendEntry: LedgerEntry = {
          id: uuidv4(),
          transactionId: txId,
          operationId: opId,
          accountId: params.accountId,
          entityType: isReceived ? 'friend_receivable' : 'friend_payable',
          entityId: params.friendId,
          amountInPaise: params.amountInPaise,
          direction: isReceived ? 'out' : 'in',
          createdAt: timestamp,
        };

        await db.transactions.add(tx);
        await db.ledgerEntries.bulkAdd([accountEntry, friendEntry]);

        const newAccountBalance = isReceived
          ? account.balanceInPaise + params.amountInPaise
          : account.balanceInPaise - params.amountInPaise;

        await db.accounts.update(params.accountId, {
          balanceInPaise: newAccountBalance,
          updatedAt: timestamp,
        });

        const newNetBalance = isReceived
          ? person.netBalanceInPaise - params.amountInPaise
          : person.netBalanceInPaise + params.amountInPaise;

        await db.people.update(params.friendId, {
          netBalanceInPaise: newNetBalance,
          updatedAt: timestamp,
        });

        const pendingDebts = await db.debts
          .where('personId')
          .equals(params.friendId)
          .and(d => d.status !== 'paid')
          .toArray();

        let remainingRepayment = params.amountInPaise;
        const targetType = isReceived ? 'they_owe_me' : 'i_owe_them';

        for (const debt of pendingDebts) {
          if (debt.type !== targetType || remainingRepayment <= 0) continue;

          const debtOutstanding = debt.amountInPaise - debt.settledAmountInPaise;
          const apply = Math.min(debtOutstanding, remainingRepayment);

          const newSettled = debt.settledAmountInPaise + apply;
          const newStatus = newSettled >= debt.amountInPaise ? 'paid' : 'partially_paid';

          await db.debts.update(debt.id, {
            settledAmountInPaise: newSettled,
            status: newStatus,
            updatedAt: timestamp,
          });

          remainingRepayment -= apply;
        }

        return tx;
      }
    );

    // Sync with Supabase Cloud
    pushTransactionToSupabase(txResult).catch(console.error);
    db.accounts.get(params.accountId).then((acc) => {
      if (acc) pushAccountToSupabase(acc).catch(console.error);
    });
    db.people.get(params.friendId).then((p) => {
      if (p) pushPersonToSupabase(p).catch(console.error);
    });

    return txResult;
  }

  /**
   * 7. RECORD SPLIT BILL
   */
  static async recordSplitBill(params: {
    totalAmountInPaise: number;
    userShareInPaise: number;
    accountId?: string;
    payerType: 'user' | 'friend';
    paidByPersonId?: string;
    participants: { personId: string; shareInPaise: number }[];
    categoryId?: string;
    date: string;
    note?: string;
    operationId?: string;
  }): Promise<Transaction> {
    const opId = params.operationId || uuidv4();

    const totalParticipantShares =
      params.userShareInPaise +
      params.participants.reduce((sum, p) => sum + p.shareInPaise, 0);

    if (totalParticipantShares !== params.totalAmountInPaise) {
      throw new Error(
        `Invalid split: Participant shares sum (${totalParticipantShares / 100}) does not equal total bill (${params.totalAmountInPaise / 100})`
      );
    }

    if (params.payerType === 'user' && !params.accountId) {
      throw new Error('Account ID is required when user pays the bill');
    }

    if (params.payerType === 'friend' && !params.paidByPersonId) {
      throw new Error('Payer Person ID is required when friend pays the bill');
    }

    return await db.transaction(
      'rw',
      [
        db.accounts,
        db.transactions,
        db.ledgerEntries,
        db.people,
        db.debts,
        db.splitBills,
        db.splitParticipants,
      ],
      async () => {
        const existing = await db.transactions.where('operationId').equals(opId).first();
        if (existing) return existing;

        const txId = uuidv4();
        const splitBillId = uuidv4();
        const timestamp = nowISO();

        const tx: Transaction = {
          id: txId,
          operationId: opId,
          type: 'split_bill',
          amountInPaise: params.totalAmountInPaise,
          date: params.date,
          accountId: params.accountId || 'none',
          categoryId: params.categoryId,
          splitBillId,
          note: params.note,
          status: 'completed',
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        const splitBillRecord = {
          id: splitBillId,
          transactionId: txId,
          totalAmountInPaise: params.totalAmountInPaise,
          userShareInPaise: params.userShareInPaise,
          paidByPersonId: params.paidByPersonId,
          payerType: params.payerType,
          note: params.note,
          date: params.date,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        const ledgerEntriesToSave: LedgerEntry[] = [];
        const participantRecords: SplitParticipant[] = [];

        participantRecords.push({
          id: uuidv4(),
          splitBillId,
          personId: 'user',
          shareAmountInPaise: params.userShareInPaise,
          settledAmountInPaise: params.userShareInPaise,
          status: 'paid',
          createdAt: timestamp,
          updatedAt: timestamp,
        });

        if (params.payerType === 'user') {
          const account = await db.accounts.get(params.accountId!);
          if (!account) throw new Error('Account not found');

          ledgerEntriesToSave.push({
            id: uuidv4(),
            transactionId: txId,
            operationId: opId,
            accountId: params.accountId!,
            entityType: 'account',
            entityId: params.accountId!,
            amountInPaise: params.totalAmountInPaise,
            direction: 'out',
            createdAt: timestamp,
          });

          ledgerEntriesToSave.push({
            id: uuidv4(),
            transactionId: txId,
            operationId: opId,
            accountId: params.accountId!,
            entityType: 'category',
            entityId: params.categoryId || 'uncategorized',
            amountInPaise: params.userShareInPaise,
            direction: 'in',
            createdAt: timestamp,
          });

          await db.accounts.update(params.accountId!, {
            balanceInPaise: account.balanceInPaise - params.totalAmountInPaise,
            updatedAt: timestamp,
          });

          for (const p of params.participants) {
            const friend = await db.people.get(p.personId);
            if (!friend) continue;

            participantRecords.push({
              id: uuidv4(),
              splitBillId,
              personId: p.personId,
              shareAmountInPaise: p.shareInPaise,
              settledAmountInPaise: 0,
              status: 'pending',
              createdAt: timestamp,
              updatedAt: timestamp,
            });

            ledgerEntriesToSave.push({
              id: uuidv4(),
              transactionId: txId,
              operationId: opId,
              accountId: params.accountId!,
              entityType: 'friend_receivable',
              entityId: p.personId,
              amountInPaise: p.shareInPaise,
              direction: 'in',
              createdAt: timestamp,
            });

            await db.debts.add({
              id: uuidv4(),
              transactionId: txId,
              personId: p.personId,
              amountInPaise: p.shareInPaise,
              type: 'they_owe_me',
              settledAmountInPaise: 0,
              status: 'pending',
              note: `Split bill: ${params.note || 'Dinner/Expense'}`,
              createdAt: timestamp,
              updatedAt: timestamp,
            });

            await db.people.update(p.personId, {
              netBalanceInPaise: friend.netBalanceInPaise + p.shareInPaise,
              updatedAt: timestamp,
            });
          }
        } else {
          const friendPayer = await db.people.get(params.paidByPersonId!);
          if (!friendPayer) throw new Error('Friend payer not found');

          ledgerEntriesToSave.push({
            id: uuidv4(),
            transactionId: txId,
            operationId: opId,
            accountId: 'none',
            entityType: 'category',
            entityId: params.categoryId || 'uncategorized',
            amountInPaise: params.userShareInPaise,
            direction: 'in',
            createdAt: timestamp,
          });

          ledgerEntriesToSave.push({
            id: uuidv4(),
            transactionId: txId,
            operationId: opId,
            accountId: 'none',
            entityType: 'friend_payable',
            entityId: params.paidByPersonId!,
            amountInPaise: params.userShareInPaise,
            direction: 'out',
            createdAt: timestamp,
          });

          await db.debts.add({
            id: uuidv4(),
            transactionId: txId,
            personId: params.paidByPersonId!,
            amountInPaise: params.userShareInPaise,
            type: 'i_owe_them',
            settledAmountInPaise: 0,
            status: 'pending',
            note: `Split bill paid by ${friendPayer.name}: ${params.note || 'Expense'}`,
            createdAt: timestamp,
            updatedAt: timestamp,
          });

          await db.people.update(params.paidByPersonId!, {
            netBalanceInPaise: friendPayer.netBalanceInPaise - params.userShareInPaise,
            updatedAt: timestamp,
          });

          for (const p of params.participants) {
            participantRecords.push({
              id: uuidv4(),
              splitBillId,
              personId: p.personId,
              shareAmountInPaise: p.shareInPaise,
              settledAmountInPaise: p.personId === params.paidByPersonId ? p.shareInPaise : 0,
              status: p.personId === params.paidByPersonId ? 'paid' : 'pending',
              createdAt: timestamp,
              updatedAt: timestamp,
            });
          }
        }

        await db.transactions.add(tx);
        await db.splitBills.add(splitBillRecord);
        await db.splitParticipants.bulkAdd(participantRecords);
        await db.ledgerEntries.bulkAdd(ledgerEntriesToSave);

        return tx;
      }
    );
  }

  /**
   * 8. ADJUST ACCOUNT BALANCE MANUALLY
   * Enables user to edit/reconcile total money in an account directly.
   */
  static async adjustAccountBalance(params: {
    accountId: string;
    targetBalanceInPaise: number;
    date: string;
    note?: string;
    operationId?: string;
  }): Promise<Transaction> {
    const opId = params.operationId || uuidv4();

    const txResult = await db.transaction(
      'rw',
      [db.accounts, db.transactions, db.ledgerEntries],
      async () => {
        const existing = await db.transactions.where('operationId').equals(opId).first();
        if (existing) return existing;

        const txId = uuidv4();
        const timestamp = nowISO();

        const account = await db.accounts.get(params.accountId);
        if (!account) throw new Error('Account not found');

        const diff = params.targetBalanceInPaise - account.balanceInPaise;
        const absDiff = Math.abs(diff);

        const tx: Transaction = {
          id: txId,
          operationId: opId,
          type: 'balance_adjustment',
          amountInPaise: absDiff,
          date: params.date,
          accountId: params.accountId,
          note: params.note || `Manual balance adjustment to ${formatCurrency(params.targetBalanceInPaise)}`,
          status: 'completed',
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        const accountEntry: LedgerEntry = {
          id: uuidv4(),
          transactionId: txId,
          operationId: opId,
          accountId: params.accountId,
          entityType: 'account',
          entityId: params.accountId,
          amountInPaise: absDiff,
          direction: diff >= 0 ? 'in' : 'out',
          createdAt: timestamp,
        };

        const adjustmentEntry: LedgerEntry = {
          id: uuidv4(),
          transactionId: txId,
          operationId: opId,
          accountId: params.accountId,
          entityType: 'adjustment',
          entityId: 'reconciliation',
          amountInPaise: absDiff,
          direction: diff >= 0 ? 'out' : 'in',
          createdAt: timestamp,
        };

        await db.transactions.add(tx);
        await db.ledgerEntries.bulkAdd([accountEntry, adjustmentEntry]);

        await db.accounts.update(params.accountId, {
          balanceInPaise: params.targetBalanceInPaise,
          updatedAt: timestamp,
        });

        return tx;
      }
    );

    // Sync with Supabase Cloud
    pushTransactionToSupabase(txResult).catch(console.error);
    db.accounts.get(params.accountId).then((acc) => {
      if (acc) pushAccountToSupabase(acc).catch(console.error);
    });

    return txResult;
  }

  /**
   * 9. DELETE TRANSACTION WITH REVERSAL
   */
  static async deleteTransaction(transactionId: string): Promise<void> {
    return await db.transaction(
      'rw',
      [
        db.accounts,
        db.transactions,
        db.ledgerEntries,
        db.people,
        db.debts,
        db.splitBills,
        db.splitParticipants,
      ],
      async () => {
        const tx = await db.transactions.get(transactionId);
        if (!tx || tx.deletedAt) return;

        const timestamp = nowISO();
        const ledgerEntries = await db.ledgerEntries
          .where('transactionId')
          .equals(transactionId)
          .toArray();

        for (const entry of ledgerEntries) {
          if (entry.entityType === 'account' && entry.accountId !== 'none') {
            const account = await db.accounts.get(entry.accountId);
            if (account) {
              const reversedBalance =
                entry.direction === 'out'
                  ? account.balanceInPaise + entry.amountInPaise
                  : account.balanceInPaise - entry.amountInPaise;

              await db.accounts.update(entry.accountId, {
                balanceInPaise: reversedBalance,
                updatedAt: timestamp,
              });
            }
          }
        }

        const relatedDebts = await db.debts.where('transactionId').equals(transactionId).toArray();
        for (const debt of relatedDebts) {
          const friend = await db.people.get(debt.personId);
          if (friend) {
            const outstanding = debt.amountInPaise - debt.settledAmountInPaise;
            const reversedNetBalance =
              debt.type === 'they_owe_me'
                ? friend.netBalanceInPaise - outstanding
                : friend.netBalanceInPaise + outstanding;

            await db.people.update(debt.personId, {
              netBalanceInPaise: reversedNetBalance,
              updatedAt: timestamp,
            });
          }
          await db.debts.delete(debt.id);
        }

        if (tx.splitBillId) {
          const splitBill = await db.splitBills.get(tx.splitBillId);
          if (splitBill) {
            await db.splitParticipants
              .where('splitBillId')
              .equals(tx.splitBillId)
              .delete();
            await db.splitBills.delete(tx.splitBillId);
          }
        }

        await db.transactions.update(transactionId, {
          deletedAt: timestamp,
          updatedAt: timestamp,
        });
      }
    );
  }

  /**
   * 10. RECALCULATE & RECONCILE BALANCES
   */
  static async recalculateBalances(): Promise<{
    accountsUpdated: number;
    friendsUpdated: number;
  }> {
    return await db.transaction(
      'rw',
      [db.accounts, db.people, db.ledgerEntries, db.transactions, db.debts],
      async () => {
        const timestamp = nowISO();
        const activeTxs = await db.transactions.filter(t => !t.deletedAt).toArray();
        const activeTxIds = new Set(activeTxs.map(t => t.id));

        const accounts = await db.accounts.toArray();
        let accountsUpdated = 0;

        for (const account of accounts) {
          const entries = await db.ledgerEntries
            .where('accountId')
            .equals(account.id)
            .toArray();

          const activeEntries = entries.filter(e => activeTxIds.has(e.transactionId));

          let calculatedBalance = 0;
          for (const e of activeEntries) {
            if (e.entityType === 'account') {
              if (e.direction === 'in') calculatedBalance += e.amountInPaise;
              if (e.direction === 'out') calculatedBalance -= e.amountInPaise;
            }
          }

          if (account.balanceInPaise !== calculatedBalance) {
            await db.accounts.update(account.id, {
              balanceInPaise: calculatedBalance,
              updatedAt: timestamp,
            });
            accountsUpdated++;
          }
        }

        const friends = await db.people.toArray();
        let friendsUpdated = 0;

        for (const friend of friends) {
          const debts = await db.debts.where('personId').equals(friend.id).toArray();
          const activeDebts = debts.filter(d => activeTxIds.has(d.transactionId));

          let calculatedNet = 0;
          for (const d of activeDebts) {
            const outstanding = d.amountInPaise - d.settledAmountInPaise;
            if (d.type === 'they_owe_me') calculatedNet += outstanding;
            if (d.type === 'i_owe_them') calculatedNet -= outstanding;
          }

          if (friend.netBalanceInPaise !== calculatedNet) {
            await db.people.update(friend.id, {
              netBalanceInPaise: calculatedNet,
              updatedAt: timestamp,
            });
            friendsUpdated++;
          }
        }

        return { accountsUpdated, friendsUpdated };
      }
    );
  }

  /**
   * 11. CALCULATE MONTHLY FINANCIAL SUMMARY
   */
  static async calculateMonthlySummary(yearMonth: string): Promise<MonthlyFinancialSummary> {
    const transactions = await db.transactions
      .filter(t => !t.deletedAt && t.date.startsWith(yearMonth))
      .toArray();

    let totalExpensesInPaise = 0;
    let totalIncomeInPaise = 0;
    let totalReimbursementsInPaise = 0;
    let totalTransfersInPaise = 0;
    let totalLentInPaise = 0;
    let totalBorrowedInPaise = 0;
    let totalRepaymentsInPaise = 0;
    let totalSavedTransferredInPaise = 0;
    const categoryExpenses: Record<string, number> = {};

    for (const tx of transactions) {
      switch (tx.type) {
        case 'expense':
          totalExpensesInPaise += tx.amountInPaise;
          if (tx.categoryId) {
            categoryExpenses[tx.categoryId] =
              (categoryExpenses[tx.categoryId] || 0) + tx.amountInPaise;
          }
          break;
        case 'income':
          totalIncomeInPaise += tx.amountInPaise;
          break;
        case 'transfer':
          totalTransfersInPaise += tx.amountInPaise;
          break;
        case 'savings_withdrawal':
          totalSavedTransferredInPaise += tx.amountInPaise;
          break;
        case 'lending':
          totalLentInPaise += tx.amountInPaise;
          break;
        case 'borrowing':
          totalBorrowedInPaise += tx.amountInPaise;
          break;
        case 'repayment_received':
        case 'repayment_paid':
          totalRepaymentsInPaise += tx.amountInPaise;
          break;
        case 'split_bill': {
          if (tx.splitBillId) {
            const sb = await db.splitBills.get(tx.splitBillId);
            if (sb) {
              totalExpensesInPaise += sb.userShareInPaise;
              if (tx.categoryId) {
                categoryExpenses[tx.categoryId] =
                  (categoryExpenses[tx.categoryId] || 0) + sb.userShareInPaise;
              }
            }
          }
          break;
        }
        case 'reimbursement':
          totalReimbursementsInPaise += tx.amountInPaise;
          break;
        case 'balance_adjustment':
          // Adjustment is tracked in account balances, not categorized as spending or income
          break;
      }
    }

    return {
      yearMonth,
      totalExpensesInPaise,
      totalIncomeInPaise,
      totalReimbursementsInPaise,
      totalTransfersInPaise,
      totalLentInPaise,
      totalBorrowedInPaise,
      totalRepaymentsInPaise,
      totalSavedTransferredInPaise,
      categoryExpenses,
    };
  }
}
