/**
 * DrillDefinitionPanel — the visual builder ⇄ JSON editor switch.
 *
 * `DrillForm` owns the model, so the panel is exercised the way the form wires
 * it: `jsonText` is the text that gets submitted, `onDefinitionChange` derives
 * that text from a visual edit, and `onJsonTextChange` re-parses it back into
 * the model. The court is mocked (its pointer mechanics are covered by
 * `InteractiveCourt.test.tsx`); the panel's job is only to show the selected
 * view, keep the JSON preview truthful, and hand each edit to the right
 * callback.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DrillDefinition } from "../../../drill/definition";
import DrillDefinitionPanel from "./DrillDefinitionPanel";
import { emptyStep } from "./drill-model";

vi.mock("./InteractiveCourt", () => ({
  __esModule: true,
  default: ({
    definition,
    stepIndex,
  }: {
    definition: DrillDefinition;
    stepIndex: number;
  }) => <div data-testid="court">{definition.steps[stepIndex]?.id}</div>,
}));

afterEach(cleanup);

const definition = (): DrillDefinition => ({
  version: 1,
  side: { grid: { columns: 5, rows: 4 } },
  participants: [{ id: "P1", type: "player" }],
  balls: [],
  objects: [],
  steps: [emptyStep("S1")],
});

const JSON_TEXT = '{\n  "version": 1\n}';

const setup = (overrides: Partial<Parameters<typeof DrillDefinitionPanel>[0]> = {}) => {
  const onDefinitionChange = vi.fn();
  const onJsonTextChange = vi.fn();
  const onFormat = vi.fn();
  render(
    <DrillDefinitionPanel
      definition={definition()}
      onDefinitionChange={onDefinitionChange}
      jsonText={JSON_TEXT}
      onJsonTextChange={onJsonTextChange}
      parseError={null}
      issues={[]}
      onFormat={onFormat}
      storedDefinitionMissing={false}
      {...overrides}
    />,
  );
  return { onDefinitionChange, onJsonTextChange, onFormat };
};

const switchToJson = () =>
  fireEvent.click(screen.getByRole("button", { name: "JSON editor" }));
const switchToVisual = () =>
  fireEvent.click(screen.getByRole("button", { name: "Visual builder" }));
const jsonTextarea = () =>
  screen.getByLabelText("Definition (JSON)") as HTMLTextAreaElement;

describe("DrillDefinitionPanel", () => {
  it("opens in visual mode with a live preview of the JSON to be saved", () => {
    setup();

    // The builder's pieces are on screen...
    expect(screen.getByTestId("court")).toBeInTheDocument();
    // (the tab's accessible name carries its entity count: "Participants1")
    expect(
      screen.getByRole("tab", { name: /^Participants/ }),
    ).toBeInTheDocument();
    // ...and the raw editor is not.
    expect(screen.queryByLabelText("Definition (JSON)")).toBeNull();
    // The preview is the exact text the form will submit.
    expect(screen.getByTestId("json-preview").textContent).toBe(JSON_TEXT);
  });

  it("hands a manual JSON edit straight to the form, untouched", () => {
    const { onJsonTextChange } = setup();
    switchToJson();

    // Malformed on purpose: the panel must not parse or "fix" it, because
    // DrillForm owns the parse-and-rehydrate step (and keeps the user's caret).
    fireEvent.change(jsonTextarea(), { target: { value: "{ nope" } });

    expect(onJsonTextChange).toHaveBeenCalledWith("{ nope");
    // The visual builder is out of the way while the raw text is edited.
    expect(screen.queryByTestId("court")).toBeNull();
  });

  it("keeps the visual model across a mode round-trip", () => {
    setup();

    switchToJson();
    expect(jsonTextarea().value).toBe(JSON_TEXT);

    switchToVisual();
    expect(screen.getByTestId("court")).toHaveTextContent("S1");
  });

  it("mirrors the form's parse error in JSON mode", () => {
    setup({ parseError: "Unexpected token n in JSON" });
    switchToJson();

    expect(screen.getByText(/Unexpected token n in JSON/)).toBeInTheDocument();
  });

  it("warns about a missing stored definition, and stays quiet otherwise", () => {
    setup({ storedDefinitionMissing: true });
    expect(screen.getByRole("note")).toHaveTextContent(
      /has no saved definition yet/i,
    );

    cleanup();
    setup();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("falls back to an empty draft when the form has no model yet", () => {
    setup({ definition: null });

    // A brand-new drill still gets a buildable court and catalog.
    expect(screen.getByTestId("court")).toHaveTextContent("S1");
    expect(
      screen.getByRole("tab", { name: /^Participants/ }),
    ).toBeInTheDocument();
  });
});
