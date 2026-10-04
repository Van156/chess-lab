import { Button } from "@b2c-template/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@b2c-template/ui/components/card";
import { useState } from "react";

import { AuthFormError } from "@/features/auth";
import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";

import SecurityNotice from "./security-notice";

/**
 * Danger zone card (R6). Presentational: `onRequest` asks the server to start the deletion and
 * resolves once a confirmation link was emailed (nothing is deleted yet) and rejects with a
 * user-facing message on failure.
 */
export default function DeleteAccountCard({
  email,
  onRequest,
}: {
  email: string;
  onRequest: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    try {
      await onRequest();
      setSent(true);
    } catch (caught) {
      setSent(false);
      setError(caught instanceof Error ? caught.message : "Could not start the deletion.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delete account</CardTitle>
        <CardDescription>
          Permanently delete your account and all of its data. We email you a confirmation link
          first; nothing is deleted until you open it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? <AuthFormError message={error} /> : null}
        {sent ? (
          <SecurityNotice>
            We sent a confirmation link to {email}. Your account is deleted only after you open it.
          </SecurityNotice>
        ) : null}
        <Button variant="destructive" className="self-start" onClick={() => setOpen(true)}>
          Delete account
        </Button>
      </CardContent>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete your account?"
        description={`We will email a confirmation link to ${email}. Your account and all of its data are deleted only after you open it.`}
        confirmLabel="Send confirmation link"
        onConfirm={handleConfirm}
      />
    </Card>
  );
}
