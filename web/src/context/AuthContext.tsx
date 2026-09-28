import { useState, useEffect, createContext, useContext, type ReactNode } from 'react'
import { api } from "../api/client";

type User = {
    full_name: string,
    email: string,
}

type AuthContextType = {
    user: User | null,
    token: string | null,
    login: (token: string, refreshToken: string, user: User) => void,
    logout: () => Promise<void>,
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function clearStorage() {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(() => {
        const stored = localStorage.getItem("user");
        return stored ? JSON.parse(stored) : null;
    });
    const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));

    // If the refresh flow gives up, log out locally
    useEffect(() => {
        function handleExpired() {
            clearStorage();
            setToken(null);
            setUser(null);
        }
        window.addEventListener("auth:expired", handleExpired);
        return () => window.removeEventListener("auth:expired", handleExpired);
    }, []);

    // On app load, check that the saved session still works
    useEffect(() => {
        if (!localStorage.getItem("token")) return;
        api.GET("/api/v1/me")
            .then(({ data }) => {
                if (data) setUser(data);
            })
            .catch(() => {});
    }, []);

    function login(newToken: string, refreshToken: string, newUser: User) {
        localStorage.setItem("token", newToken);
        localStorage.setItem("refresh_token", refreshToken);
        localStorage.setItem("user", JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
    }

    async function logout() {
        try {
            await api.POST("/api/v1/auth/logout");
        } catch {
            // network failure: log out locally anyway
        }
        clearStorage();
        setToken(null);
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, token, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used inside an AuthProvider");
    }
    return context;
}