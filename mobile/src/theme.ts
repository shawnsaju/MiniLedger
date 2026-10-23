// Ledger ("khata") feel: cool paper, slate ink, a red stamp for overdue, muted green for repaid.
export const colors = {
  paper: '#F1F4F1',
  card: '#FFFFFF',
  ink: '#1B2433',
  muted: '#667085',
  rule: '#DCE2DC',
  field: '#FAFBFA',

  stamp: '#BF3320', // overdue
  stampWash: '#FCEBE7',
  repaid: '#2B7A57',
  repaidWash: '#E5F1EA',
  pending: '#3C4A63', // money still out, not yet late
  disabled: '#A9B1BD',
  white: '#FFFFFF',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { field: 10, card: 14, pill: 999, bar: 5 };

export const type = {
  title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5, color: colors.ink },
  heading: { fontSize: 20, fontWeight: '700' as const, color: colors.ink },
  body: { fontSize: 16, color: colors.ink },
  label: { fontSize: 14, fontWeight: '600' as const, color: colors.ink },
  small: { fontSize: 13, color: colors.muted },
  // lined-up digits so amounts in a column are easy to compare
  amount: { fontVariant: ['tabular-nums' as const], fontWeight: '700' as const },
};
