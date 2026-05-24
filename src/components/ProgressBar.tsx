interface ProgressBarProps {
  percent: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  color?: string | null;
}

function getDefaultBarColor(percent: number): string {
  if (percent === 100) return '#10b981'; // emerald-500
  if (percent >= 70) return '#0088a8';  // brand ocean
  if (percent >= 40) return '#00b8d9';  // brand cyan
  return '#fbbf24';                      // amber-400
}

export default function ProgressBar({ percent, size = 'md', showLabel = false, color }: ProgressBarProps) {
  const clipped = Math.min(100, Math.max(0, percent));
  const barColor = color ?? getDefaultBarColor(clipped);
  const height = size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div className="flex items-center gap-3 w-full">
      <div className={`flex-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden ${height}`}>
        <div
          className={`${height} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${clipped}%`, backgroundColor: barColor }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 w-9 text-right tabular-nums">
          {clipped}%
        </span>
      )}
    </div>
  );
}
