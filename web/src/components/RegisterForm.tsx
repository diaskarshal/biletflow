import { useState } from 'react'
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from "../api/client";
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { errorMessage } from '../lib/format';

const MIN_PASSWORD = 8;

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
        if (isError) return errorMessage(error);
        if (isSuccess) return "Registered! Redirecting to login…";
        return null;
    }

    const status = handleStatus();
    const tooShort = creds.password.length > 0 && creds.password.length < MIN_PASSWORD;

    return (
        <form onSubmit={handleSubmit} className="mx-auto mt-16 max-w-md space-y-5 rounded-[2.5rem] bg-sky p-10">
            <h1 className="font-heading text-2xl font-bold text-brand">Register</h1>

            <label className="flex flex-col gap-1">
                <span className="text-sm text-brand font-heading">Full name</span>
                <Input
                    type="text"
                    name="full_name"
                    value={creds.full_name}
                    onChange={handleChange}
                />
            </label>

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
                    aria-describedby="password-rules"
                />
                <span id="password-rules" className={`text-sm ${tooShort ? "text-red-600" : "text-slate-600"}`}>
                    At least {MIN_PASSWORD} characters{tooShort ? `, ${MIN_PASSWORD - creds.password.length} more needed` : ""}
                </span>
            </label>

            <Button type="submit" disabled={isPending || creds.password.length < MIN_PASSWORD} className="w-full py-3">
                Register
            </Button>

            {status && (
                <p className={`text-sm ${isError ? "text-red-600" : isSuccess ? "text-emerald-600" : "text-slate-500"}`}>
                    {status}
                </p>
            )}
            <Link to="/login" className="block text-center text-sm underline">Have an account? Log in</Link>
        </form>
    );
}