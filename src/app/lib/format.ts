export function formatMoney(value: number): string {
  const amount = Number.isFinite(value) ? Math.round(value) : 0;
  const groupedInteger = Math.abs(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${amount < 0 ? '-' : ''}${groupedInteger}`;
}
