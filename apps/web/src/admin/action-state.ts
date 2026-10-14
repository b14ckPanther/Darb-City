export interface ActionState {
  ok: boolean;
  message: string | null;
  errors: string[];
}
export const idle: ActionState = { ok: false, message: null, errors: [] };
