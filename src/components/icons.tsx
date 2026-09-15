import type { CSSProperties } from "react";

type IconProps = { className?: string; style?: CSSProperties };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconGrid({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
    </svg>
  );
}

export function IconNetwork({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <circle cx="12" cy="4.5" r="2" />
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path d="M12 6.5v5M12 11.5 6.3 16.4M12 11.5l5.7 4.9" />
    </svg>
  );
}

export function IconUsers({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6" />
      <circle cx="17" cy="8.5" r="2.3" />
      <path d="M15.7 14.2c2.4.3 4.3 2.6 4.3 5.8" />
    </svg>
  );
}

export function IconFolder({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4l2 2.2h8A1.5 1.5 0 0 1 20.5 8.7v9.3A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18Z" />
    </svg>
  );
}

export function IconBell({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconDatabase({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.5" />
      <path d="M4.5 5.5V18c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5V5.5" />
      <path d="M4.5 11.75c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5" />
    </svg>
  );
}

export function IconSearch({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M19.5 19.5 15 15" />
    </svg>
  );
}

export function IconChevronRight({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M9 5.5 15.5 12 9 18.5" />
    </svg>
  );
}

export function IconChevronLeft({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M15 5.5 8.5 12 15 18.5" />
    </svg>
  );
}

export function IconHelp({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.2 2.7c-.5.2-.8.7-.8 1.3v.5" />
      <path d="M12 17.1h.01" />
    </svg>
  );
}

export function IconAlertTriangle({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M12 4 21 19.5H3Z" />
      <path d="M12 10v4.2" />
      <circle cx="12" cy="17.2" r="0.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconX({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconShield({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M12 3.5 19 6.5v5.2c0 5-3 8.3-7 9.8-4-1.5-7-4.8-7-9.8V6.5Z" />
    </svg>
  );
}

export function IconMapPin({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M12 21.5s7-6.6 7-12.2A7 7 0 0 0 5 9.3c0 5.6 7 12.2 7 12.2Z" />
      <circle cx="12" cy="9.3" r="2.5" />
    </svg>
  );
}

export function IconCamera({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M3.5 8.2A1.7 1.7 0 0 1 5.2 6.5h2.1l1.1-1.8h7.2l1.1 1.8h2.1a1.7 1.7 0 0 1 1.7 1.7v9.1a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7Z" />
      <circle cx="12" cy="12.5" r="3.6" />
    </svg>
  );
}

export function IconPlay({ className, style }: IconProps) {
  return (
    <svg {...base} fill="currentColor" stroke="none" className={className} style={style}>
      <path d="M8 5.5v13l11-6.5Z" />
    </svg>
  );
}

export function IconPause({ className, style }: IconProps) {
  return (
    <svg {...base} fill="currentColor" stroke="none" className={className} style={style}>
      <rect x="7" y="5.5" width="3.6" height="13" rx="0.8" />
      <rect x="13.4" y="5.5" width="3.6" height="13" rx="0.8" />
    </svg>
  );
}

export function IconTrendUp({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M4 16.5 10 10.5 14 14.5 20 8" />
      <path d="M14.5 8h5.5v5.5" />
    </svg>
  );
}

export function IconTrendDown({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M4 8 10 14 14 10 20 16.5" />
      <path d="M14.5 16.5h5.5V11" />
    </svg>
  );
}

export function IconChat({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M4 5.5h16v10.5H9.5L5 20v-4H4Z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </svg>
  );
}

export function IconLock({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="1.5" />
      <path d="M7.5 10.5V7.8a4.5 4.5 0 0 1 9 0v2.7" />
      <circle cx="12" cy="14.8" r="1.4" />
    </svg>
  );
}

export function IconScale({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M12 4v15" />
      <path d="M5 6h14" />
      <path d="M9 19h6" />
      <path d="M3.5 11.5 6 6l2.5 5.5a2.5 2.5 0 0 1-5 0Z" />
      <path d="M15.5 11.5 18 6l2.5 5.5a2.5 2.5 0 0 1-5 0Z" />
    </svg>
  );
}

export function IconTarget({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </svg>
  );
}

export function IconPlus({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
  );
}

export function IconMinus({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M5.5 12h13" />
    </svg>
  );
}

export function IconExternalLink({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}


export function IconMaximize({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M14 4h6v6" />
      <path d="M10 20H4v-6" />
      <path d="M20 4l-7.5 7.5" />
      <path d="M4 20l7.5-7.5" />
    </svg>
  );
}

export function IconHome({ className, style }: IconProps) {
  return (
    <svg {...base} className={className} style={style}>
      <path d="M4 11.5 12 4.5l8 7" />
      <path d="M5.5 10.5V19a1 1 0 0 0 1 1H10v-5h4v5h3.5a1 1 0 0 0 1-1v-8.5" />
    </svg>
  );
}
