import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { backendInterface } from "../backend";
import { createActorWithConfig } from "../config";

const ACTOR_QUERY_KEY = "actor-internal";

/**
 * Internal-auth version of useActor.
 * Does NOT use InternetIdentity -- creates an anonymous actor only.
 * Session tokens are passed per-call by the auth layer.
 */
export function useActorInternal() {
  const queryClient = useQueryClient();
  const actorQuery = useQuery<backendInterface>({
    queryKey: [ACTOR_QUERY_KEY],
    queryFn: async () => {
      // Internal auth uses session tokens passed per backend call.
      // We only need an anonymous actor here.
      return await createActorWithConfig();
    },
    staleTime: Number.POSITIVE_INFINITY,
    enabled: true,
  });

  // When the actor becomes available, invalidate dependent queries
  useEffect(() => {
    if (actorQuery.data) {
      queryClient.invalidateQueries({
        predicate: (query) => !query.queryKey.includes(ACTOR_QUERY_KEY),
      });
    }
  }, [actorQuery.data, queryClient]);

  return {
    actor: actorQuery.data ?? null,
    isFetching: actorQuery.isFetching,
  };
}
