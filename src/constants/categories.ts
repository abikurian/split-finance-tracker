import type { Category } from '../types';

export const DEFAULT_EXPENSE_CATEGORIES: Omit<Category, 'createdAt' | 'updatedAt'>[] = [
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

export const DEFAULT_INCOME_CATEGORIES: Omit<Category, 'createdAt' | 'updatedAt'>[] = [
  { id: 'cat-income-allowance', name: 'Allowance', icon: 'HeartHandshake', type: 'income', isCustom: false, sortOrder: 1 },
  { id: 'cat-income-freelance', name: 'Freelance', icon: 'Laptop', type: 'income', isCustom: false, sortOrder: 2 },
  { id: 'cat-income-salary', name: 'Salary / Stipend', icon: 'Building', type: 'income', isCustom: false, sortOrder: 3 },
  { id: 'cat-income-other', name: 'Gifts & Other', icon: 'Gift', type: 'income', isCustom: false, sortOrder: 4 },
];

export function getDefaultCategoriesPayload(userId: string, timestamp = new Date().toISOString()) {
  if (!userId) {
    throw new Error('user_id is required to generate default categories payload.');
  }

  return [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES].map(c => ({
    id: `${userId}_${c.id}`,
    user_id: userId,
    name: c.name,
    icon: c.icon,
    type: c.type,
    is_custom: c.isCustom,
    sort_order: c.sortOrder,
    created_at: timestamp,
    updated_at: timestamp,
  }));
}
