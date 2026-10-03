import { describe, expect, it } from "vitest";
import type { Assessment, User } from "../api";
import { canEditAssessment } from "./assessments";

describe("canEditAssessment", () => {
  it("recognizes an assessment attributed to any of the user's coach profiles", () => {
    const user = {
      id: 4,
      name: "Alex Coach",
      email_address: "alex@example.com",
      roles: ["coach"],
      coach_profile_id: 7,
      coach_profile_ids: [7, 8],
    } as User;
    const assessment = {
      coach_profile_id: 8,
      created_by: { id: 9, name: "Another recorder" },
    } as Assessment;

    expect(canEditAssessment(assessment, user)).toBe(true);
  });
});
