import { useState, createContext, useContext, type ReactNode } from 'react';
import { api } from "../api/client";

type User = {
    full_name: string,
    email: string,
}

type AuthContextType = {
    user: User | null,
    token: string | null,
    login: (token: string, user: User) => void,
    logout: () => Promise<void>,
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(() => {
        const stored = localStorage.getItem("user");
        return stored ? JSON.parse(stored) : null;
    });
    const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));

    function login(newToken: string, newUser: User) {
        localStorage.setItem("token", newToken);
        localStorage.setItem("user", JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
    }

    async function logout() {
        try {
            await api.POST("/api/v1/auth/logout");
        } catch {
            // Network failure: log out locally anyway
        }
        localStorage.removeItem("token");
        localStorage.removeItem("user");
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