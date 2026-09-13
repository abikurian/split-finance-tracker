export type TimeframeMode = 'day' | 'month' | 'year';

export function formatTimeframeLabel(
  mode: TimeframeMode,
  selectedDate: string, // YYYY-MM-DD
  selectedMonth: string, // YYYY-MM
  selectedYear: string // YYYY
): string {
  if (mode === 'day') {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    return dateObj.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  if (mode === 'month') {
    const [year, month] = selectedMonth.split('-').map(Number);
    const dateObj = new Date(year, month - 1, 1);
    return dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  return selectedYear;
}

export function navigateTimeframe(
  mode: TimeframeMode,
  direction: 'prev' | 'next',
  selectedDate: string,
  selectedMonth: string,
  selectedYear: string
): { date: string; month: string; year: string } {
  if (mode === 'day') {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + (direction === 'next' ? 1 : -1));

    const newYear = String(dateObj.getFullYear());
    const newMonthNum = String(dateObj.getMonth() + 1).padStart(2, '0');
    const newDayNum = String(dateObj.getDate()).padStart(2, '0');

    const newMonth = `${newYear}-${newMonthNum}`;
    const newDate = `${newMonth}-${newDayNum}`;

    return { date: newDate, month: newMonth, year: newYear };
  }

  if (mode === 'month') {
    const [y, m] = selectedMonth.split('-').map(Number);
    const dateObj = new Date(y, m - 1 + (direction === 'next' ? 1 : -1), 1);

    const newYear = String(dateObj.getFullYear());
    const newMonthNum = String(dateObj.getMonth() + 1).padStart(2, '0');
    const newMonth = `${newYear}-${newMonthNum}`;
    const newDate = `${newMonth}-01`;

    return { date: newDate, month: newMonth, year: newYear };
  }

  const yNum = Number(selectedYear) + (direction === 'next' ? 1 : -1);
  const newYear = String(yNum);
  const newMonth = `${newYear}-01`;
  const newDate = `${newYear}-01-01`;

  return { date: newDate, month: newMonth, year: newYear };
}
