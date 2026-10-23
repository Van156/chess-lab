import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/app/orpc";

/**
 * The user's repertoires and the three list actions. The mutations resolve (or reject) so the
 * caller can keep a form or dialog open on failure; every settled write reloads the list.
 */
export function useRepertoires() {
  const queryClient = useQueryClient();
  const reload = () => queryClient.invalidateQueries({ queryKey: orpc.repertoire.key() });

  const list = useQuery(orpc.repertoire.list.queryOptions());
  const create = useMutation({ ...orpc.repertoire.create.mutationOptions(), onSettled: reload });
  const rename = useMutation({ ...orpc.repertoire.rename.mutationOptions(), onSettled: reload });
  const remove = useMutation({ ...orpc.repertoire.delete.mutationOptions(), onSettled: reload });

  return {
    repertoires: list.data,
    isPending: list.isPending,
    retry: () => void list.refetch(),
    create: create.mutateAsync,
    rename: rename.mutateAsync,
    remove: remove.mutateAsync,
  };
}
