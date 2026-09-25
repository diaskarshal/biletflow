import { useState } from 'react'
import { useMutation } from '@tanstack/react-query';
import { api } from "../api/client";

export function RegisterForm() {
    type RegisterCreds = {
        full_name: string,
        email: string, 
        password: string,
    }

    const [creds, setCreds] = useState<RegisterCreds>({full_name: "", email: "", password: ""});

    const { mutate, isPending, isError, isSuccess, error} = useMutation({
        mutationFn: async (credentials: RegisterCreds) => {
            const { data, error } = await api.POST("/api/v1/auth/register", { body: credentials });
            if (error) throw error;
            return data;
        },
    });
    
    function handleChange(e:React.ChangeEvent<HTMLInputElement>) {
        const { name, value } = e.target;
        setCreds((prev) => ({...prev, [name]: value}));
    }

    function handleSubmit(e:React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()
        mutate(creds);
    }

    function handleStatus() {
        if (isPending) {
            return "Loading";
        }
        else if (isError) {
            return error.message;
        }
        else if (isSuccess) {
            return "Registered";
        }
    }

    return (
       <form onSubmit={handleSubmit}>
            <label>
                Enter your full name:
                <input
                    type="text"
                    name="full_name"
                    value={creds.full_name}
                    onChange={handleChange}
                />
            </label>
            <label>
                Enter your email:
                <input
                    type="text"
                    name="email"
                    value={creds.email}
                    onChange={handleChange}
                />
            </label>
            <label>
                Enter your password:
                <input
                    type="password"
                    name="password"
                    value={creds.password}
                    onChange={handleChange}
                />
            </label>
            <button type="submit">Register</button>
            <p>Debug : {JSON.stringify(creds)}</p>
            <p>Status : {handleStatus()} </p>
       </form> 
    );
}