export function ArrowRightIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 10h12M11.5 5.5 16 10l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BellIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M10 3.5a3 3 0 0 0-3 3v1.1c0 .8-.2 1.6-.6 2.3l-1 1.7a1 1 0 0 0 .9 1.5h7.4a1 1 0 0 0 .9-1.5l-1-1.7a4.5 4.5 0 0 1-.6-2.3V6.5a3 3 0 0 0-3-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 15a1.8 1.8 0 0 0 3 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function GiftIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect
        x="4"
        y="10"
        width="16"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M12 10v10M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M9.2 10c-1.6 0-2.7-1-2.7-2.3 0-1.1.8-2 1.9-2 1.7 0 2.9 2.1 3.6 4.3H9.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M14.8 10c1.6 0 2.7-1 2.7-2.3 0-1.1-.8-2-1.9-2-1.7 0-2.9 2.1-3.6 4.3h2.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UserOutlineIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M10 10a2.75 2.75 0 1 0 0-5.5A2.75 2.75 0 0 0 10 10ZM5.5 15.5c.7-2.1 2.45-3.25 4.5-3.25s3.8 1.15 4.5 3.25"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ThemeIcon({
  className = "h-4 w-4",
  dark = false,
}: {
  className?: string;
  dark?: boolean;
}) {
  return dark ? (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M12.6 4.4a6.4 6.4 0 1 0 2.9 11.5 7.1 7.1 0 0 1-2.9-11.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="3.3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 2.5v1.9M10 15.6v1.9M17.5 10h-1.9M4.4 10H2.5M15.3 4.7l-1.3 1.3M6 14l-1.3 1.3M15.3 15.3 14 14M6 6 4.7 4.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SantaMarkIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="10 5 140 145"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`dashboard-santa-hat-${size}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e74c3c" />
          <stop offset="100%" stopColor="#c0392b" />
        </linearGradient>
      </defs>
      <circle cx="80" cy="82" r="50" fill="#fde8e8" />
      <ellipse cx="80" cy="108" rx="38" ry="24" fill="#fff" />
      <ellipse cx="80" cy="102" rx="32" ry="16" fill="#fff" />
      <ellipse cx="66" cy="86" rx="12" ry="6" fill="#fff" />
      <ellipse cx="94" cy="86" rx="12" ry="6" fill="#fff" />
      <circle cx="80" cy="76" r="5" fill="#e8a8a8" />
      <ellipse cx="64" cy="66" rx="5" ry="6" fill="#fff" />
      <ellipse cx="64" cy="67" rx="4" ry="5" fill="#2c1810" />
      <circle cx="62" cy="65" r="1.8" fill="#fff" />
      <path d="M90 66 Q96 60 102 66" fill="none" stroke="#2c1810" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M54 58 Q64 51 74 58" fill="none" stroke="#c4a090" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M86 58 Q96 51 106 58" fill="none" stroke="#c4a090" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="52" cy="78" rx="7" ry="5" fill="#f0a0a0" opacity=".3" />
      <ellipse cx="108" cy="78" rx="7" ry="5" fill="#f0a0a0" opacity=".3" />
      <rect x="76" y="84" width="9" height="26" rx="4.5" fill="#f8d0d0" stroke="#e8b8b8" strokeWidth=".8" />
      <path d="M32 58 C32 58 50 14 82 10 C114 6 128 58 128 58" fill={`url(#dashboard-santa-hat-${size})`} />
      <rect x="26" y="54" width="108" height="10" rx="5" fill="#fff" />
      <circle cx="86" cy="10" r="8" fill="#fff" />
    </svg>
  );
}

export function WishlistIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ChatIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M7 18.5 4.5 20V7a2.5 2.5 0 0 1 2.5-2.5h10A2.5 2.5 0 0 1 19.5 7v7a2.5 2.5 0 0 1-2.5 2.5H7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
