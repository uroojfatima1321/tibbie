interface Props { size?: 'sm' | 'md' | 'lg' }

export function Logo({ size = 'md' }: Props) {
  const cls = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl',
  }[size]
  return (
    <span className={`font-display font-semibold tracking-tight select-none ${cls} text-ink-900`}>
      <span className="italic">tibbie</span><span className="text-rust-500">.</span>
    </span>
  )
}
