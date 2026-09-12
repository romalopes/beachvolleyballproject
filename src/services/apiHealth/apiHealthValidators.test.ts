import { describe, expect, it } from "vitest";
import {
  hasStatusOk,
  isAccountPayload,
  isAuthMePayload,
  isCategoryPayload,
  isDrillListPayload,
  isDrillPayload,
  isHealthyDetailedPayload,
  isMediaAssetListPayload,
  isMediaAssetPayload,
  isSkillListPayload,
  isSkillPayload,
  isTrainingSessionListPayload,
  isTrainingSessionPayload,
  isValidArray,
} from "./apiHealthValidators";

describe("apiHealthValidators", () => {
  it("hasStatusOk only passes on { status: 'ok' }", () => {
    expect(hasStatusOk({ status: "ok" })).toBe(true);
    expect(hasStatusOk({ status: "error" })).toBe(false);
    expect(hasStatusOk(null)).toBe(false);
    expect(hasStatusOk("ok")).toBe(false);
  });

  it("isHealthyDetailedPayload requires ok status and database", () => {
    expect(
      isHealthyDetailedPayload({ status: "ok", database: "ok" })
    ).toBe(true);
    expect(
      isHealthyDetailedPayload({ status: "ok", database: "error" })
    ).toBe(false);
    expect(isHealthyDetailedPayload({ status: "ok" })).toBe(false);
    expect(isHealthyDetailedPayload(undefined)).toBe(false);
  });

  it("isAuthMePayload matches the BVB /me shape", () => {
    expect(
      isAuthMePayload({
        id: 1,
        name: "Bea",
        email_address: "bea@example.com",
        roles: ["player"],
      })
    ).toBe(true);
    expect(
      isAuthMePayload({ id: 1, email_address: "bea@example.com" })
    ).toBe(false);
    expect(
      isAuthMePayload({ id: 1, email_address: "b@e.c", roles: "admin" })
    ).toBe(false);
  });

  it("isCategoryPayload validates { id, name, slug }", () => {
    expect(
      isCategoryPayload({ id: 1, name: "Serving", slug: "serving" })
    ).toBe(true);
    expect(isCategoryPayload({ id: 1, name: "Serving" })).toBe(false);
    expect(isCategoryPayload([])).toBe(false);
  });

  it("isSkillPayload validates { id, title, slug, category_id }", () => {
    expect(
      isSkillPayload({
        id: 1,
        title: "Serve",
        slug: "serve",
        category_id: 2,
      })
    ).toBe(true);
    expect(
      isSkillPayload({ id: 1, title: "Serve", slug: "serve" })
    ).toBe(false);
    expect(isSkillListPayload([{ id: 1 }])).toBe(false);
    expect(isSkillListPayload("nope")).toBe(false);
  });

  it("isDrillPayload rejects payloads leaking the raw definition", () => {
    const drill = {
      id: 1,
      title: "Side Out Race",
      slug: "side-out-race",
      skills: [],
    };
    expect(isDrillPayload(drill)).toBe(true);
    expect(isDrillPayload({ ...drill, definition: {} })).toBe(false);
    expect(isDrillPayload({ ...drill, skills: "x" })).toBe(false);
    expect(isDrillPayload({ id: 1, title: "x" })).toBe(false);
    expect(isDrillListPayload([drill])).toBe(true);
    expect(isDrillListPayload([{ ...drill, definition: {} }])).toBe(false);
  });

  it("validates training sessions and media assets lists", () => {
    const session = { id: 1, drill_id: 2, scheduled_at: "2026-01-01" };
    const asset = {
      id: 1,
      drill_id: 2,
      title: "Demo",
      video_url: "https://example.com/x.mp4",
    };
    expect(isTrainingSessionPayload(session)).toBe(true);
    expect(isTrainingSessionListPayload([session])).toBe(true);
    expect(isTrainingSessionListPayload([{ id: 1 }])).toBe(false);
    expect(isMediaAssetPayload(asset)).toBe(true);
    expect(isMediaAssetListPayload([asset])).toBe(true);
    expect(isMediaAssetListPayload([{ id: 1 }])).toBe(false);
    expect(isValidArray([])).toBe(true);
    expect(isValidArray({})).toBe(false);
  });

  it("isAccountPayload requires an address object", () => {
    expect(
      isAccountPayload({ id: 1, first_name: "Bea", address: { city: "Rio" } })
    ).toBe(true);
    expect(isAccountPayload({ id: 1 })).toBe(false);
    expect(isAccountPayload({ id: 1, address: "Rio" })).toBe(false);
  });
});
