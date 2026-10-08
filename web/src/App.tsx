import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import { Placeholder } from "./pages/Placeholder";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { NotFound } from "./pages/NotFound";
import { EventPage } from "./pages/EventPage";
import { MyTickets } from "./pages/MyTickets";
import { Profile } from "./pages/Profile";
import { AuthProvider } from "./context/AuthContext";
import { Layout } from "./components/layout/Layout";
import { RequireAuth } from "./components/layout/RequireAuth";

const queryClient = new QueryClient();

function App() {
    return (
        <AuthProvider>
            <QueryClientProvider client={queryClient}>
                <Routes>
                    <Route element={<Layout />}>
                        <Route path="/" element={<Home />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/events/:slug" element={<EventPage />} />
                        <Route element={<RequireAuth />}>
                            <Route path="/tickets" element={<MyTickets />} />
                            <Route path="/profile" element={<Profile />} />
                            <Route path="/organizer" element={<Placeholder title="Organizer Dashboard" />} />
                            <Route path="/organizer/events/new" element={<Placeholder title="Create Event" />} />
                        </Route>
                        <Route path="*" element={<NotFound />} />
                    </Route>
                </Routes>
            </QueryClientProvider>
        </AuthProvider>
    );
}

export default App;
