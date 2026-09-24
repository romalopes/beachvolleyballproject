import type { ReactNode } from "react";
import { describe } from "../../utils/rating";

interface ScoreBadgeProps {
  score: number | null | undefined;
  children?: ReactNode;
}

export default function ScoreBadge({ score, children }: ScoreBadgeProps) {
  return (
    <span className="score-badge" title={describe(score)}>
      {describe(score)}
      {children}
    </span>
  );
}
