import type { AssessmentScale } from "../api";

export const SCALES: AssessmentScale[] = ["one_to_five", "one_to_ten", "one_to_hundred"];
export const DEFAULT_SCALE: AssessmentScale = "one_to_ten";

const ENTRY_VALUES: Record<AssessmentScale, Record<number, number>> = {
  one_to_five: { 1: 10, 2: 30, 3: 50, 4: 70, 5: 90 },
  one_to_ten: { 1: 10, 2: 20, 3: 30, 4: 40, 5: 50, 6: 60, 7: 70, 8: 80, 9: 90, 10: 100 },
  one_to_hundred: Object.fromEntries(Array.from({ length: 100 }, (_, index) => [index + 1, index + 1])),
};

export function legalValue(value: unknown, scale: AssessmentScale): boolean {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && ENTRY_VALUES[scale][number] != null;
}

export function toScore(value: number, scale: AssessmentScale): number {
  const score = ENTRY_VALUES[scale][value];
  if (score == null) throw new Error(`Value ${value} is outside the ${scale} scale`);
  return score;
}

export function toTen(score: number | null): number | null {
  return score == null ? null : Math.min(Math.trunc(score / 10), 10);
}

export function toFive(score: number | null): number | null {
  return score == null ? null : Math.min(Math.trunc(score / 20) + 1, 5);
}

export function describe(score: number | null | undefined): string {
  if (score == null) return "Not rated yet";
  return `${score}/100 · ${toTen(score)}/10 · ${toFive(score)}/5`;
}
