type NotificationEnvelopeMarkProps = {
  className?: string;
  read?: boolean;
  type: string;
};

function getEnvelopeTone(type: string) {
  switch (type) {
    case "invite":
      return { accent: "#48664e", paper: "#f4faf4", seal: "#a43c3f" };
    case "chat":
      return { accent: "#186be8", paper: "#f4f8ff", seal: "#48664e" };
    case "draw":
    case "reveal":
      return { accent: "#7b5902", paper: "#fff7df", seal: "#a43c3f" };
    case "gift_received":
      return { accent: "#48664e", paper: "#f4faf4", seal: "#fcce72" };
    case "welcome":
      return { accent: "#48664e", paper: "#f4faf4", seal: "#d8a945" };
    case "reminder_event_tomorrow":
      return { accent: "#a43c3f", paper: "#fff0f0", seal: "#fcce72" };
    case "reminder_wishlist_incomplete":
    case "reminder_post_draw":
    case "reminder_digest":
      return { accent: "#48664e", paper: "#f8fbff", seal: "#fcce72" };
    case "affiliate_lazada_health":
      return { accent: "#7b5902", paper: "#fff8e8", seal: "#48664e" };
    default:
      return { accent: "#64748b", paper: "#f8fafc", seal: "#a43c3f" };
  }
}

export function NotificationEnvelopeMark({
  className = "h-6 w-6",
  read = false,
  type,
}: NotificationEnvelopeMarkProps) {
  const tone = getEnvelopeTone(type);
  const opacity = read ? 0.58 : 1;

  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path
        d="M9 16.5c0-2 1.6-3.5 3.5-3.5h23c1.9 0 3.5 1.5 3.5 3.5v17c0 1.9-1.6 3.5-3.5 3.5h-23A3.5 3.5 0 0 1 9 33.5v-17Z"
        fill={tone.paper}
        opacity={opacity}
      />
      <path
        d="M10.5 16.2 24 27.3l13.5-11.1M10.6 34.4 20.4 25M37.4 34.4 27.6 25"
        stroke={tone.accent}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
        opacity={read ? 0.55 : 0.92}
      />
      <path
        d="M12.5 13h23A3.5 3.5 0 0 1 39 16.5v17a3.5 3.5 0 0 1-3.5 3.5h-23A3.5 3.5 0 0 1 9 33.5v-17c0-2 1.6-3.5 3.5-3.5Z"
        stroke={tone.accent}
        strokeWidth="2"
        opacity={read ? 0.42 : 0.82}
      />
      <circle cx="34.5" cy="15.2" r="4.6" fill={tone.seal} opacity={read ? 0.45 : 1} />
      <path
        d="M33.1 15.2h2.8M34.5 13.8v2.8"
        stroke="#fffdf7"
        strokeLinecap="round"
        strokeWidth="1.3"
        opacity={read ? 0.6 : 1}
      />
    </svg>
  );
}
