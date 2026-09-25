import { useState } from 'react'

export function Form() {
    type Creds = {
        email: string, 
        password: string,
    }

    const [creds, setCreds] = useState<Creds>({email: "", password: ""});
    
    function handleChange(e:React.ChangeEvent<HTMLInputElement>) {
        const { name, value } = e.target;
        setCreds((prev) => ({...prev, [name]: value}));
    }

    return (
       <form>
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
            <p>Debug : {JSON.stringify(creds)}</p>
       </form> 
    );
}