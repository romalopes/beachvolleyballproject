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

export function isValidDrillRange(d: {
  min_players: unknown;
  max_players: unknown;
  ideal_num_players: unknown;
  training_stage: unknown;
  difficulty_level: unknown;
}): boolean {
  if (
    typeof d.min_players !== 'number' ||
    typeof d.max_players !== 'number' ||
    typeof d.ideal_num_players !== 'number' ||
    !Number.isInteger(d.min_players) ||
    !Number.isInteger(d.max_players) ||
    !Number.isInteger(d.ideal_num_players)
  ) {
    return false;
  }
  if (d.min_players < 1 || d.max_players < 1 || d.ideal_num_players < 1) {
    return false;
  }
  if (d.min_players > d.max_players) {
    return false;
  }
  if (d.ideal_num_players < d.min_players || d.ideal_num_players > d.max_players) {
    return false;
  }
  if (!TRAINING_STAGES.some((s) => s.value === d.training_stage)) {
    return false;
  }
  if (!DIFFICULTY_LEVELS.some((s) => s.value === d.difficulty_level)) {
    return false;
  }
  return true;
}

export function playerRangeLabel(min: number, max: number): string {
  return min === max ? `${min} players` : `${min}–${max} players`;
}

export function trainingStageLabel(stage: TrainingStage): string {
  return TRAINING_STAGES.find((s) => s.value === stage)?.label ?? stage;
}

export function idealLabel(ideal: number): string {
  return `Ideal: ${ideal}`;
}
