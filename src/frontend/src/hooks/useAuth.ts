import {
  type PropsWithChildren,
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useActor } from "./useActor";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserInfo {
  userId: bigint;
  name: string;
  role: { admin: null } | { user: null } | { guest: null };
}

export interface AuthContext {
  token: string | null;
  userId: bigint | null;
  userInfo: UserInfo | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (
    username: string,
    password: string,
  ) => Promise<{ ok?: true; err?: string }>;
  register: (
    username: string,
    password: string,
  ) => Promise<{ ok?: true; err?: string }>;
  logout: () => Promise<void>;
}

const SESSION_TOKEN_KEY = "qam_session_token";

// ── Context ───────────────────────────────────────────────────────────────────

const AuthReactContext = createContext<AuthContext | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

function AuthProviderInner({ children }: PropsWithChildren) {
  const { actor, isFetching } = useActor();
  const [token, setToken] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  // Prevent double-init when actor changes
  const initDoneRef = useRef(false);

  // On mount (or when actor becomes available), try to restore a stored session
  useEffect(() => {
    if (isFetching || !actor) return;
    if (initDoneRef.current) return;
    initDoneRef.current = true;

    const stored = localStorage.getItem(SESSION_TOKEN_KEY);
    if (!stored) {
      setIsInitializing(false);
      return;
    }

    // Validate the stored token via whoami
    (async () => {
      try {
        // The new backend has `whoami(sessionToken)` returning { ok: UserInfo } | { err: string }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (actor as any).whoami(stored);
        if (result && "ok" in result) {
          setToken(stored);
          setUserInfo(result.ok as UserInfo);
        } else {
          localStorage.removeItem(SESSION_TOKEN_KEY);
        }
      } catch {
        localStorage.removeItem(SESSION_TOKEN_KEY);
      } finally {
        setIsInitializing(false);
      }
    })();
  }, [actor, isFetching]);

  const login = useCallback(
    async (
      username: string,
      password: string,
    ): Promise<{ ok?: true; err?: string }> => {
      if (!actor) return { err: "Not connected" };
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (actor as any).login(username, password);
        if (result && "ok" in result) {
          const newToken = result.ok as string;
          localStorage.setItem(SESSION_TOKEN_KEY, newToken);
          setToken(newToken);
          // Fetch user info
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const whoamiResult = await (actor as any).whoami(newToken);
            if (whoamiResult && "ok" in whoamiResult) {
              setUserInfo(whoamiResult.ok as UserInfo);
            }
          } catch {
            // non-critical
          }
          return { ok: true };
        }
        return { err: (result?.err as string) ?? "Login failed" };
      } catch (e) {
        return { err: e instanceof Error ? e.message : "Login failed" };
      }
    },
    [actor],
  );

  const register = useCallback(
    async (
      username: string,
      password: string,
    ): Promise<{ ok?: true; err?: string }> => {
      if (!actor) return { err: "Not connected" };
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (actor as any).register(username, password);
        if (result && "ok" in result) {
          // Auto-login after registration
          return await login(username, password);
        }
        return { err: (result?.err as string) ?? "Registration failed" };
      } catch (e) {
        return { err: e instanceof Error ? e.message : "Registration failed" };
      }
    },
    [actor, login],
  );

  const logout = useCallback(async () => {
    if (token && actor) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (actor as any).logout(token);
      } catch {
        // ignore errors during logout
      }
    }
    localStorage.removeItem(SESSION_TOKEN_KEY);
    setToken(null);
    setUserInfo(null);
  }, [actor, token]);

  const value = useMemo<AuthContext>(
    () => ({
      token,
      userId: userInfo?.userId ?? null,
      userInfo,
      isAuthenticated: !!token && !!userInfo,
      isInitializing,
      login,
      register,
      logout,
    }),
    [token, userInfo, isInitializing, login, register, logout],
  );

  return createElement(AuthReactContext.Provider, { value, children });
}

export function AuthProvider({ children }: PropsWithChildren) {
  return createElement(AuthProviderInner, { children });
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContext {
  const context = useContext(AuthReactContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
