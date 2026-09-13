import { describe, expect, it } from "vitest";
import { formatIssue, mapServerErrors } from "./errorMapping";

/**
 * The point of this module is that Rails' `errors.full_messages` strings and
 * the client-side validator converge on one `DrillSchemaIssue` shape, so the
 * editor can render both without branching.
 */

describe("mapServerErrors — schema messages", () => {
  it("extracts the JSON pointer and message from a schema error", () => {
    const [issue] = mapServerErrors([
      "Definition schema: /steps/0 — must be object",
    ]);
    expect(issue).toEqual({
      instancePath: "/steps/0",
      keyword: "schema",
      message: "must be object",
    });
  });

  it("maps Rails' \"root\" pointer to an empty instancePath", () => {
    const [issue] = mapServerErrors([
      "Definition schema: root — must be object",
    ]);
    expect(issue.instancePath).toBe("");
    expect(issue.keyword).toBe("schema");
  });

  it("keeps messages that themselves contain em dashes", () => {
    const [issue] = mapServerErrors([
      "Definition schema: /version — must be equal to constant — 1",
    ]);
    expect(issue.message).toBe("must be equal to constant — 1");
  });
});

describe("mapServerErrors — domain messages", () => {
  it("maps a domain error to the domain keyword with no path", () => {
    const [issue] = mapServerErrors([
      "Definition domain: duplicate participant id 'P1'",
    ]);
    expect(issue).toEqual({
      instancePath: "",
      keyword: "domain",
      message: "duplicate participant id 'P1'",
    });
  });
});

describe("mapServerErrors — other server errors", () => {
  it("falls through to the server keyword", () => {
    const [issue] = mapServerErrors(["Title can't be blank"]);
    expect(issue).toEqual({
      instancePath: "",
      keyword: "server",
      message: "Title can't be blank",
    });
  });

  it("preserves order and length for a mixed list", () => {
    const raw = [
      "Title can't be blank",
      "Definition schema: /court — must be object",
      "Definition domain: duplicate ball id 'B1'",
    ];
    const issues = mapServerErrors(raw);
    expect(issues).toHaveLength(3);
    expect(issues.map((i) => i.keyword)).toEqual(["server", "schema", "domain"]);
    expect(issues.map((i) => i.message)).toEqual([
      "Title can't be blank",
      "must be object",
      "duplicate ball id 'B1'",
    ]);
  });

  it("returns an empty list for no errors", () => {
    expect(mapServerErrors([])).toEqual([]);
  });
});

describe("formatIssue", () => {
  it("prefixes the instancePath", () => {
    expect(
      formatIssue({ instancePath: "/steps/0", keyword: "schema", message: "must be object" }),
    ).toBe("/steps/0: must be object");
  });

  it("labels a missing path as (root)", () => {
    expect(
      formatIssue({ instancePath: "", keyword: "domain", message: "bad reference" }),
    ).toBe("(root): bad reference");
  });
});
