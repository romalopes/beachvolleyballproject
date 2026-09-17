import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiValidationError, setToken } from "./api";

const TOKEN_KEY = "bvb_api_token";

function mockFetchOnce(response: {
  ok: boolean;
  status: number;
  body?: unknown;
}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: () =>
      response.body === undefined
        ? Promise.reject(new Error("No body"))
        : Promise.resolve(response.body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("setToken", () => {
  it("stores and removes the API token", () => {
    setToken("abc123");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("abc123");
    setToken(null);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

describe("auth headers", () => {
  it("sends the bearer token when one is stored", async () => {
    setToken("secret-token");
    const fetchMock = mockFetchOnce({ ok: true, status: 200, body: [] });
    await api.categories();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(
      (init.headers as Record<string, string>)["Authorization"]
    ).toBe("Bearer secret-token");
  });

  it("omits the Authorization header when no token is stored", async () => {
    const fetchMock = mockFetchOnce({ ok: true, status: 200, body: [] });
    await api.drills();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(
      (init.headers as Record<string, string>)["Authorization"]
    ).toBeUndefined();
  });
});

describe("fetchAPI (GET helpers)", () => {
  it("returns parsed JSON on success", async () => {
    const skills = [{ id: 1, title: "Serve" }];
    mockFetchOnce({ ok: true, status: 200, body: skills });
    await expect(api.skills()).resolves.toEqual(skills);
  });

  it("throws an API Error with the status on failure", async () => {
    mockFetchOnce({ ok: false, status: 404, body: {} });
    await expect(api.drills()).rejects.toThrow("API Error: 404");
  });
});

describe("postJSON (auth + mutations)", () => {
  it("login stores the returned token and returns the user", async () => {
    const user = {
      id: 1,
      name: "Bea",
      email_address: "bea@example.com",
      roles: ["player"],
      token: "login-token",
    };
    mockFetchOnce({ ok: true, status: 200, body: user });
    await expect(api.login("bea@example.com", "password123")).resolves.toEqual(
      user
    );
    expect(localStorage.getItem(TOKEN_KEY)).toBe("login-token");
  });

  it("register stores the returned token", async () => {
    const user = {
      id: 2,
      name: "New",
      email_address: "new@example.com",
      roles: ["player"],
      token: "register-token",
    };
    mockFetchOnce({ ok: true, status: 201, body: user });
    await api.register("New", "new@example.com", "password123", "password123");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("register-token");
  });

  it("logout clears the stored token", async () => {
    setToken("old-token");
    // DELETE /sessions returns 204 with no body.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error("No body")),
    });
    vi.stubGlobal("fetch", fetchMock);
    await api.logout();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("surfaces backend validation errors joined into one message", async () => {
    mockFetchOnce({
      ok: false,
      status: 422,
      body: { errors: ["Title can't be blank", "Stage is invalid"] },
    });
    await expect(
      api.requestPasswordReset("x@example.com")
    ).rejects.toThrow("Title can't be blank. Stage is invalid");
  });

  it("surfaces a singular backend error message", async () => {
    mockFetchOnce({
      ok: false,
      status: 401,
      body: { error: "Invalid email address or password." },
    });
    await expect(api.login("a@b.c", "wrong")).rejects.toThrow(
      "Invalid email address or password."
    );
  });

  it("falls back to the HTTP status when the error body is empty", async () => {
    mockFetchOnce({ ok: false, status: 500 });
    await expect(api.account()).rejects.toThrow("API Error: 500");
  });
});

describe("ApiValidationError", () => {
  it("carries the individual error strings for structured mapping", async () => {
    const errors = ["Title can't be blank", "Definition schema: /side — bad"];
    mockFetchOnce({ ok: false, status: 422, body: { errors } });
    const rejection = await api.requestPasswordReset("x@example.com").catch(
      (e: unknown) => e
    );
    expect(rejection).toBeInstanceOf(ApiValidationError);
    expect((rejection as ApiValidationError).errors).toEqual(errors);
    expect((rejection as ApiValidationError).name).toBe("ApiValidationError");
  });

  it("joins the errors into the message for plain `String(err)` display", async () => {
    mockFetchOnce({
      ok: false,
      status: 422,
      body: { errors: ["A", "B"] },
    });
    await expect(api.requestPasswordReset("x@example.com")).rejects.toThrow("A. B");
  });

  it("is not thrown for a singular { error } body", async () => {
    mockFetchOnce({ ok: false, status: 404, body: { error: "Drill not found" } });
    const rejection = await api.drill("nope").catch((e: unknown) => e);
    expect(rejection).toBeInstanceOf(Error);
    expect(rejection).not.toBeInstanceOf(ApiValidationError);
  });
});

describe("admin drill definition payloads", () => {
  const definition = {
    version: 1 as const,
    side: { grid: { columns: 5, rows: 4 } },
    participants: [],
    balls: [],
    objects: [],
    steps: [],
  };

  it("includes the definition when creating a drill", async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      status: 201,
      body: { id: 1, slug: "d" },
    });
    await api.adminCreateDrill({
      title: "Drill",
      training_stage: "warmup",
      difficulty_level: "beginner",
      min_players: 2,
      max_players: 4,
      ideal_num_players: 2,
      definition,
      skill_ids: [1],
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      drill: expect.objectContaining({ definition }),
    });
  });

  it("forwards a null definition as an explicit clear", async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      status: 200,
      body: { id: 1, slug: "d" },
    });
    await api.adminUpdateDrill(1, { definition: null });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ drill: { definition: null } });
  });
});

