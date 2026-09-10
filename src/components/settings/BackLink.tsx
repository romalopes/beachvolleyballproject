import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface BackLinkProps {
  /** Explicit destination. When omitted, goes back in history with fallback. */
  to?: string;
  label?: string;
  /** Where to go when there is no previous history entry. Defaults to /settings. */
  fallback?: string;
}

/**
 * General back link for Settings pages. Future pages can use <BackLink />
 * with no props to get "back to previous page, else /settings" for free.
 */
export default function BackLink({ to, label, fallback = "/settings" }: BackLinkProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) {
      navigate(to);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <button className="back-link" onClick={handleClick}>
      <ArrowLeft size={16} />
      {label ?? "Back"}
    </button>
  );
}
