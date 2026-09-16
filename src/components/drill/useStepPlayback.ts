/**
 * useStepPlayback — the shared step playback state machine.
 *
 * Extracted from `DrillViewer` and reused by the editor's visualisation, so
 * both animate identically. The caller owns the step index (the viewer's
 * cursor / the editor's edit cursor) and passes it in; this hook owns
 * `playing`, `playMode` and the RAF-driven `progress`.
 *
 * Progress accumulates elapsed time divided by the speed-adjusted step
 * duration, which is read from the effect's dependency list — changing the
 * duration mid-playback takes effect smoothly from the next frame.
 */

import { useEffect, useRef, useState } from "react";

export type PlayMode = "all" | "step";

export interface StepPlaybackOptions {
  /** The step currently shown — owned by the caller. */
  stepIndex: number;
  stepCount: number;
  /** Duration of one step in milliseconds (after any speed multiplier). */
  stepDurationMs: number;
  /** Called when playback advances/rewinds/jumps the step. */
  onStepChange: (index: number) => void;
}

export interface StepPlayback {
  playing: boolean;
  playMode: PlayMode;
  /** 0..1 within the current step. */
  progress: number;
  /** Play all steps, or pause the current run. */
  togglePlay: () => void;
  /** Play just the current step, or pause that run. */
  playStep: () => void;
  prev: () => void;
  next: () => void;
  /** Jump to a step (timeline). */
  select: (index: number) => void;
}

export function useStepPlayback({
  stepIndex,
  stepCount,
  stepDurationMs,
  onStepChange,
}: StepPlaybackOptions): StepPlayback {
  const [playing, setPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>("all");
  const [progress, setProgress] = useState(0); // 0..1 within current step
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  // Mirrored in a ref so the RAF loop accumulates deltas without stale
  // closures; that is what lets the duration change mid-playback.
  const progressRef = useRef(0);
  // The caller's setter changes identity every render; a ref keeps the RAF
  // effect from re-subscribing (and restarting the frame clock) each render.
  // It is written in an effect rather than during render — a ref write is a
  // side effect and must not happen in the render path.
  const onStepChangeRef = useRef(onStepChange);
  useEffect(() => {
    onStepChangeRef.current = onStepChange;
  });

  const resetProgress = () => {
    lastTickRef.current = null;
    progressRef.current = 0;
    setProgress(0);
  };

  const start = (mode: PlayMode) => {
    setPlayMode(mode);
    resetProgress();
    setPlaying(true);
  };

  // requestAnimationFrame loop while playing.
  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    const tick = (t: number) => {
      const dt = lastTickRef.current === null ? 0 : t - lastTickRef.current;
      lastTickRef.current = t;
      const p = Math.min(1, progressRef.current + dt / stepDurationMs);
      progressRef.current = p;
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (playMode === "all" && stepIndex < stepCount - 1) {
        lastTickRef.current = t;
        progressRef.current = 0;
        setProgress(0);
        onStepChangeRef.current(stepIndex + 1);
      } else {
        setPlaying(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, playMode, stepIndex, stepCount, stepDurationMs]);

  /** Stop playback and rewind the current step (navigation resets it). */
  const navigate = (index: number) => {
    setPlaying(false);
    resetProgress();
    onStepChangeRef.current(index);
  };

  return {
    playing,
    playMode,
    progress,
    togglePlay: () => (playing ? setPlaying(false) : start("all")),
    playStep: () =>
      playing && playMode === "step" ? setPlaying(false) : start("step"),
    prev: () => navigate(Math.max(0, stepIndex - 1)),
    next: () => navigate(Math.min(stepCount - 1, stepIndex + 1)),
    select: (index) => navigate(index),
  };
}
