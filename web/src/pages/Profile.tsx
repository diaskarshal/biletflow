import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, saveTokens } from "../api/client";
import { Button } from "../components/Button";
import { ErrorState } from "../components/EmptyState";
import { Input } from "../components/Input";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../lib/format";
import { t, tOptional } from "../lib/i18n";
import type { components } from "../api/schema";

export function Profile() {
  const { user, logout } = useAuth();
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-8 sm:px-6 sm:py-12">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("nav.profile")}</h1>
        <p>{user?.email}</p>
        <EmailStatus />
        <Button variant="secondary" onClick={logout}>
          {t("profile.logout")}
        </Button>
      </section>
      {user && <NameForm key={user.full_name} name={user.full_name} />}
      <PasswordForm />
      <OrganizerProfile />
    </div>
  );
}

function EmailStatus() {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/me");
      if (error) throw error;
      return data;
    },
  });
  const resend = useMutation({
    mutationFn: async () => {
      const { error } = await api.POST("/api/v1/me/verification-email");
      if (error) throw error;
    },
  });
  if (!me.data) return null;
  if (me.data.email_verified_at) return <p>{t("profile.emailConfirmed")}</p>;
  return (
    <div className="space-y-2 border border-slate-400 p-3">
      <p>{t("profile.emailNotConfirmed")}</p>
      {resend.isSuccess ? (
        <p>{t("profile.linkSent")}</p>
      ) : (
        <Button variant="secondary" loading={resend.isPending} onClick={() => resend.mutate()}>
          {t("profile.resend")}
        </Button>
      )}
      {resend.isError && <ErrorState message={errorMessage(resend.error, t("profile.resendFailed"))} />}
    </div>
  );
}

function NameForm({ name }: { name: string }) {
  const { updateUser } = useAuth();
  const [value, setValue] = useState(name);
  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.PATCH("/api/v1/me", { body: { full_name: value } });
      if (error) throw error;
      return data;
    },
    onSuccess: updateUser,
  });
  return (
    <form
      className="space-y-3 border border-slate-300 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <h2 className="text-xl font-bold">{t("profile.yourName")}</h2>
      <Input required aria-label={t("common.fullName")} value={value} onChange={(e) => setValue(e.target.value)} />
      {save.isError && <ErrorState message={errorMessage(save.error)} />}
      <Button type="submit" disabled={value.trim() === name} loading={save.isPending}>
        {t("profile.saveName")}
      </Button>
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const change = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST("/api/v1/me/password", {
        body: { current_password: current, new_password: next },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (tokens) => {
      saveTokens(tokens);
      setCurrent("");
      setNext("");
    },
  });
  return (
    <form
      className="space-y-3 border border-slate-300 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        change.mutate();
      }}
    >
      <h2 className="text-xl font-bold">{t("profile.changePassword")}</h2>
      <label className="block space-y-1">
        <span className="block">{t("profile.currentPassword")}</span>
        <Input required type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label className="block space-y-1">
        <span className="block">{t("reset.new")}</span>
        <Input required type="password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
      </label>
      {change.isError && <ErrorState message={errorMessage(change.error)} />}
      {change.isSuccess && <p>{t("profile.passwordChanged")}</p>}
      <Button type="submit" loading={change.isPending}>
        {t("profile.changePassword")}
      </Button>
    </form>
  );
}

function OrganizerProfile() {
  const profile = useQuery({
    queryKey: ["organizer-profile"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/organizer/profile");
      if (error) throw error;
      return data;
    },
  });
  return profile.data ? <OrganizerForm profile={profile.data} /> : null;
}

function OrganizerForm({ profile }: { profile: components["schemas"]["OrganizerProfileOut"] }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    display_name: profile.display_name,
    contact_email: profile.contact_email,
    phone: profile.phone ?? "",
    payout_account: profile.payout_account ?? "",
  });
  const [file, setFile] = useState<File | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.PATCH("/api/v1/organizer/profile", {
        body: {
          display_name: form.display_name,
          contact_email: form.contact_email,
          phone: form.phone || null,
          payout_account: form.payout_account || null,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => queryClient.setQueryData(["organizer-profile"], data),
  });

  const upload = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST("/api/v1/organizer/verification", {
        body: { document: "" },
        bodySerializer: () => {
          const form = new FormData();
          form.append("document", file as File);
          return form;
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setFile(null);
      queryClient.setQueryData(["organizer-profile"], data);
    },
  });

  const status = profile.verification_status;

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">{t("org.title")}</h2>
      <form
        className="grid max-w-xl gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label={t("org.displayName")} id="display_name">
          <Input id="display_name" required value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
        </Field>
        <Field label={t("org.contactEmail")} id="contact_email">
          <Input id="contact_email" type="email" required value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
        </Field>
        <Field label={t("org.phone")} id="phone">
          <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label={t("org.payout")} id="payout_account">
          <Input id="payout_account" value={form.payout_account} onChange={(e) => setForm({ ...form, payout_account: e.target.value })} />
        </Field>
        <div>
          <Button type="submit" loading={save.isPending}>
            {t("common.save")}
          </Button>
          {save.isSuccess && <span className="ml-3">{t("common.saved")}</span>}
        </div>
        {save.isError && <ErrorState message={errorMessage(save.error, t("org.saveFailed"))} />}
      </form>

      <div className="space-y-3">
        <h3 className="text-xl font-bold">{t("org.verification")}</h3>
        <p>
          {t("org.status")}: <strong>{tOptional(`verification.${status}`) ?? status}</strong>
          {profile.verification_document && ` (${profile.verification_document})`}
        </p>
        <p className="text-sm">{t("org.verificationHint")}</p>
        {status !== "approved" && (
          <form
            className="flex flex-wrap items-center gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              upload.mutate();
            }}
          >
            <label htmlFor="document" className="sr-only">
              {t("org.document")}
            </label>
            <input id="document" type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Button type="submit" loading={upload.isPending} disabled={!file}>
              {t("org.upload")}
            </Button>
          </form>
        )}
        {upload.isError && <ErrorState message={errorMessage(upload.error, t("org.uploadFailed"))} />}
      </div>
    </section>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}
