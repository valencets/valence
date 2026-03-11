const formatter = new Intl.NumberFormat('en-US')

export function formatNumber (n: number): string {
  if (Number.isNaN(n) || !Number.isFinite(n)) return '--'
  return formatter.format(n)
}
