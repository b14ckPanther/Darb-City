/** What a helper form's server action answers: done, or messages by field ("form": the whole). */
export interface FormState {
  ok: boolean;
  errors: Record<string, string>;
}
export const idleForm: FormState = { ok: false, errors: {} };
