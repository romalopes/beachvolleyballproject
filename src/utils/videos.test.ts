import { describe, expect, it } from "vitest";
import {
  detectVideoProvider,
  formatReferenceWindow,
  formatTimestamp,
  parseTimestamp,
} from "./videos";

describe("parseTimestamp", () => {
  it("parses MM:SS and HH:MM:SS and bare seconds", () => {
    expect(parseTimestamp("04:32")).toBe(272);
    expect(parseTimestamp("01:04:32")).toBe(3872);
    expect(parseTimestamp("45")).toBe(45);
    expect(parseTimestamp("0:00")).toBe(0);
  });

  it("rejects malformed values", () => {
    expect(parseTimestamp("abc")).toBeNull();
    expect(parseTimestamp("-1:00")).toBeNull();
    expect(parseTimestamp("1:2:3:4")).toBeNull();
    expect(parseTimestamp("")).toBeNull();
    expect(parseTimestamp("4:5x")).toBeNull();
  });
});

describe("formatTimestamp", () => {
  it("renders seconds as MM:SS, or HH:MM:SS from an hour up", () => {
    expect(formatTimestamp(272)).toBe("04:32");
    expect(formatTimestamp(3872)).toBe("01:04:32");
    expect(formatTimestamp(0)).toBe("00:00");
  });

  it("returns null for unset or invalid values", () => {
    expect(formatTimestamp(null)).toBeNull();
    expect(formatTimestamp(undefined)).toBeNull();
    expect(formatTimestamp(-5)).toBeNull();
  });
});

describe("formatReferenceWindow", () => {
  it("formats start–end, start-only and end-only windows", () => {
    expect(formatReferenceWindow(272, 378)).toBe("04:32 – 06:18");
    expect(formatReferenceWindow(272, null)).toBe("04:32");
    expect(formatReferenceWindow(null, 378)).toBe("06:18");
    expect(formatReferenceWindow(null, null)).toBeNull();
  });
});

describe("detectVideoProvider", () => {
  it("detects the supported providers and their capabilities", () => {
    expect(detectVideoProvider("https://www.youtube.com/watch?v=x")).toEqual({
      provider: "youtube",
      label: "YouTube",
      embeddable: true,
    });
    expect(detectVideoProvider("https://youtu.be/x")).toMatchObject({ provider: "youtube" });
    expect(detectVideoProvider("https://vimeo.com/123")).toMatchObject({
      provider: "vimeo",
      embeddable: true,
    });
    expect(detectVideoProvider("https://www.instagram.com/p/Cabc/")).toMatchObject({
      provider: "instagram",
      embeddable: false,
    });
    expect(detectVideoProvider("https://www.tiktok.com/@a/video/123")).toMatchObject({
      provider: "tiktok",
      embeddable: false,
    });
  });

  it("falls back to External for any other http(s) url and rejects the rest", () => {
    expect(detectVideoProvider("https://cdn.example.com/clip.mp4")).toEqual({
      provider: "external",
      label: "External",
      embeddable: false,
    });
    expect(detectVideoProvider("not a url")).toBeNull();
    expect(detectVideoProvider("javascript:alert(1)")).toBeNull();
  });
});
