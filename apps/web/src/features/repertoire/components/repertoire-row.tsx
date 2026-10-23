import { Button } from "@b2c-template/ui/components/button";
import { Spinner } from "@b2c-template/ui/components/spinner";
import { Link } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";

import { validateRepertoireName } from "../lib/repertoire-name";
import type { RepertoireSummary } from "../lib/repertoire-types";
import RepertoireNameField from "./repertoire-name-field";

export type RepertoireRowProps = {
  repertoire: RepertoireSummary;
  /** Rejects when the server refuses; the caller reports it and the row stays in edit mode. */
  onRename: (name: string) => Promise<unknown>;
  /** Rejects when the server refuses; the confirmation then stays open. */
  onDelete: () => Promise<unknown>;
};

/** One repertoire: link to the builder, inline rename, delete with confirmation (presentational). */
export default function RepertoireRow({ repertoire, onRename, onDelete }: RepertoireRowProps) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(repertoire.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function startEditing() {
    setName(repertoire.name);
    setError(null);
    setEditing(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validateRepertoireName(name);
    setError(problem);
    if (problem) {
      return;
    }
    setPending(true);
    try {
      await onRename(name.trim());
      setEditing(false);
    } catch {
      // The caller already reported the failure; stay in edit mode so nothing typed is lost.
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center">
      {editing ? (
        <form onSubmit={save} noValidate className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
          <RepertoireNameField
            id={`${id}-name`}
            label={`New name for ${repertoire.name}`}
            hideLabel
            value={name}
            onChange={setName}
            error={error}
            autoFocus
            disabled={pending}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={pending} className="h-11 px-4">
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setEditing(false)}
              className="h-11 px-4"
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <Link
            to="/repertoire/$id"
            params={{ id: repertoire.id }}
            className="flex min-h-11 min-w-0 flex-1 items-center rounded-md font-medium break-words outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {repertoire.name}
          </Link>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={startEditing}
              aria-label={`Rename ${repertoire.name}`}
              className="h-11 px-4"
            >
              <Pencil data-icon="inline-start" />
              Rename
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete ${repertoire.name}`}
              className="h-11 px-4"
            >
              <Trash2 data-icon="inline-start" />
              Delete
            </Button>
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete ${repertoire.name}?`}
        description="All its moves and idea notes are deleted too. This cannot be undone."
        confirmLabel="Delete repertoire"
        onConfirm={async () => void (await onDelete())}
      />
    </div>
  );
}
