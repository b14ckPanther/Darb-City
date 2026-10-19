/** Emails, phone numbers and codes read left to right, also in the Hebrew and Arabic sign-in. */
export const CLERK_LTR_FIELDS = {
  elements: {
    formFieldInput: { direction: "ltr" },
    otpCodeFieldInput: { direction: "ltr" },
    identityPreviewText: { direction: "ltr" },
  },
} as const;
