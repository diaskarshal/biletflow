import { useState } from 'react'
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from "../api/client";
import { Button } from '../components/Button';
import { Input } from '../components/Input';

export function RegisterForm() {
    type RegisterCreds = {
        full_name: string,
        email: string,
        password: string,
    }

    const [creds, setCreds] = useState<RegisterCreds>({ full_name: "", email: "", password: "" });
    const navigate = useNavigate();

    const { mutate, isPending, isError, isSuccess, error } = useMutation({
        mutationFn: async (credentials: RegisterCreds) => {
            const { data, error } = await api.POST("/api/v1/auth/register", { body: credentials });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            navigate("/login");
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
        if (isError) return (error as any)?.error?.message ?? "Something went wrong";
        if (isSuccess) return "Registered! Redirecting to login…";
        return null;
    }

    const status = handleStatus();

    return (
        <form onSubmit={handleSubmit} className="mx-auto max-w-sm space-y-4 p-6">
            <h1 className="font-heading text-2xl font-bold text-slate-900">Register</h1>

            <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-700">Full name</span>
                <Input
                    type="text"
                    name="full_name"
                    value={creds.full_name}
                    onChange={handleChange}
                />
            </label>

            <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-700">Email</span>
                <Input
                    type="text"
                    name="email"
                    value={creds.email}
                    onChange={handleChange}
                />
            </label>

            <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-700">Password</span>
                <Input
                    type="password"
                    name="password"
                    value={creds.password}
                    onChange={handleChange}
                />
            </label>

            <Button type="submit" disabled={isPending}>
                Register
            </Button>

            {status && (
                <p className={`text-sm ${isError ? "text-red-600" : isSuccess ? "text-emerald-600" : "text-slate-500"}`}>
                    {status}
                </p>
            )}
        </form>
    );
}