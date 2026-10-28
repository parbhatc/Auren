export const journalMoney = (value: number | null) =>
  value == null
    ? '—'
    : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value)
