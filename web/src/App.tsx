import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import { Organizer } from "./pages/Organizer";
import { NewEvent } from "./pages/NewEvent";
import { ManageEvent } from "./pages/ManageEvent";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { NotFound } from "./pages/NotFound";
import { EventPage } from "./pages/EventPage";
import { MyTickets } from "./pages/MyTickets";
import { Profile } from "./pages/Profile";
import { Payment } from "./pages/Payment";
import { Admin } from "./pages/Admin";
import { Analytics } from "./pages/Analytics";
import { NewSupportCase, Support, SupportCase } from "./pages/Support";
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
                            <Route path="/pay/:id" element={<Payment />} />
                            <Route path="/admin" element={<Admin />} />
                            <Route path="/support" element={<Support />} />
                            <Route path="/support/new" element={<NewSupportCase />} />
                            <Route path="/support/:id" element={<SupportCase />} />
                            <Route path="/organizer" element={<Organizer />} />
                            <Route path="/organizer/events/new" element={<NewEvent />} />
                            <Route path="/organizer/events/:id" element={<ManageEvent />} />
                            <Route path="/organizer/events/:id/analytics" element={<Analytics />} />
                        </Route>
                        <Route path="*" element={<NotFound />} />
                    </Route>
                </Routes>
            </QueryClientProvider>
        </AuthProvider>
    );
}

export default App;
