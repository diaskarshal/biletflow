import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import type { ReactNode } from "react";
import { getCurrentUser, loginUser, logoutUser } from "../api/auth";
import type { LoginData, User } from "../api/auth";
import { ApiError, hasStoredTokens, setSessionExpiredHandler } from "../api/client";

// loading     - checking for a saved session at launch
// signedOut   - no valid session, show Login/Register
// signedIn    - valid session, show the app
// unreachable - a session may exist but the server can't be reached right now
type SessionStatus = "loading" | "signedOut" | "signedIn" | "unreachable";

type SessionValue = {
    status: SessionStatus;
    user: User | null;
    signIn: (data: LoginData) => Promise<void>;
    signOut: () => Promise<void>;
    retry: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<SessionStatus>("loading");
    const [user, setUser] = useState<User | null>(null);

    const restoreSession = useCallback(async () => {
        setStatus("loading");

        if (!(await hasStoredTokens())) {
            setStatus("signedOut");
            return;
        }

        try {
            setUser(await getCurrentUser());
            setStatus("signedIn");
        } catch (error) {
            const serverDown =
                error instanceof ApiError &&
                (error.code === "NETWORK_ERROR" || error.status >= 500);
            if (serverDown) {
                setStatus("unreachable");
            } else {
                setUser(null);
                setStatus("signedOut");
            }
        }
    }, []);

    useEffect(() => {
        setSessionExpiredHandler(() => {
            setUser(null);
            setStatus("signedOut");
        });
        restoreSession();
        return () => setSessionExpiredHandler(null);
    }, [restoreSession]);

    const signIn = useCallback(async (data: LoginData) => {
        const signedInUser = await loginUser(data);
        setUser(signedInUser);
        setStatus("signedIn");
    }, []);

    const signOut = useCallback(async () => {
        await logoutUser();
        setUser(null);
        setStatus("signedOut");
    }, []);

    const value = useMemo(
        () => ({ status, user, signIn, signOut, retry: restoreSession }),
        [status, user, signIn, signOut, restoreSession]
    );

    return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
    const value = useContext(SessionContext);
    if (!value) {
        throw new Error("useSession must be used inside <SessionProvider>");
    }
    return value;
}
