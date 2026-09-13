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
    const errors = ["Title can't be blank", "Definition schema: /court — bad"];
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
    court: { grid: { columns: 5, rows: 4 } },
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
