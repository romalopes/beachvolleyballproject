import type { ReactNode } from "react";
import PageHeader from "../PageHeader";
import BackLink from "./BackLink";

interface SettingsLayoutProps {
  title: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
  /** Fallback destination for the general back link when no explicit backTo is given. */
  backFallback?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function SettingsLayout({
  title,
  description,
  backTo,
  backLabel,
  backFallback,
  actions,
  children,
}: SettingsLayoutProps) {
  const showBack = backTo || backLabel || backFallback;

  return (
    <div className="page">
      {showBack && (
        <BackLink to={backTo} label={backLabel} fallback={backFallback ?? "/settings"} />
      )}
      <PageHeader title={title} description={description}>
        {actions}
      </PageHeader>
      {children}
    </div>
  );
}
