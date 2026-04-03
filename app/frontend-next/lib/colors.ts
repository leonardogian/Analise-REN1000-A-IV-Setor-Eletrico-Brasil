/** Paleta Iberdrola — espelho do app.js */

export const COLORS = {
  blue: '#1A8FE3',
  blueLight: '#4aa8ee',
  green: '#00C65A',
  amber: '#FF6B1A',
  red: '#ef4444',
  purple: '#8b5cf6',
  rose: '#ec4899',
  lime: '#A8D96B',
  orange: '#FF6B1A',
} as const;

export const DISTRIBUTOR_PALETTE = [
  '#00C65A',
  '#1A8FE3',
  '#FF6B1A',
  '#A8D96B',
  '#8b5cf6',
  '#ec4899',
  '#4aa8ee',
  '#ef4444',
  '#14b8a6',
  '#f59e0b',
] as const;

/** URL base da API — alterna entre local e produção */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8051';
