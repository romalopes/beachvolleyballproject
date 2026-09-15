import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DrillDefinition } from "../../../drill/definition";
import { buildSideGeometry } from "../../../drill/geometry";
import InteractiveCourt, {
  type InteractiveCourtProps,
} from "./InteractiveCourt";
import { emptyStep } from "./drill-model";

/**
 * InteractiveCourt is the only place where a screen position becomes a logical
 * `Location`. jsdom has no layout, so each test stubs `getBoundingClientRect`
 * with the real viewBox size — that makes client coordinates map 1:1 onto SVG
 * coordinates and lets us assert the snapped logical result exactly.
 */

const definition: DrillDefinition = {
  version: 1,
  side: { grid: { columns: 5, rows: 4 } },
  participants: [{ id: "P1", type: "player" }],
  balls: [{ id: "B1", type: "volleyball" }],
  objects: [],
  steps: [
    {
      ...emptyStep("S1"),
      participants: [
        { id: "P1", active: true, location: { side: "side_1", x: 1, y: 1 } },
      ],
    },
    {
      ...emptyStep("S2"),
      participants: [
        { id: "P1", active: true, location: { side: "side_1", x: 4, y: 3 } },
      ],
      balls: [
        { id: "B1", active: true, location: { side: "side_2", x: 2, y: 2 } },
      ],
    },
  ],
};

afterEach(cleanup);

/** Render the court with the overlay sized to its true viewBox. */
function renderCourt(overrides: Partial<InteractiveCourtProps> = {}) {
  const props: InteractiveCourtProps = {
    definition,
    orientation: "lateral",
    stepIndex: 0,
    selected: null,
    onSelect: vi.fn(),
    onMove: vi.fn(),
    onCourtClick: vi.fn(),
    ...overrides,
  };
  const utils = render(<InteractiveCourt {...props} />);
  const geometry = buildSideGeometry(props.orientation, props.definition.side);
  const svg = utils.container.querySelector(
    "svg.drill-builder-layer",
  ) as SVGSVGElement;
  svg.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: geometry.width,
      bottom: geometry.height,
      x: 0,
      y: 0,
      width: geometry.width,
      height: geometry.height,
      toJSON: () => ({}),
    }) as DOMRect;
  return { ...utils, props, geometry, svg };
}

describe("InteractiveCourt — layers", () => {
  it("renders the current step solid and the next step as ghosts", () => {
    const { container } = renderCourt();

    const current = container.querySelector(
      '[data-layer="current"][data-entity-id="P1"]',
    )!;
    const ghost = container.querySelector(
      '[data-layer="next"][data-entity-id="P1"]',
    )!;

    expect(current).not.toBeNull();
    expect(ghost).not.toBeNull();
    expect(current.getAttribute("data-entity-kind")).toBe("participants");
    // `<g>` is SVG: read the class via the attribute, not `.className`.
    expect(current.getAttribute("class")).toContain("drill-builder-marker-current");
    expect(ghost.getAttribute("class")).toContain("drill-builder-marker-next");
  });

  it("does not render a ghost for the last step", () => {
    const { container } = renderCourt({ stepIndex: 1 });
    expect(container.querySelector('[data-layer="next"]')).toBeNull();
    // The ball only exists in the second step, which is now the current one.
    expect(
      container.querySelector('[data-layer="current"][data-entity-id="B1"]'),
    ).not.toBeNull();
  });

  it("draws movement arrows for the current step", () => {
    const withMovement: DrillDefinition = {
      ...definition,
      steps: [
        {
          ...definition.steps[0],
          participant_movements: [
            {
              participant_id: "P1",
              from: { side: "side_1", x: 1, y: 1 },
              to: { side: "side_1", x: 4, y: 3 },
            },
          ],
        },
        definition.steps[1],
      ],
    };
    const { container } = renderCourt({ definition: withMovement });
    expect(container.querySelector(".drill-movement")).not.toBeNull();
  });
});