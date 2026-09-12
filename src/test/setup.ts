import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// RTL auto-cleanup needs global afterEach; with globals disabled we register it here.
afterEach(() => {
  cleanup();
});