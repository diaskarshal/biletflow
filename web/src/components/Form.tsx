import { useState } from 'react'
import { useMutation } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from "../api/client";
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

export function Form() {
    type Creds = {
        email: string,
        password: string,
    }

    const [creds, setCreds] = useState<Creds>({ email: "", password: "" });
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const { mutate, isPending, isError, isSuccess } = useMutation({
        mutationFn: async (credentials: Creds) => {
            const { data, error } = await api.POST("/api/v1/auth/login", { body: credentials });
            if (error) throw error;
            return data;
        },
        onSuccess: async (data) => {
            const { data: me } = await api.GET("/api/v1/me", {
                headers: { Authorization: `Bearer ${data.access_token}` },
            });
            if (!me) throw new Error("Failed to fetch user after login");
            login(data, me);
            const next = new URLSearchParams(location.search).get("next");
            // Only follow same-origin paths to avoid open redirects.
            navigate(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
        },
    });

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const { name, value } = e.target;
        setCreds((prev) => ({ ...prev, [name]: value }));
    }

    function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        mutate(creds);
    }

    function handleStatus() {
        if (isPending) return "Loading";
        if (isError) return "Login or password is incorrect";
        if (isSuccess) return "Logged in";
        return null;
    }

    const status = handleStatus();

    return (
        <form onSubmit={handleSubmit} className="mx-auto mt-16 max-w-md space-y-5 rounded-[2.5rem] bg-sky p-10">
            <h1 className="font-heading text-2xl font-bold text-brand">Log in</h1>

            <label className="flex flex-col gap-1">
                <span className="text-sm text-brand font-heading">Email</span>
                <Input
                    type="text"
                    name="email"
                    value={creds.email}
                    onChange={handleChange}
                />
            </label>

            <label className="flex flex-col gap-1">
                <span className="text-sm text-brand font-heading">Password</span>
                <Input
                    type="password"
                    name="password"
                    value={creds.password}
                    onChange={handleChange}
                />
            </label>

            <Button type="submit" disabled={isPending} className="w-full py-3">
                Log in
            </Button>

            {status && (
                <p className={`text-sm ${isError ? "text-red-600" : isSuccess ? "text-emerald-600" : "text-slate-500"}`}>
                    {status}
                </p>
            )}
            <Link to="/register" className="block text-center text-sm underline">No account? Register</Link>
        </form>
    );
}