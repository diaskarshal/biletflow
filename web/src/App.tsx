import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import { Placeholder } from "./pages/Placeholder";

const queryClient = new QueryClient();

function Nav() {
  return (
    <nav className="flex gap-4 border-b border-slate-200 px-6 py-3 text-sm">
      <Link to="/" className="font-semibold text-brand">
        BiletFlow
      </Link>
      <Link to="/login">Login</Link>
      <Link to="/register">Register</Link>
      <Link to="/organizer">Organizer</Link>
    </nav>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Placeholder title="Login" />} />
        <Route path="/register" element={<Placeholder title="Register" />} />
        <Route path="/events/:slug" element={<Placeholder title="Event" />} />
        <Route path="/organizer" element={<Placeholder title="Organizer Dashboard" />} />
        <Route path="/organizer/events/new" element={<Placeholder title="Create Event" />} />
      </Routes>
    </QueryClientProvider>
  );
}

export default App;
