import { useActor } from "./useActor";
import { useAuth } from "./useAuth";

/**
 * Wraps actor calls with automatic token injection.
 * Use this when you need both the actor and the current session token.
 */
export function useBackend() {
  const { actor, isFetching } = useActor();
  const { token } = useAuth();
  return { actor, token, isFetching };
}
