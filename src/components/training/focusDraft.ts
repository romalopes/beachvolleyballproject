import type { TrainingFocusInput } from '../../api';

export interface FocusDraft extends TrainingFocusInput {
  key: string;
}

let focusKey = 0;
const nextFocusKey = () => `focus-${Date.now()}-${(focusKey += 1)}`;

export function createSkillFocus(skillId: number, description = ''): FocusDraft {
  return { key: nextFocusKey(), skill_id: skillId, custom_focus: null, description };
}

export function createCustomFocus(customFocus = '', description = ''): FocusDraft {
  return { key: nextFocusKey(), skill_id: null, custom_focus: customFocus, description };
}

export function moveFocus<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const copy = [...items];
  const [item] = copy.splice(index, 1);
  copy.splice(target, 0, item);
  return copy;
}
