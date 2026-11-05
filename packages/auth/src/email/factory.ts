import { isSyntheticEmail } from "../synthetic-email";
import { ConsoleEmailSender } from "./console-email-sender";
import { ResendEmailSender } from "./resend-email-sender";
import type { EmailSender } from "./types";

/** Env inputs for the email adapter factory (spec §4.4); `NODE_ENV` is passed in, never read here. */
export type EmailSenderEnv = {
  NODE_ENV: "development" | "production" | "test";
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
};

/**
 * Picks `ResendEmailSender` when `RESEND_API_KEY` is set, else `ConsoleEmailSender`. In production a
 * missing key throws at startup, since the console adapter would log tokens.
 */
export function createEmailSender(env: EmailSenderEnv): EmailSender {
  if (env.RESEND_API_KEY) {
    if (!env.EMAIL_FROM) {
      throw new Error("createEmailSender: EMAIL_FROM is required when RESEND_API_KEY is set.");
    }
    return new ResendEmailSender({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM });
  }
  if (env.NODE_ENV === "production") {
    throw new Error(
      "createEmailSender: RESEND_API_KEY is required in production. Refusing to fall back to ConsoleEmailSender, which would log verification links instead of sending real email.",
    );
  }
  return new ConsoleEmailSender();
}

/**
 * Wraps a sender so any send to a synthetic Lichess address (`@lichess.invalid`) is dropped and
 * logged without the link, which may carry a token. Defence in depth against bounces from template
 * flows that assume every account has a deliverable email (ADR-07).
 */
export function withoutSyntheticRecipients(inner: EmailSender): EmailSender {
  const guard =
    <Input extends { to: string }>(method: string, send: (input: Input) => Promise<void>) =>
    (input: Input): Promise<void> => {
      if (isSyntheticEmail(input.to)) {
        console.warn(`[email] dropped ${method} to a synthetic address`);
        return Promise.resolve();
      }
      return send(input);
    };
  return {
    sendVerification: guard("sendVerification", (i) => inner.sendVerification(i)),
    sendResetPassword: guard("sendResetPassword", (i) => inner.sendResetPassword(i)),
    sendChangeEmailApproval: guard("sendChangeEmailApproval", (i) =>
      inner.sendChangeEmailApproval(i),
    ),
    sendDeleteAccountConfirmation: guard("sendDeleteAccountConfirmation", (i) =>
      inner.sendDeleteAccountConfirmation(i),
    ),
    sendPasswordChangedNotice: guard("sendPasswordChangedNotice", (i) =>
      inner.sendPasswordChangedNotice(i),
    ),
  };
}
