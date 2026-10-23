import { toast } from "sonner";

import LoadError from "@/shared/components/feedback/load-error";
import Loader from "@/shared/components/feedback/loader";

import { useRepertoires } from "../hooks/use-repertoires";
import RepertoireListView from "./repertoire-list-view";

/** Runs a write; a failure is reported as a toast and re-thrown so the form or dialog stays open. */
async function reported<T>(write: Promise<T>, failure: string): Promise<T> {
  try {
    return await write;
  } catch (error) {
    toast.error(error instanceof Error && error.message ? error.message : failure);
    throw error;
  }
}

/** `/repertoire` (container): loads the user's repertoires and wires create, rename and delete. */
export default function RepertoiresPage() {
  const { repertoires, isPending, retry, create, rename, remove } = useRepertoires();

  if (isPending) {
    return <Loader />;
  }
  if (!repertoires) {
    return <LoadError message="Your repertoires could not be loaded." onRetry={retry} />;
  }
  return (
    <RepertoireListView
      repertoires={repertoires}
      onCreate={(input) => reported(create(input), "The repertoire could not be created.")}
      onRename={(id, name) =>
        reported(rename({ id, name }), "The repertoire could not be renamed.")
      }
      onDelete={(id) => reported(remove({ id }), "The repertoire could not be deleted.")}
    />
  );
}
