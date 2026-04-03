interface KPICardProps {
  title: string;
  value: string;
  sub?: string;
  variant?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
}

const variants = {
  blue: 'border-[#1A8FE3]/30 bg-[#1A8FE3]/5 text-[#1A8FE3]',
  green: 'border-[#00C65A]/30 bg-[#00C65A]/5 text-[#00C65A]',
  amber: 'border-[#FF6B1A]/30 bg-[#FF6B1A]/5 text-[#FF6B1A]',
  red: 'border-red-500/30 bg-red-500/5 text-red-400',
  purple: 'border-purple-500/30 bg-purple-500/5 text-purple-400',
};

export function KPICard({ title, value, sub, variant = 'blue' }: KPICardProps) {
  return (
    <div
      className={`rounded-xl border p-4 ${variants[variant]} bg-[#18181b]`}
    >
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
        {title}
      </p>
      <p className={`text-2xl font-bold ${variants[variant].split(' ')[2]}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}
