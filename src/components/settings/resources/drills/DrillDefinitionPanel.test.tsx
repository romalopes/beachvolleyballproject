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
import { useMemo, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DrillDefinition } from "../../../drill/definition";
import { parseAndValidateDefinition } from "../../../../services/drillSchema";
import DrillDefinitionPanel from "./DrillDefinitionPanel";
import {
  definitionToJsonText,
  emptyStep,
  jsonTextToDefinition,
  normalizeDefinition,
} from "./drill-model";

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
  const view = render(
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
  return { ...view, onDefinitionChange, onJsonTextChange, onFormat };
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

  it("numbers the preview down the left, one per line", () => {
    const { container } = setup();

    const gutter = container.querySelector(".line-numbered-code__gutter")!;
    expect(gutter.textContent).toBe("1\n2\n3");
    // Presentation only: a screen reader must not read the numbers as content.
    expect(gutter.getAttribute("aria-hidden")).toBe("true");
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

/**
 * The panel wired the way `DrillForm` wires it: the model and the JSON text are
 * both state, a visual edit re-derives the text ("the JSON on time"), a manual
 * edit re-parses it back into the model, and a malformed draft only sets the
 * parse error. That round-trip is the reason the panel exists, so it is tested
 * against a stateful harness rather than a frozen prop.
 */
function Wired({ initial }: { initial: DrillDefinition }) {
  const [definition, setDefinition] = useState<DrillDefinition | null>(initial);
  const [jsonText, setJsonText] = useState(() => definitionToJsonText(initial));
  const parseResult = useMemo(
    () => parseAndValidateDefinition(jsonText),
    [jsonText],
  );

  return (
    <DrillDefinitionPanel
      definition={definition}
      onDefinitionChange={(next) => {
        setDefinition(next);
        setJsonText(definitionToJsonText(next));
      }}
      jsonText={jsonText}
      onJsonTextChange={(text) => {
        setJsonText(text);
        const parsed = jsonTextToDefinition(text);
        if (parsed !== null) setDefinition(normalizeDefinition(parsed));
      }}
      parseError={parseResult.parseError}
      issues={parseResult.issues}
      onFormat={() => {}}
      storedDefinitionMissing={false}
    />
  );
}

describe("DrillDefinitionPanel — wired to a form-owned model", () => {
  it("re-derives the JSON preview from a visual edit", () => {
    render(<Wired initial={definition()} />);

    fireEvent.click(screen.getByRole("button", { name: /add participant/i }));

    // The catalog shows the new entity...
    expect(screen.getByLabelText("Type of P2")).toBeInTheDocument();
    // ...and the preview is derived from the new model, not the text it opened
    // with, so the JSON stays "on time" with the panes.
    const preview = JSON.parse(
      screen.getByTestId("json-preview").textContent ?? "",
    ) as DrillDefinition;
    expect(preview.participants.map((p) => p.id)).toEqual(["P1", "P2"]);
    expect(preview.side).toEqual({ grid: { columns: 5, rows: 4 } });
  });

  it("rehydrates the visual model from a manual JSON edit", () => {
    render(<Wired initial={definition()} />);
    switchToJson();

    const edited: DrillDefinition = {
      ...definition(),
      participants: [{ id: "P9", type: "coach", role: "feeder" }],
      steps: [emptyStep("S1"), emptyStep("S2")],
    };
    fireEvent.change(jsonTextarea(), {
      target: { value: definitionToJsonText(edited) },
    });

    switchToVisual();

    // The builder is showing the editor's model, not the one it opened with.
    expect(screen.getByLabelText("Type of P9")).toBeInTheDocument();
    expect(screen.queryByLabelText("Type of P1")).toBeNull();
  });

  it("shows the parse error for a malformed draft without corrupting the model", () => {
    render(<Wired initial={definition()} />);
    switchToJson();

    fireEvent.change(jsonTextarea(), { target: { value: "{ nope" } });

    expect(screen.getByText(/Invalid JSON:/)).toBeInTheDocument();
    expect(jsonTextarea()).toHaveAttribute("aria-invalid", "true");

    // The model the builder works from is still the last good one, so switching
    // back to visual shows the drill rather than an empty or broken panel.
    switchToVisual();
    expect(screen.getByLabelText("Type of P1")).toBeInTheDocument();
    expect(screen.queryByText(/Invalid JSON:/)).toBeNull();
  });
});
