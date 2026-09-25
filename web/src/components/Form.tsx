import { useState } from 'react'
import { useMutation } from '@tanstack/react-query';
import { api } from "../api/client";

export function Form() {
    type Creds = {
        email: string, 
        password: string,
    }

    const [creds, setCreds] = useState<Creds>({email: "", password: ""});

    const { mutate, isPending, isError, isSuccess} = useMutation({
        mutationFn: async (credentials: Creds) => {
            const { data, error } = await api.POST("/api/v1/auth/login", { body: credentials });
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
            return "Login or password is incorrect";
        }
        else if (isSuccess) {
            return "Logged in";
        }
    }

    return (
       <form onSubmit={handleSubmit}>
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
            <button type="submit">Log in</button>
            <p>Debug : {JSON.stringify(creds)}</p>
            <p>Status : {handleStatus()} </p>
       </form> 
    );
}