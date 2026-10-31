/** Mail types in Firestore `mailLog` (shared by the server and the /admin page — no server imports here). */
export type MailKind =
  | "payment" | "formReminder" | "confirm" | "edit" | "reminder" | "invite"
  | "owner" | "ownerUpdate" | "reschedule" | "cancel" | "feedback";

export const MAIL_LABEL: Record<MailKind, string> = {
  payment: "Payment mail + form link", formReminder: "Form reminder", confirm: "Booking confirmation", edit: "Edit link",
  reminder: "3 ghante wala reminder", invite: "Google Calendar invite", owner: "Owner ko form", ownerUpdate: "Owner ko edit update",
  reschedule: "Reschedule mail", cancel: "Cancel mail", feedback: "Feedback request",
};

/** Which mails /admin can re-send (failed `payment` mails are re-sent as a fresh form reminder). */
export const RESEND_AS: Partial<Record<MailKind, "formReminder" | "confirm" | "reminder" | "invite">> = {
  payment: "formReminder", formReminder: "formReminder", confirm: "confirm", reminder: "reminder", invite: "invite",
};
