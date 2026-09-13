/**
 * Utility functions for monetary currency formatting using integer paise.
 * ₹1.00 = 100 paise
 */

export function rupeesToPaise(rupees: number): number {
  if (isNaN(rupees)) return 0;
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  if (isNaN(paise)) return 0;
  return paise / 100;
}

export function formatCurrency(paise: number, showDecimals: boolean = false): string {
  const rupees = paiseToRupees(paise);
  
  // Format with standard Indian numbering system format (en-IN)
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: showDecimals || (paise % 100 !== 0) ? 2 : 0,
    minimumFractionDigits: (paise % 100 !== 0) ? 2 : 0,
  });

  return formatter.format(rupees);
}

export function formatCompactCurrency(paise: number): string {
  const rupees = paiseToRupees(paise);
  if (Math.abs(rupees) >= 100000) {
    return `₹${(rupees / 100000).toFixed(1)}L`;
  }
  if (Math.abs(rupees) >= 1000) {
    return `₹${(rupees / 1000).toFixed(1)}k`;
  }
  return formatCurrency(paise);
}
