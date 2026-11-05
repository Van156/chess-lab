import { describe, expect, test } from "bun:test";

import { ConsoleEmailSender } from "./console-email-sender";
import { RecordingEmailSender } from "../testing";
import { createEmailSender, withoutSyntheticRecipients } from "./factory";
import { ResendEmailSender } from "./resend-email-sender";

describe("createEmailSender", () => {
  test("returns a ConsoleEmailSender in development when RESEND_API_KEY is not set", () => {
    const sender = createEmailSender({ NODE_ENV: "development" });
    expect(sender).toBeInstanceOf(ConsoleEmailSender);
  });

  test("returns a ConsoleEmailSender in test when RESEND_API_KEY is not set", () => {
    const sender = createEmailSender({ NODE_ENV: "test" });
    expect(sender).toBeInstanceOf(ConsoleEmailSender);
  });

  test("returns a ConsoleEmailSender when RESEND_API_KEY is an empty string outside production", () => {
    const sender = createEmailSender({ NODE_ENV: "development", RESEND_API_KEY: "" });
    expect(sender).toBeInstanceOf(ConsoleEmailSender);
  });

  test("returns a ResendEmailSender when RESEND_API_KEY and EMAIL_FROM are set", () => {
    const sender = createEmailSender({
      NODE_ENV: "production",
      RESEND_API_KEY: "re_test_key",
      EMAIL_FROM: "no-reply@example.com",
    });
    expect(sender).toBeInstanceOf(ResendEmailSender);
  });

  test("throws when RESEND_API_KEY is set but EMAIL_FROM is missing", () => {
    expect(() =>
      createEmailSender({ NODE_ENV: "development", RESEND_API_KEY: "re_test_key" }),
    ).toThrow(/EMAIL_FROM/);
  });

  test("throws instead of falling back to Console when NODE_ENV is production and RESEND_API_KEY is missing (T3.1d)", () => {
    expect(() => createEmailSender({ NODE_ENV: "production" })).toThrow(/RESEND_API_KEY/);
  });

  test("throws instead of falling back to Console when NODE_ENV is production and RESEND_API_KEY is an empty string (T3.1d)", () => {
    expect(() => createEmailSender({ NODE_ENV: "production", RESEND_API_KEY: "" })).toThrow(
      /RESEND_API_KEY/,
    );
  });
});

describe("withoutSyntheticRecipients (S3.7)", () => {
  const SYNTHETIC = "thibault@lichess.invalid";

  test("drops and logs every send to a synthetic address", async () => {
    const inner = new RecordingEmailSender();
    const sender = withoutSyntheticRecipients(inner);
    const warnings: unknown[][] = [];
    const realWarn = console.warn;
    console.warn = (...args: unknown[]) => void warnings.push(args);
    try {
      await sender.sendVerification({ to: SYNTHETIC, url: "https://x/verify" });
      await sender.sendResetPassword({ to: SYNTHETIC, url: "https://x/reset" });
      await sender.sendChangeEmailApproval({ to: SYNTHETIC, newEmail: "n@e.com", url: "u" });
      await sender.sendDeleteAccountConfirmation({ to: SYNTHETIC, url: "u" });
      await sender.sendPasswordChangedNotice({ to: SYNTHETIC, changedAt: new Date() });
    } finally {
      console.warn = realWarn;
    }
    expect(inner.verifications).toEqual([]);
    expect(inner.resetPasswords).toEqual([]);
    expect(inner.changeEmailApprovals).toEqual([]);
    expect(inner.deleteAccountConfirmations).toEqual([]);
    expect(inner.passwordChangedNotices).toEqual([]);
    expect(warnings).toHaveLength(5);
    expect(JSON.stringify(warnings)).not.toContain("https://x/verify");
  });

  test("forwards sends to real addresses unchanged", async () => {
    const inner = new RecordingEmailSender();
    const sender = withoutSyntheticRecipients(inner);
    await sender.sendVerification({ to: "user@example.com", url: "https://x/verify" });
    expect(inner.verifications).toEqual([{ to: "user@example.com", url: "https://x/verify" }]);
  });
});
