/** DrillStepControls — prev/play/play-step/next plus a clickable step timeline. */

import { Pause, Play, Repeat1, SkipBack, SkipForward } from "lucide-react";

export interface DrillStepControlsProps {
  stepIndex: number;
  stepCount: number;
  playing: boolean;
  playMode: "all" | "step";
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onPlayStep: () => void;
  onSelect: (index: number) => void;
}

export default function DrillStepControls({
  stepIndex,
  stepCount,
  playing,
  playMode,
  onPrev,
  onNext,
  onTogglePlay,
  onPlayStep,
  onSelect,
}: DrillStepControlsProps) {
  return (
    <div className="drill-controls">
      <button
        type="button"
        className="drill-btn"
        onClick={onPrev}
        disabled={stepIndex === 0}
        aria-label="Previous step"
      >
        <SkipBack size={16} />
      </button>
      <button
        type="button"
        className="drill-btn drill-btn-play"
        onClick={onTogglePlay}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button
        type="button"
        className={`drill-btn drill-btn-play${playing && playMode === "step" ? " active" : ""}`}
        onClick={onPlayStep}
        aria-label={
          playing && playMode === "step" ? "Pause current step" : "Play current step"
        }
        title="Play current step"
      >
        <Repeat1 size={16} />
      </button>
      <button
        type="button"
        className="drill-btn"
        onClick={onNext}
        disabled={stepIndex >= stepCount - 1}
        aria-label="Next step"
      >
        <SkipForward size={16} />
      </button>
      <div className="drill-timeline" role="tablist" aria-label="Step timeline">
        {Array.from({ length: stepCount }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === stepIndex}
            className={`drill-timeline-dot${i === stepIndex ? " active" : ""}`}
            onClick={() => onSelect(i)}
            aria-label={`Step ${i + 1}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}