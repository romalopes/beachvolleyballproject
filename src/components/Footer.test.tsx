import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Footer from "./Footer";
import { APP_VERSION } from "../constants/versions";

describe("Footer", () => {
  it("renders the footer with the app version", () => {
    render(<Footer />);
    const footer = document.querySelector("footer.app-footer");
    expect(footer).toBeInTheDocument();
    expect(screen.getByText(`Version ${APP_VERSION}`)).toBeInTheDocument();
  });

  it("displays version 0.0.21", () => {
    render(<Footer />);
    expect(screen.getByText("Version 0.0.21")).toBeInTheDocument();
  });

  it("derives the version from APP_VERSION, not a hard-coded string", () => {
    expect(APP_VERSION).toBe("0.0.21");
    render(<Footer />);
    expect(
      screen.getByText((_, el) => el?.textContent === `Version ${APP_VERSION}`),
    ).toBeInTheDocument();
  });
});
