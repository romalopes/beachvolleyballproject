import { useState } from "react";
import { ClipboardCopy } from "lucide-react";

interface CopyButtonProps {
  /** Text to write to the clipboard. */
  text: string;
  /** Button label shown before copying. Defaults to "Copy". */
  label?: string;
  /** Passed through so callers can stopPropagation (e.g. inside <summary>). */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Inline copy-to-clipboard button. Uses the async Clipboard API when available
 * and falls back to a hidden textarea + execCommand for private-mode / older
 * browsers. Shows `Copied!` feedback for 1.5s and is screen-reader friendly.
 */
export default function CopyButton({
  text,
  label = "Copy",
  onClick,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    };

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done, done);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) done();
    }
  };

  return (
    <button
      type="button"
      className={`copy-btn ${copied ? "copy-btn-copied" : ""}`}
      onClick={(e) => {
        onClick?.(e);
        copy();
      }}
      aria-live="polite"
      title={copied ? `${label}ed!` : `${label} to clipboard`}
    >
      <ClipboardCopy size={14} /> <span>{copied ? `${label}ed!` : label}</span>
    </button>
  );
}
