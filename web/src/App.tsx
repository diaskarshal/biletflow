import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import { Placeholder } from "./pages/Placeholder";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { AuthProvider } from "./context/AuthContext";

import { useAuth } from "./context/AuthContext";

const queryClient = new QueryClient();

function Nav() {
    const { user, logout } = useAuth();

    return (
        <nav className="flex gap-4 border-b border-slate-200 px-6 py-3 text-sm">
            <Link to="/" className="font-semibold text-brand">
                BiletFlow
            </Link>
            {user ? <button onClick={logout}>Logout</button> : <Link to="/login">Login</Link>}
            <Link to="/register">Register</Link>
            <Link to="/organizer">Organizer</Link>
            <span>{user ? `Logged in as ${user.full_name}` : "Not logged in"}</span>
        </nav>
    );
}

function App() {
    
    return (
        <AuthProvider>
            <QueryClientProvider client={queryClient}>
                <Nav />
                <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login/>} />
                <Route path="/register" element={<Register/>} />
                <Route path="/events/:slug" element={<Placeholder title="Event" />} />
                <Route path="/organizer" element={<Placeholder title="Organizer Dashboard" />} />
                <Route path="/organizer/events/new" element={<Placeholder title="Create Event" />} />
                </Routes>
            </QueryClientProvider>
        </AuthProvider>
    );
}

export default App;
