import { useActorInternal } from "./useActorInternal";
import { useAuth } from "./useAuth";

/**
 * Wraps actor calls with automatic token injection.
 * Uses the internal-auth actor (no Internet Identity) with session tokens.
 */
export function useBackend() {
  const { actor, isFetching } = useActorInternal();
  const { token } = useAuth();
  return { actor, token, isFetching };
}
