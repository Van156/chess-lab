import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/app/orpc";

/**
 * Saves the explorer rating band offset (`settings.update`). The band applies to every position,
 * so all explorer queries reload. The mutation stays pending until they have, which keeps the band
 * control busy until the new stats are in; on failure nothing changes and the caller reports it.
 */
export function useExplorerBand() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    ...orpc.settings.update.mutationOptions(),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: orpc.repertoire.explorer.key(),
      }),
  });
  return {
    /** Input: `{ explorerBandOffset }`, an integer from -2 to 2. */
    setOffset: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
