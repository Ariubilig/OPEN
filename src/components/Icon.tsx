// A few tiny inline icons (no icon library).
const PATHS = {
  arrowLeft: 'M19 12H5M11 18l-6-6 6-6',
  externalLink:
    'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  chevronDown: 'M6 9l6 6 6-6',
  check: 'M5 13l4 4L19 7',
  close: 'M6 6l12 12M18 6L6 18',
} as const

export type IconName = keyof typeof PATHS

export default function Icon({
  name,
  className = 'size-4',
}: {
  name: IconName
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
