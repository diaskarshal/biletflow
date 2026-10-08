import { Button } from "../components/Button";
import { useAuth } from "../context/AuthContext";

export function Profile() {
  const { user, logout } = useAuth();
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-12">
      <h1 className="font-heading text-5xl">Profile</h1>
      <dl className="space-y-1 text-2xl">
        <div>{user?.full_name}</div>
        <div>{user?.email}</div>
      </dl>
      <Button onClick={logout}>Log out</Button>
    </div>
  );
}
