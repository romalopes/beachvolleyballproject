import { describe, expect, it } from "vitest";
import { moveFocus } from './focusDraft';

describe("moveFocus", () => {
  it("moves an item up and down within bounds", () => {
    const items = ["a", "b", "c"];
    expect(moveFocus(items, 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveFocus(items, 1, 1)).toEqual(["a", "c", "b"]);
    expect(moveFocus(items, 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveFocus(items, 2, 1)).toEqual(["a", "b", "c"]);
    expect(items).toEqual(["a", "b", "c"]);
  });
});
