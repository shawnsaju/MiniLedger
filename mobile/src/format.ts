import type { Loan } from './api';

export function money(n: number): string {
  return (
    '₹' +
    n.toLocaleString('en-IN', {
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-25" -> local Date. (new Date("2026-10-25") would parse as UTC and can shift a day.) */
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Local Date -> "2026-10-25". (toISOString() is UTC and can shift a day near midnight.) */
export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The status itself comes from the server; this only words it for the row. */
export function dueLabel(loan: Loan): string {
  if (loan.status === 'repaid' && loan.repaidAt) {
    return `Repaid on ${formatDate(new Date(loan.repaidAt))}`;
  }
  const due = parseYmd(loan.dueDate);
  const days = Math.round((due.getTime() - startOfToday().getTime()) / 86_400_000);
  if (loan.status === 'overdue') {
    // clamp: the server's "today" may be a day behind/ahead of the phone's
    return `Overdue by ${plural(Math.max(1, -days), 'day')}, was due ${formatDate(due)}`;
  }
  if (days === 0) return 'Due today';
  if (days === 1) return `Due tomorrow, ${formatDate(due)}`;
  return `Due ${formatDate(due)}, in ${plural(days, 'day')}`;
}
