interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  subtitle,
  children,
  className = '',
}: ChartCardProps) {
  return (
    <div className={`bg-[#18181b] rounded-xl border border-white/5 p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        {subtitle && (
          <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

/** Skeleton de loading — mesmo visual do styles.css atual */
export function ChartSkeleton({ rows = 1 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-48 bg-white/5 rounded-lg" />
      ))}
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
      <p className="text-sm text-red-400">{message}</p>
    </div>
  );
}
