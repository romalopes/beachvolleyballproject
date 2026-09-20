import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestAccessProvider, useTestAccess } from "./TestAccessContext";
import {
  testAccessApi,
  getTestAccessToken,
  setTestAccessToken,
} from "../api";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    testAccessApi: {
      submit: vi.fn(),
      verify: vi.fn(),
    },
  };
});

const mockedSubmit = vi.mocked(testAccessApi.submit);
const mockedVerify = vi.mocked(testAccessApi.verify);

// Probe component: exposes the current context state to assertions.
function Probe() {
  const { authenticated, verifying, exit, submit } = useTestAccess();
  return (
    <div>
      <span data-testid="authenticated">{String(authenticated)}</span>
      <span data-testid="verifying">{String(verifying)}</span>
      <button onClick={() => exit()}>exit</button>
      <button onClick={() => submit("pw").catch(() => {})}>submit</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <TestAccessProvider>
      <Probe />
    </TestAccessProvider>,
  );
}

describe("TestAccessContext", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("starts gated when no token is stored", async () => {
    mockedVerify.mockResolvedValue({ authenticated: true });

    renderProvider();

    expect(screen.getByTestId("authenticated").textContent).toBe("false");
    expect(getTestAccessToken()).toBeNull();
    // No verification call without a stored token.
    expect(mockedVerify).not.toHaveBeenCalled();
  });

  it("stores the token and unlocks after a successful submit", async () => {
    mockedSubmit.mockResolvedValue({
      authenticated: true,
      token: "signed-token",
    });

    renderProvider();

    await userEvent.click(screen.getByText("submit"));

    expect(screen.getByTestId("authenticated").textContent).toBe("true");
    expect(getTestAccessToken()).toBe("signed-token");
  });

  it("clears the token when exit is called", async () => {
    setTestAccessToken("signed-token");
    mockedVerify.mockResolvedValue({ authenticated: true });

    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("authenticated").textContent).toBe("true"),
    );

    await userEvent.click(screen.getByText("exit"));
    expect(getTestAccessToken()).toBeNull();
    expect(screen.getByTestId("authenticated").textContent).toBe("false");
  });

  it("clears an expired token after a failed boot-time verification", async () => {
    setTestAccessToken("expired-token");
    mockedVerify.mockRejectedValue(
      Object.assign(new Error("401"), { code: "test_access_required" }),
    );

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("authenticated").textContent).toBe("false"),
    );
    expect(getTestAccessToken()).toBeNull();
  });

  it("keeps access when verification fails with a transient (network) error", async () => {
    setTestAccessToken("valid-token");
    // Simulate a network failure WITHOUT the gate 401 marker.
    mockedVerify.mockRejectedValue(new TypeError("Network failure"));

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("authenticated").textContent).toBe("true"),
    );
    expect(getTestAccessToken()).toBe("valid-token");
  });
});
