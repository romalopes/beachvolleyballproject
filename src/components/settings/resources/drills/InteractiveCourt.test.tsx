import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DrillDefinition } from "../../../drill/definition";
import { buildSideGeometry, locationToSvg } from "../../../drill/geometry";
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
    playing: false,
    progress: 0,
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
/**
 * The court doubles as the editor's playback preview. Checking the moves must
 * never author them: while playing, the ghosts step aside, the current markers
 * follow the viewer's own interpolation and pointer edits are suspended.
 */
describe("InteractiveCourt — playback preview", () => {
  /** S1 moves P1 from (1,1) to (4,3); S2 places P1 at the destination. */
  const moving: DrillDefinition = {
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

  it("hides the ghost layer while playing", () => {
    const { container } = renderCourt({ playing: true });

    expect(container.querySelector('[data-layer="next"]')).toBeNull();
    expect(
      container.querySelector('[data-layer="current"][data-entity-id="P1"]'),
    ).not.toBeNull();
  });

  it("interpolates the current marker along its movement while playing", () => {
    const { container, geometry } = renderCourt({
      definition: moving,
      playing: true,
      progress: 0.5,
    });

    const from = locationToSvg({ side: "side_1", x: 1, y: 1 }, geometry);
    const to = locationToSvg({ side: "side_1", x: 4, y: 3 }, geometry);
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const marker = container.querySelector(
      '[data-layer="current"][data-entity-id="P1"] .drill-participant',
    )!;

    expect(marker.getAttribute("transform")).toBe(
      `translate(${mid.x}, ${mid.y})`,
    );
  });

  it("leaves markers at their authored spot when not playing", () => {
    const { container, geometry } = renderCourt({ definition: moving });

    const marker = container.querySelector(
      '[data-layer="current"][data-entity-id="P1"] .drill-participant',
    )!;
    const authored = locationToSvg({ side: "side_1", x: 1, y: 1 }, geometry);

    expect(marker.getAttribute("transform")).toBe(
      `translate(${authored.x}, ${authored.y})`,
    );
  });

  it("suspends editing while playing", () => {
    const onMove = vi.fn();
    const onCourtClick = vi.fn();
    const { container, svg } = renderCourt({
      playing: true,
      onMove,
      onCourtClick,
    });

    fireEvent.pointerDown(
      container.querySelector('[data-layer="current"][data-entity-id="P1"]')!,
      { clientX: 4, clientY: 4 },
    );
    fireEvent.pointerMove(svg, { clientX: 60, clientY: 50 });
    fireEvent.pointerDown(
      container.querySelector(".drill-builder-surface")!,
      { clientX: 4, clientY: 4 },
    );

    expect(onMove).not.toHaveBeenCalled();
    expect(onCourtClick).not.toHaveBeenCalled();
  });

  it("commits a drag when not playing", () => {
    const onMove = vi.fn();
    const { container, svg } = renderCourt({ onMove });

    fireEvent.pointerDown(
      container.querySelector('[data-layer="current"][data-entity-id="P1"]')!,
      { clientX: 4, clientY: 4 },
    );
    fireEvent.pointerMove(svg, { clientX: 60, clientY: 50 });

    expect(onMove).toHaveBeenCalled();
  });

  it("scales the canvas from the size control", () => {
    const { container } = renderCourt({ sizeScale: 120 });

    const canvas = container.querySelector(
      ".drill-builder-canvas",
    ) as HTMLElement;
    expect(canvas.style.width).toBe("120%");
    expect(canvas.getAttribute("data-playing")).toBe("false");
  });
});

/**
 * The last step's movements are authored — there is no next step whose ghosts
 * could provide a handle — so each `to` gets its own grabbable exit cap.
 */
describe("InteractiveCourt — last-step exit targets", () => {
  /** S2 is the last step and carries an authored ball movement. */
  const lastStepAuthored: DrillDefinition = {
    ...definition,
    steps: [
      definition.steps[0],
      {
        ...definition.steps[1],
        balls: [
          { id: "B1", active: true, location: { side: "side_2", x: 2, y: 2 } },
        ],
        ball_movements: [
          {
            ball_id: "B1",
            from: { side: "side_2", x: 2, y: 2 },
            to: { side: "side_1", x: 2, y: 3 },
            description: "coach feeds",
          },
        ],
      },
    ],
  };

  it("renders an exit cap at the authored `to` on the last step", () => {
    const { container, geometry } = renderCourt({
      definition: lastStepAuthored,
      stepIndex: 1,
    });

    const cap = container.querySelector(
      '[data-layer="target"][data-entity-id="B1"]',
    );
    expect(cap).not.toBeNull();
    expect(cap!.getAttribute("data-movement-index")).toBe("0");
    const expected = locationToSvg({ side: "side_1", x: 2, y: 3 }, geometry);
    expect(cap!.querySelector("g")!.getAttribute("transform")).toBe(
      `translate(${expected.x}, ${expected.y})`,
    );
  });

  it("hides the caps while playing", () => {
    const { container } = renderCourt({
      definition: lastStepAuthored,
      stepIndex: 1,
      playing: true,
    });

    expect(container.querySelector('[data-layer="target"]')).toBeNull();
  });

  it("renders no caps on a middle step (the ghost is the handle)", () => {
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
    const { container } = renderCourt({ definition: withMovement, stepIndex: 0 });

    expect(container.querySelector('[data-layer="target"]')).toBeNull();
  });

  it("commits a cap drag through onTargetMove", () => {
    const onTargetMove = vi.fn();
    const { container, svg } = renderCourt({
      definition: lastStepAuthored,
      stepIndex: 1,
      onTargetMove,
    });

    fireEvent.pointerDown(
      container.querySelector('[data-layer="target"][data-entity-id="B1"]')!,
      { clientX: 4, clientY: 4 },
    );
    fireEvent.pointerMove(svg, { clientX: 60, clientY: 50 });

    expect(onTargetMove).toHaveBeenCalledTimes(1);
    expect(onTargetMove.mock.calls[0][0]).toBe("balls");
    expect(onTargetMove.mock.calls[0][1]).toBe(0);
    expect(onTargetMove.mock.calls[0][2]).toEqual(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    );
  });
});