describe("training sessions client", () => {
  const input = {
    title: "Morning Training",
    description: "Structured practice.",
    starts_at: "2026-10-01T09:00:00Z",
    ends_at: "2026-10-01T11:00:00Z",
    location: "Coogee Beach",
    status: "scheduled" as const,
    training_focuses_attributes: [
      { skill_id: 3, description: "Platform angle", position: 0 },
      { custom_focus: "Transition communication", position: 1 },
    ],
    training_session_drills_attributes: [
      { drill_id: 5, duration_minutes: 15, notes: "Round two harder", position: 0 },
    ],
  };

  it("lists sessions without query params by default", async () => {
    const fetchMock = mockFetchOnce({ ok: true, status: 200, body: [] });
    await api.trainingSessions();
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/training_sessions");
  });

  it("builds a date-range + status query for the calendar", async () => {
    const fetchMock = mockFetchOnce({ ok: true, status: 200, body: [] });
    await api.trainingSessions({
      starts_at_from: "2026-10-01",
      starts_at_to: "2026-10-31",
      status: "scheduled",
    });
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/training_sessions?");
    expect(url).toContain("starts_at_from=2026-10-01");
    expect(url).toContain("starts_at_to=2026-10-31");
    expect(url).toContain("status=scheduled");
  });

  it("fetches a single session by id", async () => {
    const fetchMock = mockFetchOnce({ ok: true, status: 200, body: { id: 7 } });
    await api.trainingSession(7);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/training_sessions/7");
  });

  it("creates a session with nested focuses and drills", async () => {
    const fetchMock = mockFetchOnce({ ok: true, status: 201, body: { id: 9 } });
    await api.createTrainingSession(input);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/training_sessions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      training_session: input,
    });
  });

  it("updates a session with PATCH", async () => {
    const fetchMock = mockFetchOnce({ ok: true, status: 200, body: { id: 9 } });
    await api.updateTrainingSession(9, { title: "Evening Training" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/training_sessions/9");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({
      training_session: { title: "Evening Training" },
    });
  });

  it("deletes a session with DELETE", async () => {
    const fetchMock = mockFetchOnce({ ok: true, status: 204 });
    await api.deleteTrainingSession(9);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/training_sessions/9");
    expect(init.method).toBe("DELETE");
  });
});
