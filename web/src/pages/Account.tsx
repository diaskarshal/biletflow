import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { ErrorState } from "../components/EmptyState";
import { Input } from "../components/Input";
import { Spinner } from "../components/Spinner";
import { errorMessage } from "../lib/format";
import { t } from "../lib/i18n";

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
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
    <Page title={t("verify.title")}>
      {verify.isLoading && <Spinner />}
      {verify.isError && <ErrorState message={errorMessage(verify.error, t("verify.invalid"))} />}
      {verify.isSuccess && <p>{t("verify.done", { email: verify.data.email })}</p>}
      <Link className="underline" to="/">
        {t("verify.toEvents")}
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
    <Page title={t("forgot.title")}>
      {send.isSuccess ? (
        <p>{t("forgot.sent", { email })}</p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <label className="block space-y-1">
            <span className="block">{t("common.email")}</span>
            <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {send.isError && <ErrorState message={errorMessage(send.error)} />}
          <Button type="submit" loading={send.isPending}>
            {t("forgot.send")}
          </Button>
        </form>
      )}
      <Link className="block underline" to="/login">
        {t("forgot.back")}
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
      <Page title={t("reset.doneTitle")}>
        <p>{t("reset.done")}</p>
        <Link className="underline" to="/login">
          {t("login.submit")}
        </Link>
      </Page>
    );
  }
  return (
    <Page title={t("reset.title")}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          reset.mutate();
        }}
      >
        <label className="block space-y-1">
          <span className="block">{t("reset.new")}</span>
          <Input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="block">{t("reset.repeat")}</span>
          <Input required type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </label>
        {repeat && repeat !== password && <p className="text-red-700">{t("reset.mismatch")}</p>}
        {reset.isError && <ErrorState message={errorMessage(reset.error)} />}
        <Button type="submit" disabled={password !== repeat} loading={reset.isPending}>
          {t("reset.save")}
        </Button>
      </form>
    </Page>
  );
}
