import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  right?: ReactNode;
}

export default function PageHeader({ eyebrow, title, right }: PageHeaderProps) {
  return (
    <header className="topbar">
      <div className="topbar-heading">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
      </div>
      {right && <div className="topbar-right">{right}</div>}
    </header>
  );
}
