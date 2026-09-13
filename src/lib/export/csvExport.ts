import { db } from '../../db/schema';
import { paiseToRupees } from '../../utils/formatters';

export async function exportTransactionsToCSV(): Promise<string> {
  const transactions = await db.transactions.filter(t => !t.deletedAt).toArray();
  const accounts = new Map((await db.accounts.toArray()).map(a => [a.id, a.name]));
  const categories = new Map((await db.categories.toArray()).map(c => [c.id, c.name]));
  const people = new Map((await db.people.toArray()).map(p => [p.id, p.name]));

  const headers = [
    'Transaction ID',
    'Date',
    'Type',
    'Amount (INR)',
    'Account',
    'Category / Source',
    'Friend / Person',
    'Note',
    'Status',
  ];

  const rows = transactions.map(tx => {
    const accountName = accounts.get(tx.accountId) || 'N/A';
    const categoryName = tx.categoryId ? categories.get(tx.categoryId) || 'Uncategorized' : tx.sourceOfIncome || 'N/A';
    const friendName = tx.friendId ? people.get(tx.friendId) || 'N/A' : 'N/A';
    const amountInRupees = paiseToRupees(tx.amountInPaise).toFixed(2);

    return [
      `"${tx.id}"`,
      `"${tx.date}"`,
      `"${tx.type}"`,
      amountInRupees,
      `"${accountName}"`,
      `"${categoryName}"`,
      `"${friendName}"`,
      `"${(tx.note || '').replace(/"/g, '""')}"`,
      `"${tx.status}"`,
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  return csvContent;
}

export function downloadFile(content: string, fileName: string, contentType: string = 'text/csv') {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
