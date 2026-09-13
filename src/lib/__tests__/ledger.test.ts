import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../db/schema';
import { LedgerEngine } from '../ledger/ledgerEngine';
import { rupeesToPaise } from '../../utils/formatters';
import { validateJSONBackup, exportJSONBackup } from '../export/jsonBackup';

describe('Financial Engine & Ledger Invariants Test Suite', () => {
  const unionBankId = 'test-union-bank';
  const sliceId = 'test-slice';
  const rahulId = 'test-rahul';

  beforeEach(async () => {
    // Reset database state before each test
    await db.accounts.clear();
    await db.categories.clear();
    await db.transactions.clear();
    await db.ledgerEntries.clear();
    await db.people.clear();
    await db.debts.clear();
    await db.splitBills.clear();
    await db.splitParticipants.clear();

    const now = new Date().toISOString();

    // Create primary spending account (Union Bank) & savings account (Slice)
    await db.accounts.bulkAdd([
      {
        id: unionBankId,
        name: 'Union Bank',
        type: 'bank',
        balanceInPaise: rupeesToPaise(10000), // ₹10,000 initial
        currency: 'INR',
        icon: 'Landmark',
        isPrimarySpending: true,
        isSavings: false,
        syncStatus: 'synced',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: sliceId,
        name: 'Slice',
        type: 'savings',
        balanceInPaise: rupeesToPaise(20000), // ₹20,000 initial
        currency: 'INR',
        icon: 'PiggyBank',
        isPrimarySpending: false,
        isSavings: true,
        syncStatus: 'synced',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Create test friend (Rahul)
    await db.people.add({
      id: rahulId,
      name: 'Rahul',
      netBalanceInPaise: 0,
      createdAt: now,
      updatedAt: now,
    });
  });

  it('1. Expense Invariant: Expense reduces primary account and adds to monthly spending', async () => {
    await LedgerEngine.recordExpense({
      amountInPaise: rupeesToPaise(500),
      accountId: unionBankId,
      categoryId: 'food',
      date: '2026-09-12T10:00:00.000Z',
      note: 'Lunch',
    });

    const account = await db.accounts.get(unionBankId);
    expect(account?.balanceInPaise).toBe(rupeesToPaise(9500)); // ₹10,000 - ₹500 = ₹9,500

    const summary = await LedgerEngine.calculateMonthlySummary('2026-09');
    expect(summary.totalExpensesInPaise).toBe(rupeesToPaise(500));
  });

  it('2. Income Invariant: Income increases account balance and total income', async () => {
    await LedgerEngine.recordIncome({
      amountInPaise: rupeesToPaise(3000),
      accountId: unionBankId,
      sourceOfIncome: 'Freelance',
      date: '2026-09-12T11:00:00.000Z',
    });

    const account = await db.accounts.get(unionBankId);
    expect(account?.balanceInPaise).toBe(rupeesToPaise(13000)); // ₹10,000 + ₹3,000 = ₹13,000

    const summary = await LedgerEngine.calculateMonthlySummary('2026-09');
    expect(summary.totalIncomeInPaise).toBe(rupeesToPaise(3000));
  });

  it('3. Transfer Invariant: Self-transfer moves money without altering Total Wealth or creating Expense/Income', async () => {
    await LedgerEngine.recordTransfer({
      amountInPaise: rupeesToPaise(2000),
      sourceAccountId: unionBankId,
      destinationAccountId: sliceId,
      date: '2026-09-12T12:00:00.000Z',
    });

    const unionAcc = await db.accounts.get(unionBankId);
    const sliceAcc = await db.accounts.get(sliceId);

    expect(unionAcc?.balanceInPaise).toBe(rupeesToPaise(8000)); // ₹10,000 - ₹2,000
    expect(sliceAcc?.balanceInPaise).toBe(rupeesToPaise(22000)); // ₹20,000 + ₹2,000

    // Total Wealth = ₹8,000 + ₹22,000 = ₹30,000 (Unchanged!)
    const totalWealth = (unionAcc?.balanceInPaise || 0) + (sliceAcc?.balanceInPaise || 0);
    expect(totalWealth).toBe(rupeesToPaise(30000));

    const summary = await LedgerEngine.calculateMonthlySummary('2026-09');
    expect(summary.totalExpensesInPaise).toBe(0);
    expect(summary.totalIncomeInPaise).toBe(0);
  });

  it('4. Savings Withdrawal Invariant: Moving money out of Slice to Union Bank does NOT count as Income', async () => {
    await LedgerEngine.recordTransfer({
      amountInPaise: rupeesToPaise(1500),
      sourceAccountId: sliceId,
      destinationAccountId: unionBankId,
      isSavingsWithdrawal: true,
      date: '2026-09-12T12:30:00.000Z',
    });

    const unionAcc = await db.accounts.get(unionBankId);
    const sliceAcc = await db.accounts.get(sliceId);

    expect(unionAcc?.balanceInPaise).toBe(rupeesToPaise(11500));
    expect(sliceAcc?.balanceInPaise).toBe(rupeesToPaise(18500));

    const summary = await LedgerEngine.calculateMonthlySummary('2026-09');
    expect(summary.totalIncomeInPaise).toBe(0);
  });

  it('5. Lending & Repayment Invariant: Lending is NOT spending, Repayment is NOT income', async () => {
    // Lend ₹1,000 to Rahul
    await LedgerEngine.recordLending({
      amountInPaise: rupeesToPaise(1000),
      accountId: unionBankId,
      friendId: rahulId,
      date: '2026-09-12T13:00:00.000Z',
    });

    let unionAcc = await db.accounts.get(unionBankId);
    let rahul = await db.people.get(rahulId);

    expect(unionAcc?.balanceInPaise).toBe(rupeesToPaise(9000));
    expect(rahul?.netBalanceInPaise).toBe(rupeesToPaise(1000)); // Rahul owes me ₹1,000

    let summary = await LedgerEngine.calculateMonthlySummary('2026-09');
    expect(summary.totalExpensesInPaise).toBe(0); // 0 spending recorded!

    // Rahul repays ₹1,000
    await LedgerEngine.recordRepayment({
      amountInPaise: rupeesToPaise(1000),
      accountId: unionBankId,
      friendId: rahulId,
      repaymentDirection: 'received',
      date: '2026-09-12T14:00:00.000Z',
    });

    unionAcc = await db.accounts.get(unionBankId);
    rahul = await db.people.get(rahulId);

    expect(unionAcc?.balanceInPaise).toBe(rupeesToPaise(10000));
    expect(rahul?.netBalanceInPaise).toBe(0); // Debt settled

    summary = await LedgerEngine.calculateMonthlySummary('2026-09');
    expect(summary.totalIncomeInPaise).toBe(0); // 0 income recorded!
  });

  it('6. Borrowing & Repayment Invariant: Borrowing is NOT income, Repayment is NOT expense', async () => {
    // Borrow ₹500 from Rahul
    await LedgerEngine.recordBorrowing({
      amountInPaise: rupeesToPaise(500),
      accountId: unionBankId,
      friendId: rahulId,
      date: '2026-09-12T15:00:00.000Z',
    });

    let unionAcc = await db.accounts.get(unionBankId);
    let rahul = await db.people.get(rahulId);

    expect(unionAcc?.balanceInPaise).toBe(rupeesToPaise(10500));
    expect(rahul?.netBalanceInPaise).toBe(-rupeesToPaise(500)); // I owe Rahul ₹500

    let summary = await LedgerEngine.calculateMonthlySummary('2026-09');
    expect(summary.totalIncomeInPaise).toBe(0);

    // Pay Rahul back ₹500
    await LedgerEngine.recordRepayment({
      amountInPaise: rupeesToPaise(500),
      accountId: unionBankId,
      friendId: rahulId,
      repaymentDirection: 'paid',
      date: '2026-09-12T16:00:00.000Z',
    });

    unionAcc = await db.accounts.get(unionBankId);
    rahul = await db.people.get(rahulId);

    expect(unionAcc?.balanceInPaise).toBe(rupeesToPaise(10000));
    expect(rahul?.netBalanceInPaise).toBe(0);

    summary = await LedgerEngine.calculateMonthlySummary('2026-09');
    expect(summary.totalExpensesInPaise).toBe(0);
  });

  it('7. Split Bill Invariant (User Paid Full): User expense = share only, Friend share = Receivable', async () => {
    // Total ₹1,200. User share ₹300, Rahul share ₹900
    await LedgerEngine.recordSplitBill({
      totalAmountInPaise: rupeesToPaise(1200),
      userShareInPaise: rupeesToPaise(300),
      accountId: unionBankId,
      payerType: 'user',
      date: '2026-09-12T17:00:00.000Z',
      participants: [{ personId: rahulId, shareInPaise: rupeesToPaise(900) }],
    });

    const unionAcc = await db.accounts.get(unionBankId);
    const rahul = await db.people.get(rahulId);

    expect(unionAcc?.balanceInPaise).toBe(rupeesToPaise(8800)); // ₹10,000 - ₹1,200 = ₹8,800
    expect(rahul?.netBalanceInPaise).toBe(rupeesToPaise(900)); // Rahul owes me ₹900

    const summary = await LedgerEngine.calculateMonthlySummary('2026-09');
    expect(summary.totalExpensesInPaise).toBe(rupeesToPaise(300)); // Only user share ₹300 counted as expense!
  });

  it('8. Split Bill Invariant (Someone Else Paid): Bank account UNCHANGED, User debt increases', async () => {
    // Rahul pays ₹1,200. User share ₹300.
    await LedgerEngine.recordSplitBill({
      totalAmountInPaise: rupeesToPaise(1200),
      userShareInPaise: rupeesToPaise(300),
      payerType: 'friend',
      paidByPersonId: rahulId,
      date: '2026-09-12T18:00:00.000Z',
      participants: [{ personId: rahulId, shareInPaise: rupeesToPaise(900) }],
    });

    const unionAcc = await db.accounts.get(unionBankId);
    const rahul = await db.people.get(rahulId);

    expect(unionAcc?.balanceInPaise).toBe(rupeesToPaise(10000)); // Bank balance UNCHANGED!
    expect(rahul?.netBalanceInPaise).toBe(-rupeesToPaise(300)); // User owes Rahul ₹300
  });

  it('9. Custom Split Validation: Throws error if participant shares do not sum to total bill', async () => {
    await expect(
      LedgerEngine.recordSplitBill({
        totalAmountInPaise: rupeesToPaise(1200),
        userShareInPaise: rupeesToPaise(300),
        accountId: unionBankId,
        payerType: 'user',
        date: '2026-09-12T19:00:00.000Z',
        participants: [{ personId: rahulId, shareInPaise: rupeesToPaise(800) }], // 300 + 800 = 1100 != 1200
      })
    ).rejects.toThrow();
  });

  it('10. Idempotency Check: Duplicate operationId does not execute twice', async () => {
    const opId = 'unique-op-id-123';

    await LedgerEngine.recordExpense({
      amountInPaise: rupeesToPaise(500),
      accountId: unionBankId,
      date: '2026-09-12T20:00:00.000Z',
      operationId: opId,
    });

    // Re-apply exact same operationId
    await LedgerEngine.recordExpense({
      amountInPaise: rupeesToPaise(500),
      accountId: unionBankId,
      date: '2026-09-12T20:00:00.000Z',
      operationId: opId,
    });

    const account = await db.accounts.get(unionBankId);
    expect(account?.balanceInPaise).toBe(rupeesToPaise(9500)); // Reduced ONLY ONCE!
  });

  it('11. Deletion & Reversal Invariant: Deleting expense restores account balance', async () => {
    const tx = await LedgerEngine.recordExpense({
      amountInPaise: rupeesToPaise(400),
      accountId: unionBankId,
      date: '2026-09-12T21:00:00.000Z',
    });

    let account = await db.accounts.get(unionBankId);
    expect(account?.balanceInPaise).toBe(rupeesToPaise(9600));

    await LedgerEngine.deleteTransaction(tx.id);

    account = await db.accounts.get(unionBankId);
    expect(account?.balanceInPaise).toBe(rupeesToPaise(10000)); // Restored to ₹10,000!

    const summary = await LedgerEngine.calculateMonthlySummary('2026-09');
    expect(summary.totalExpensesInPaise).toBe(0);
  });

  it('12. Historical August 2026 Entry: Correctly attributes historical entry to August 2026', async () => {
    await LedgerEngine.recordExpense({
      amountInPaise: rupeesToPaise(750),
      accountId: unionBankId,
      date: '2026-08-15T12:00:00.000Z',
    });

    const augustSummary = await LedgerEngine.calculateMonthlySummary('2026-08');
    const septemberSummary = await LedgerEngine.calculateMonthlySummary('2026-09');

    expect(augustSummary.totalExpensesInPaise).toBe(rupeesToPaise(750));
    expect(septemberSummary.totalExpensesInPaise).toBe(0);
  });

  it('13. Backup Validation: Rejects malformed JSON and validates valid backups', async () => {
    const jsonStr = await exportJSONBackup();
    const validRes = validateJSONBackup(jsonStr);

    expect(validRes.result.isValid).toBe(true);

    const invalidRes = validateJSONBackup('{"invalid": true}');
    expect(invalidRes.result.isValid).toBe(false);
  });
});
