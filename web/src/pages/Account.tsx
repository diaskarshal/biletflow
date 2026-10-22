import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { ErrorState } from "../components/EmptyState";
import { Input } from "../components/Input";
import { Spinner } from "../components/Spinner";
import { errorMessage } from "../lib/format";

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md space-y-4 px-6 py-12">
      <h1 className="text-3xl font-bold">{title}</h1>
      {children}
    </div>
  );
}

export function VerifyEmail() {
  const token = useSearchParams()[0].get("token") ?? "";
  const verify = useQuery({
    queryKey: ["verify-email", token],
    retry: false,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await api.POST("/api/v1/auth/verify-email", { body: { token } });
      if (error) throw error;
      return data;
    },
  });
  return (
    <Page title="Email confirmation">
      {verify.isLoading && <Spinner />}
      {verify.isError && <ErrorState message={errorMessage(verify.error, "This link is invalid or has expired")} />}
      {verify.isSuccess && <p>Your email address {verify.data.email} is confirmed.</p>}
      <Link className="underline" to="/">
        Go to events
      </Link>
    </Page>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const send = useMutation({
    mutationFn: async () => {
      const { error } = await api.POST("/api/v1/auth/forgot-password", { body: { email } });
      if (error) throw error;
    },
  });
  return (
    <Page title="Reset your password">
      {send.isSuccess ? (
        <p>If an account exists for {email}, we sent a link to reset the password. It works for one hour.</p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <label className="block space-y-1">
            <span className="block">Email</span>
            <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {send.isError && <ErrorState message={errorMessage(send.error)} />}
          <Button type="submit" loading={send.isPending}>
            Send reset link
          </Button>
        </form>
      )}
      <Link className="block underline" to="/login">
        Back to log in
      </Link>
    </Page>
  );
}

export function ResetPassword() {
  const token = useSearchParams()[0].get("token") ?? "";
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const reset = useMutation({
    mutationFn: async () => {
      const { error } = await api.POST("/api/v1/auth/reset-password", { body: { token, password } });
      if (error) throw error;
    },
  });
  if (reset.isSuccess) {
    return (
      <Page title="Password changed">
        <p>You can now log in with your new password.</p>
        <Link className="underline" to="/login">
          Log in
        </Link>
      </Page>
    );
  }
  return (
    <Page title="Choose a new password">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          reset.mutate();
        }}
      >
        <label className="block space-y-1">
          <span className="block">New password (at least 8 characters)</span>
          <Input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="block">Repeat new password</span>
          <Input required type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </label>
        {repeat && repeat !== password && <p className="text-red-700">The passwords do not match.</p>}
        {reset.isError && <ErrorState message={errorMessage(reset.error)} />}
        <Button type="submit" disabled={password !== repeat} loading={reset.isPending}>
          Save new password
        </Button>
      </form>
    </Page>
  );
}
