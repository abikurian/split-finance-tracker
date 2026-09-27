import { supabase } from './supabase';
import { db } from '../db/schema';
import type { Account, Category, Transaction, Person } from '../types';
import { getDefaultCategoriesPayload } from '../constants/categories';

/**
 * Get active Supabase User ID
 */
export async function getActiveUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id || null;
  } catch (err) {
    console.error('Error fetching active user ID:', err);
    return null;
  }
}

/**
 * Perform initial cloud sync from Supabase to local Dexie database
 */
export async function syncFromSupabase(userId: string): Promise<void> {
  if (!userId) return;

  try {
    // 1. Fetch Accounts from Supabase
    const { data: accountsData, error: accountsErr } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId);

    if (accountsErr) {
      console.warn('Error fetching accounts from Supabase:', accountsErr.message);
    }

    // 2. Fetch Categories from Supabase
    const { data: categoriesData, error: categoriesErr } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId);

    if (categoriesErr) {
      console.warn('Error fetching categories from Supabase:', categoriesErr.message);
    }

    // 3. Fetch Transactions from Supabase
    const { data: transactionsData, error: transactionsErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId);

    if (transactionsErr) {
      console.warn('Error fetching transactions from Supabase:', transactionsErr.message);
    }

    // 4. Fetch People (Friends) from Supabase
    const { data: peopleData, error: peopleErr } = await supabase
      .from('people')
      .select('*')
      .eq('user_id', userId);

    if (peopleErr) {
      console.warn('Error fetching people from Supabase:', peopleErr.message);
    }

    // Map fetched cloud records to Dexie schema (handling both snake_case and camelCase column names)
    const mappedAccounts: Account[] = (accountsData || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type || 'bank',
      balanceInPaise: row.balance_in_paise ?? row.balanceInPaise ?? 0,
      currency: row.currency || 'INR',
      icon: row.icon || 'Landmark',
      description: row.description,
      isPrimarySpending: row.is_primary_spending ?? row.isPrimarySpending ?? false,
      isSavings: row.is_savings ?? row.isSavings ?? false,
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
      syncStatus: 'synced',
      deletedAt: row.deleted_at || row.deletedAt || null,
    }));

    let mappedCategories: Category[] = (categoriesData || []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id || userId,
      name: row.name,
      icon: row.icon || 'Tag',
      type: row.type || 'expense',
      isCustom: row.is_custom ?? row.isCustom ?? false,
      sortOrder: row.sort_order ?? row.sortOrder ?? 0,
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
    }));

    // Safeguard: If user has 0 categories in Supabase, seed default categories for this user
    if (mappedCategories.length === 0 && userId) {
      const localCategories = await db.categories.toArray();
      if (localCategories.length > 0) {
        const payloadToPush = localCategories.map(cat => ({
          id: cat.id,
          user_id: userId,
          name: cat.name,
          icon: cat.icon,
          type: cat.type,
          is_custom: cat.isCustom,
          isCustom: cat.isCustom,
          sort_order: cat.sortOrder,
          sortOrder: cat.sortOrder,
          created_at: cat.createdAt,
          updated_at: cat.updatedAt,
        }));

        const { error: seedErr } = await supabase.from('categories').upsert(payloadToPush);
        if (seedErr) {
          console.error('Error syncing local categories to Supabase:', seedErr.message);
        } else {
          mappedCategories = localCategories.map(cat => ({
            ...cat,
            user_id: userId,
          }));
        }
      } else {
        const defaultPayload = getDefaultCategoriesPayload(userId);
        const { error: seedErr } = await supabase.from('categories').upsert(defaultPayload);
        if (seedErr) {
          console.error('Error seeding default categories to Supabase:', seedErr.message);
        } else {
          mappedCategories = defaultPayload.map(c => ({
            id: c.id,
            user_id: userId,
            name: c.name,
            icon: c.icon,
            type: c.type as any,
            isCustom: c.is_custom,
            sortOrder: c.sort_order,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
          }));
        }
      }
    }

    const mappedTransactions: Transaction[] = (transactionsData || []).map((row: any) => ({
      id: row.id,
      operationId: row.operation_id || row.operationId || row.id,
      type: row.type,
      amountInPaise: row.amount_in_paise ?? row.amountInPaise ?? 0,
      date: row.date || new Date().toISOString(),
      accountId: row.account_id || row.accountId,
      destinationAccountId: row.destination_account_id || row.destinationAccountId,
      categoryId: row.category_id || row.categoryId,
      friendId: row.friend_id || row.friendId,
      sourceOfIncome: row.source_of_income || row.sourceOfIncome,
      note: row.note,
      status: row.status || 'completed',
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
      deletedAt: row.deleted_at || row.deletedAt || null,
    }));

    const mappedPeople: Person[] = (peopleData || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      phone: row.phone,
      netBalanceInPaise: row.net_balance_in_paise ?? row.netBalanceInPaise ?? 0,
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
      deletedAt: row.deleted_at || row.deletedAt || null,
    }));

    // Update local Dexie database tables with cloud records using upsert (.bulkPut)
    await db.transaction('rw', [db.accounts, db.categories, db.transactions, db.people], async () => {
      if (mappedAccounts.length > 0) await db.accounts.bulkPut(mappedAccounts);
      if (mappedCategories.length > 0) await db.categories.bulkPut(mappedCategories);
      if (mappedTransactions.length > 0) await db.transactions.bulkPut(mappedTransactions);
      if (mappedPeople.length > 0) await db.people.bulkPut(mappedPeople);
    });

    console.log(`Cloud sync completed: ${mappedAccounts.length} accounts, ${mappedTransactions.length} transactions, ${mappedCategories.length} categories, ${mappedPeople.length} people.`);
  } catch (err) {
    console.error('Failed to sync data from Supabase:', err);
  }
}

