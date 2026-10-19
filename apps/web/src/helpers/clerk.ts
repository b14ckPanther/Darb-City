/**
 * The helper sign-in and sign-up forms. Clerk's own header names the Clerk app ("Darb admin"), so
 * it is hidden: the page above the form already says Darb helpers. Emails, phone numbers and codes
 * read left to right, also in the Hebrew and Arabic forms.
 */
export const CLERK_LTR_FIELDS = {
  elements: {
    header: { display: "none" },
    logoBox: { display: "none" },
    formFieldInput: { direction: "ltr" },
    otpCodeFieldInput: { direction: "ltr" },
    identityPreviewText: { direction: "ltr" },
  },
} as const;
