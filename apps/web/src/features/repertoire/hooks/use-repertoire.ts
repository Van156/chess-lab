import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/app/orpc";

import { shouldRetryRepertoire } from "../lib/repertoire-query";

/**
 * One repertoire as a position graph, with the edit actions of the builder. The error is kept so
 * the page can tell "not found" from a failure. Each settled write reloads the graph, so the
 * tree always shows what the server holds (pruning and transpositions are decided there).
 */
export function useRepertoire(id: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    ...orpc.repertoire.get.queryOptions({ input: { id } }),
    retry: shouldRetryRepertoire,
  });
  const reload = () =>
    queryClient.invalidateQueries({ queryKey: orpc.repertoire.get.key({ input: { id } }) });

  const addMove = useMutation({ ...orpc.repertoire.addMove.mutationOptions(), onSettled: reload });
  const deleteMove = useMutation({
    ...orpc.repertoire.deleteMove.mutationOptions(),
    onSettled: reload,
  });
  const restoreDeleted = useMutation({
    ...orpc.repertoire.restoreDeleted.mutationOptions(),
    onSettled: reload,
  });
  const setIdeaNote = useMutation({
    ...orpc.repertoire.setIdeaNote.mutationOptions(),
    onSettled: reload,
  });
  const setBase = useMutation({
    ...orpc.repertoire.setBase.mutationOptions(),
    onSettled: reload,
  });
  const renameLine = useMutation({
    ...orpc.repertoire.renameLine.mutationOptions(),
    onSettled: reload,
  });

  return {
    repertoire: query.data,
    error: query.error,
    isPending: query.isPending,
    retry: () => void query.refetch(),
    /** Input: `{ repertoireId, fromPositionId, move }` (SAN or UCI). */
    addMove: addMove.mutateAsync,
    /** Input: `{ repertoireId, moveId }`. */
    deleteMove: deleteMove.mutateAsync,
    /** Input: `{ repertoireId, snapshot }`, the snapshot `deleteMove` returned; undoes that delete. */
    restoreDeleted: restoreDeleted.mutateAsync,
    /** Input: `{ repertoireId, positionId, arrows, highlights, plan }`; an empty note clears it. */
    setIdeaNote: setIdeaNote.mutateAsync,
    /** Input: `{ repertoireId, positionId }`; a null position clears the base. */
    setBase: setBase.mutateAsync,
    isSettingBase: setBase.isPending,
    /** Input: `{ repertoireId, moveId, name }`; a null name clears the line's name. */
    renameLine: renameLine.mutateAsync,
    isSaving:
      addMove.isPending ||
      deleteMove.isPending ||
      restoreDeleted.isPending ||
      setIdeaNote.isPending,
  };
}