/**
 * Persist Account record to Supabase
 */
export async function pushAccountToSupabase(account: Account, userId?: string): Promise<void> {
  const uid = userId || (await getActiveUserId());
  if (!uid) return;

  try {
    const payload = {
      id: account.id,
      user_id: uid,
      name: account.name,
      type: account.type,
      balance_in_paise: account.balanceInPaise,
      balanceInPaise: account.balanceInPaise,
      currency: account.currency,
      icon: account.icon,
      description: account.description || null,
      is_primary_spending: account.isPrimarySpending,
      isPrimarySpending: account.isPrimarySpending,
      is_savings: account.isSavings,
      isSavings: account.isSavings,
      created_at: account.createdAt,
      updated_at: account.updatedAt,
      deleted_at: account.deletedAt || null,
    };

    const { error } = await supabase.from('accounts').upsert(payload);
    if (error) {
      console.warn('Supabase account push warning:', error.message);
    }
  } catch (err) {
    console.error('Error pushing account to Supabase:', err);
  }
}

/**
 * Persist Category record to Supabase
 */
export async function pushCategoryToSupabase(category: Category, userId?: string): Promise<void> {
  const uid = userId || category.user_id || (await getActiveUserId());
  if (!uid) {
    console.warn('Cannot push category to Supabase: user_id is missing or undefined.');
    return;
  }

  try {
    const payload = {
      id: category.id,
      user_id: uid,
      name: category.name,
      icon: category.icon,
      type: category.type,
      is_custom: category.isCustom,
      isCustom: category.isCustom,
      sort_order: category.sortOrder,
      sortOrder: category.sortOrder,
      created_at: category.createdAt,
      updated_at: category.updatedAt,
    };

    const { error } = await supabase.from('categories').upsert(payload);
    if (error) {
      console.warn('Supabase category push warning:', error.message);
    }
  } catch (err) {
    console.error('Error pushing category to Supabase:', err);
  }
}

/**
 * Bulk persist Category records to Supabase
 */
export async function pushCategoriesToSupabase(categories: Category[], userId?: string): Promise<void> {
  const uid = userId || (await getActiveUserId());
  if (!uid) {
    console.warn('Cannot push categories to Supabase: user_id is missing or undefined.');
    return;
  }

  if (!categories || categories.length === 0) return;

  try {
    const payload = categories.map(category => ({
      id: category.id,
      user_id: category.user_id || uid,
      name: category.name,
      icon: category.icon,
      type: category.type,
      is_custom: category.isCustom,
      isCustom: category.isCustom,
      sort_order: category.sortOrder,
      sortOrder: category.sortOrder,
      created_at: category.createdAt,
      updated_at: category.updatedAt,
    }));

    const { error } = await supabase.from('categories').upsert(payload);
    if (error) {
      console.warn('Supabase categories bulk push warning:', error.message);
    }
  } catch (err) {
    console.error('Error pushing categories to Supabase:', err);
  }
}

/**
 * Persist Transaction record to Supabase
 */
export async function pushTransactionToSupabase(tx: Transaction, userId?: string): Promise<void> {
  const uid = userId || (await getActiveUserId());
  if (!uid) return;

  try {
    const payload = {
      id: tx.id,
      user_id: uid,
      operation_id: tx.operationId,
      operationId: tx.operationId,
      type: tx.type,
      amount_in_paise: tx.amountInPaise,
      amountInPaise: tx.amountInPaise,
      date: tx.date,
      account_id: tx.accountId,
      accountId: tx.accountId,
      destination_account_id: tx.destinationAccountId || null,
      destinationAccountId: tx.destinationAccountId || null,
      category_id: tx.categoryId || null,
      categoryId: tx.categoryId || null,
      friend_id: tx.friendId || null,
      friendId: tx.friendId || null,
      source_of_income: tx.sourceOfIncome || null,
      sourceOfIncome: tx.sourceOfIncome || null,
      note: tx.note || null,
      status: tx.status || 'completed',
      created_at: tx.createdAt,
      updated_at: tx.updatedAt,
      deleted_at: tx.deletedAt || null,
    };

    const { error } = await supabase.from('transactions').upsert(payload);
    if (error) {
      console.warn('Supabase transaction push warning:', error.message);
    }
  } catch (err) {
    console.error('Error pushing transaction to Supabase:', err);
  }
}

/**
 * Persist Person (Friend) record to Supabase
 */
export async function pushPersonToSupabase(person: Person, userId?: string): Promise<void> {
  const uid = userId || (await getActiveUserId());
  if (!uid) return;

  try {
    const payload = {
      id: person.id,
      user_id: uid,
      name: person.name,
      avatar: person.avatar || null,
      phone: person.phone || null,
      net_balance_in_paise: person.netBalanceInPaise,
      netBalanceInPaise: person.netBalanceInPaise,
      created_at: person.createdAt,
      updated_at: person.updatedAt,
      deleted_at: person.deletedAt || null,
    };

    const { error } = await supabase.from('people').upsert(payload);
    if (error) {
      console.warn('Supabase person push warning:', error.message);
    }
  } catch (err) {
    console.error('Error pushing person to Supabase:', err);
  }
}
