import { Button } from "@b2c-template/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@b2c-template/ui/components/card";
import { Input } from "@b2c-template/ui/components/input";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { AuthFormError } from "@/features/auth";
import { describedBy } from "@/shared/lib/form-errors";

import type { LichessDeleteResult } from "../lib/lichess-account";
import {
  deleteCardView,
  errorCodeOf,
  initialFocusTarget,
  UNKNOWN_FAILURE_CODE,
} from "../lib/lichess-delete-state";

/**
 * Danger zone card for Lichess-only accounts (ADR-08), which have no deliverable email. The user
 * types their Lichess username to arm the delete button; the server may ask for a fresh Lichess
 * sign-in (`REAUTH_REQUIRED`), which `onReauth` starts and which returns here with
 * `confirmRequested`. Presentational: `onDelete` performs the call and resolves with its outcome.
 */
export default function LichessDeleteCard({
  username,
  confirmRequested = false,
  onDelete,
  onReauth,
}: {
  username: string;
  /** Returning from the Lichess re-auth: focus the confirmation input. */
  confirmRequested?: boolean;
  onDelete: (typedUsername: string) => Promise<LichessDeleteResult>;
  onReauth: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialFocusTarget(confirmRequested) === "username-input") {
      inputRef.current?.focus();
    }
  }, [confirmRequested]);

  const { canSubmit, error } = deleteCardView({ typed, username, pending, errorCode });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setPending(true);
    setErrorCode(null);
    try {
      const result = await onDelete(typed);
      setErrorCode(errorCodeOf(result));
    } catch {
      setErrorCode(UNKNOWN_FAILURE_CODE);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card aria-labelledby="lichess-delete-title">
      <CardHeader>
        <CardTitle id="lichess-delete-title">Delete account</CardTitle>
        <CardDescription id="lichess-delete-warning">
          This permanently deletes your account and all of its data, including games, analysis and
          review cards. It cannot be undone. Your Lichess account is not affected.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {error ? <AuthFormError message={error.message} /> : null}
          <div className="flex flex-col gap-2">
            <label htmlFor="lichess-delete-username" className="text-sm font-medium">
              Type your Lichess username <strong>{username}</strong> to confirm
            </label>
            <Input
              ref={inputRef}
              id="lichess-delete-username"
              name="confirmUsername"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-describedby={describedBy("lichess-delete-warning")}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" variant="destructive" disabled={!canSubmit}>
              {pending ? "Deleting..." : "Delete my account permanently"}
            </Button>
            {error?.showReauth ? (
              <Button type="button" variant="outline" onClick={onReauth}>
                Sign in with Lichess again
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
