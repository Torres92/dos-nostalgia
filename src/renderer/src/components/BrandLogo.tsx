/** Inline brand mark — avoids Vite SVG asset URL issues in Electron. */
export function BrandLogo({
  className,
  title = 'DOS Nostalgia'
}: {
  className?: string
  title?: string
}): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <rect width="64" height="64" fill="#0000AA" />
      <rect x="3" y="3" width="58" height="58" fill="none" stroke="#FFFFFF" strokeWidth="3" />
      <rect x="8" y="8" width="48" height="12" fill="#C0C0C0" />
      <rect x="11" y="11" width="6" height="6" fill="#0000AA" />
      <rect x="19" y="11" width="6" height="6" fill="#AA0000" />
      <rect x="27" y="11" width="6" height="6" fill="#00AA00" />
      <text
        x="32"
        y="42"
        textAnchor="middle"
        fill="#FFFF55"
        fontFamily="VT323, Courier New, monospace"
        fontSize="18"
        fontWeight="700"
      >
        DN
      </text>
      <rect x="28" y="48" width="8" height="8" fill="#55FFFF" />
    </svg>
  )
}
