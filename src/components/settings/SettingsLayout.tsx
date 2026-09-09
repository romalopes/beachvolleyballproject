import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import PageHeader from "../PageHeader";

interface SettingsLayoutProps {
  title: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function SettingsLayout({
  title,
  description,
  backTo,
  backLabel,
  actions,
  children,
}: SettingsLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="page">
      {backTo && (
        <button className="back-link" onClick={() => navigate(backTo)}>
          <ArrowLeft size={16} />
          {backLabel ?? "Back"}
        </button>
      )}
      <PageHeader title={title} description={description}>
        {actions}
      </PageHeader>
      {children}
    </div>
  );
}
