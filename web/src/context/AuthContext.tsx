import { useState, useEffect, createContext, useContext, type ReactNode } from 'react'
import { clearSession, saveTokens } from '../api/client';
import type { components } from '../api/schema';

type User = components["schemas"]["UserOut"];

type Tokens = {
    access_token: string,
    refresh_token: string,
}

type AuthContextType = {
    user: User | null,
    login: (tokens: Tokens, user: User) => void,
    updateUser: (user: User) => void,
    logout: () => void,
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(() => {
        const stored = localStorage.getItem("user");
        return stored ? JSON.parse(stored) : null;
    });

    useEffect(() => {
        const onLogout = () => setUser(null);
        window.addEventListener("auth:logout", onLogout);
        return () => window.removeEventListener("auth:logout", onLogout);
    }, []);

    function updateUser(newUser: User) {
        localStorage.setItem("user", JSON.stringify(newUser));
        setUser(newUser);
    }

    function login(tokens: Tokens, newUser: User) {
        saveTokens(tokens);
        updateUser(newUser);
    }

    return (
        <AuthContext.Provider value={{ user, login, updateUser, logout: clearSession }}>
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
