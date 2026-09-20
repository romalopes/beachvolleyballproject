export type TrainingStage = 'warmup' | 'beginning' | 'middle' | 'end';
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export const TRAINING_STAGES: { value: TrainingStage; label: string }[] = [
  { value: 'warmup', label: 'Warm-up' },
  { value: 'beginning', label: 'Beginning' },
  { value: 'middle', label: 'Middle' },
  { value: 'end', label: 'End' },
];

export const DIFFICULTY_LEVELS: { value: DifficultyLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

/**
 * Validates the (now optional) training attributes. Every provided value must
 * be valid; cross-field rules apply only when both sides of the comparison
 * exist, so a drill can be saved with any subset of these attributes blank.
 */
export function isValidDrillRange(d: {
  min_players?: unknown;
  max_players?: unknown;
  ideal_num_players?: unknown;
  training_stage?: unknown;
  difficulty_level?: unknown;
}): boolean {
  const counts: [string, unknown][] = [
    ['min_players', d.min_players],
    ['max_players', d.max_players],
    ['ideal_num_players', d.ideal_num_players],
  ];
  for (const [, value] of counts) {
    if (value === null || value === undefined) continue;
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < 1
    ) {
      return false;
    }
  }
  if (
    typeof d.min_players === 'number' &&
    typeof d.max_players === 'number' &&
    d.min_players > d.max_players
  ) {
    return false;
  }
  if (
    typeof d.ideal_num_players === 'number' &&
    typeof d.min_players === 'number' &&
    d.ideal_num_players < d.min_players
  ) {
    return false;
  }
  if (
    typeof d.ideal_num_players === 'number' &&
    typeof d.max_players === 'number' &&
    d.ideal_num_players > d.max_players
  ) {
    return false;
  }
  if (
    d.training_stage !== null &&
    d.training_stage !== undefined &&
    !TRAINING_STAGES.some((s) => s.value === d.training_stage)
  ) {
    return false;
  }
  if (
    d.difficulty_level !== null &&
    d.difficulty_level !== undefined &&
    !DIFFICULTY_LEVELS.some((s) => s.value === d.difficulty_level)
  ) {
    return false;
  }
  return true;
}

/** Returns null when either side of the range is missing. */
export function playerRangeLabel(
  min: number | null | undefined,
  max: number | null | undefined
): string | null {
  if (min === null || min === undefined || max === null || max === undefined) {
    return null;
  }
  return min === max ? `${min} players` : `${min}–${max} players`;
}

/** Returns null when the stage is missing. */
export function trainingStageLabel(
  stage: TrainingStage | null | undefined
): string | null {
  if (stage === null || stage === undefined) return null;
  return TRAINING_STAGES.find((s) => s.value === stage)?.label ?? stage;
}

/** Returns null when the ideal count is missing. */
export function idealLabel(ideal: number | null | undefined): string | null {
  if (ideal === null || ideal === undefined) return null;
  return `Ideal: ${ideal}`;
}
