/** Input for {@link EmailSender.sendVerification} . */
export type SendVerificationInput = {
  to: string;
  url: string;
};

/** Input for {@link EmailSender.sendResetPassword} . */
export type SendResetPasswordInput = {
  to: string;
  url: string;
};

/**
 * Input for {@link EmailSender.sendChangeEmailApproval}. `to` is the CURRENT address, `newEmail` the
 * requested one (account-settings.md R2.1).
 */
export type SendChangeEmailApprovalInput = {
  to: string;
  newEmail: string;
  url: string;
};

/** Input for {@link EmailSender.sendDeleteAccountConfirmation} (account-settings.md R6.2). */
export type SendDeleteAccountConfirmationInput = {
  to: string;
  url: string;
};

/** Input for {@link EmailSender.sendPasswordChangedNotice}; informational, carries no link (R3.5). */
export type SendPasswordChangedNoticeInput = {
  to: string;
  changedAt: Date;
};

/**
 * Hexagonal port for sending transactional emails. Auth wiring
 * (`createAuth`) depends only on this interface, never on a concrete
 * provider — see §4.4 and the `ConsoleEmailSender` / `ResendEmailSender`
 * adapters.
 */
export interface EmailSender {
  sendVerification(input: SendVerificationInput): Promise<void>;
  sendResetPassword(input: SendResetPasswordInput): Promise<void>;
  sendChangeEmailApproval(input: SendChangeEmailApprovalInput): Promise<void>;
  sendDeleteAccountConfirmation(input: SendDeleteAccountConfirmationInput): Promise<void>;
  sendPasswordChangedNotice(input: SendPasswordChangedNoticeInput): Promise<void>;
}

/**
 * Thrown by an {@link EmailSender} adapter when a send fails. Always
 * retryable by design: callers must leave the underlying record (for example a
 * verification) unchanged on failure so the send can be retried.
 */
export class EmailSendError extends Error {
  readonly retryable = true;

  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "EmailSendError";
  }
}
