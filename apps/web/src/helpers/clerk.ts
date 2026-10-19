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
    // The code row itself runs left to right: in an RTL page the first digit lands on the right
    // and typing moves leftward unless the boxes' container is LTR too.
    otpCodeField: { direction: "ltr" },
    otpCodeFieldInputs: { direction: "ltr" },
    otpCodeFieldInputContainer: { direction: "ltr" },
    otpCodeFieldInput: { direction: "ltr" },
    identityPreviewText: { direction: "ltr" },
  },
} as const;
