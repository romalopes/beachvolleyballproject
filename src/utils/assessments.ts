import type { Assessment, AssessmentStatus, User } from "../api";
import { canManageTrainings } from "./training";

export const ASSESSMENT_STATUSES: { value: AssessmentStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Published" },
  { value: "withdrawn", label: "Withdrawn" },
];

export function assessmentStatusLabel(status: AssessmentStatus): string {
  return ASSESSMENT_STATUSES.find((option) => option.value === status)?.label ?? status;
}

export function canViewAssessments(user: User | null | undefined): boolean {
  return canManageTrainings(user);
}

export function canManageAssessments(user: User | null | undefined): boolean {
  return Boolean(user?.roles?.some((role) => role === "coach" || role === "admin"));
}

export function assessmentRubricLabel(assessment: Assessment): string {
  return assessment.category?.name ?? assessment.custom_category ?? "Unspecified rubric";
}

export function assessmentRecorderLabel(assessment: Assessment): string {
  return assessment.created_by
    ? `Recorded by ${assessment.created_by.name}`
    : "Provenance not recorded";
}

export function isAssessmentOversight(user: User | null | undefined): boolean {
  return Boolean(user?.roles?.some((role) => role === "curator" || role === "admin"));
}

export function canEditAssessment(assessment: Assessment, user: User | null | undefined): boolean {
  return isAssessmentOversight(user) ||
    Boolean(user && (assessment.created_by?.id === user.id || assessment.coach_profile_id === user.coach_profile_id));
}

