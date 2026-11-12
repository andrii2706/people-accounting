/** 1250.5 → «1 250,50» (as on the invoices). */
export function money(amount: number): string {
  const [int, frac] = (Math.round(amount * 100) / 100).toFixed(2).split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${frac}`;
}
