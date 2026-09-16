/**
 * useStepPlayback — the shared playback state machine.
 *
 * jsdom's own requestAnimationFrame is time-based, so the hook's frames are
 * made deterministic here with a manual stub: every scheduled callback is kept
 * and fired on demand with an explicit timestamp.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { useStepPlayback } from "./useStepPlayback";

let frameCallback: FrameRequestCallback | null = null;

beforeEach(() => {
  frameCallback = null;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frameCallback = cb;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    frameCallback = null;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

/** Run the pending frame with an explicit timestamp. */
const frame = (time: number) => {
  const cb = frameCallback;
  frameCallback = null;
  act(() => cb?.(time));
};

/** The caller owns the step index, exactly as the viewer and the builder do. */
function Harness({ stepCount = 3 }: { stepCount?: number }) {
  const [stepIndex, setStepIndex] = useState(0);
  const playback = useStepPlayback({
    stepIndex,
    stepCount,
    stepDurationMs: 1000,
    onStepChange: setStepIndex,
  });
  return (
    <div>
      <span data-testid="index">{stepIndex}</span>
      <span data-testid="playing">{String(playback.playing)}</span>
      <span data-testid="mode">{playback.playMode}</span>
      <span data-testid="progress">{playback.progress.toFixed(2)}</span>
      <button onClick={playback.togglePlay}>play all</button>
      <button onClick={playback.playStep}>play step</button>
      <button onClick={playback.next}>next</button>
      <button onClick={() => playback.select(0)}>first</button>
    </div>
  );
}

const index = () => screen.getByTestId("index").textContent;
const playing = () => screen.getByTestId("playing").textContent;
const progress = () => screen.getByTestId("progress").textContent;

describe("useStepPlayback", () => {
  it("advances to the next step when play-all completes a step", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "play all" }));
    expect(playing()).toBe("true");

    // The first frame only seeds the clock; the second completes step 1.
    frame(0);
    frame(1000);

    expect(index()).toBe("1");
    expect(playing()).toBe("true");
    expect(progress()).toBe("0.00");
  });

  it("stops at the end of the current step in play-step mode", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "play step" }));
    expect(screen.getByTestId("mode").textContent).toBe("step");

    frame(0);
    frame(1000);

    expect(index()).toBe("0");
    expect(playing()).toBe("false");
    expect(progress()).toBe("1.00");
  });

  it("stops playback and rewinds when the step changes", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "play all" }));
    frame(0);
    frame(500);
    expect(playing()).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "next" }));

    expect(playing()).toBe("false");
    expect(index()).toBe("1");
    expect(progress()).toBe("0.00");
  });

  it("clamps next at the last step and can jump back", () => {
    render(<Harness stepCount={2} />);

    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(index()).toBe("1");

    // Already at the last step: next stays put.
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(index()).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: "first" }));
    expect(index()).toBe("0");
  });
});