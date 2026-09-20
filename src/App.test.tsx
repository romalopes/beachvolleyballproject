import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import App from "./App";
import { APP_VERSION } from "./constants/versions";
import { setTestAccessToken } from "./api";

// The app bootstraps auth + data over fetch; answer every request with an
// empty JSON array so Home/Auth render without network noise.
function okJson(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(data),
  } as unknown as Response;
}

beforeEach(() => {
  vi.spyOn(window, "fetch").mockImplementation((input) => {
    const url = String(input);
    // The test-access gate verifies its token on boot.
    if (url.includes("/test_access")) {
      return Promise.resolve(okJson({ authenticated: true }));
    }
    return Promise.resolve(okJson([]));
  });
  // Simulate a visitor who already has private test access.
  setTestAccessToken("test-token");
});

describe("App", () => {
  it("renders the global footer with the app version", async () => {
    render(<App />);
    await waitFor(() => {
      expect(document.querySelector("footer.app-footer")).toBeInTheDocument();
    });
    expect(screen.getByText(`Version ${APP_VERSION}`)).toBeInTheDocument();
    expect(screen.getByText("Version 0.0.21")).toBeInTheDocument();
  });
});
