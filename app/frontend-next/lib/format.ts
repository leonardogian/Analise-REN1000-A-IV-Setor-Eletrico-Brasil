/** Equivalente TypeScript do utils.js — formatadores pt-BR */

export function fmtNum(v: number | null | undefined, d = 0): string {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export function fmtPct(v: number | null | undefined, d = 2): string {
  if (v == null || isNaN(v)) return '—';
  return (
    (Number(v) * 100).toLocaleString('pt-BR', {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }) + '%'
  );
}

export function fmtMoney(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  if (Math.abs(v) >= 1e6)
    return (
      'R$ ' +
      (v / 1e6).toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }) +
      'M'
    );
  if (Math.abs(v) >= 1e3)
    return (
      'R$ ' +
      (v / 1e3).toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }) +
      'k'
    );
  return (
    'R$ ' +
    Number(v).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function fmtVar(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  return (v > 0 ? '+' : '') + Number(v).toFixed(1) + '%';
}

export function safeSum(arr: (number | null | undefined)[]): number {
  return arr.reduce<number>((acc, v) => {
    if (v != null && Number.isFinite(v)) return acc + v;
    return acc;
  }, 0);
}
