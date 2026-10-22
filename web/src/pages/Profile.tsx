import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { ErrorState } from "../components/EmptyState";
import { Input } from "../components/Input";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../lib/format";
import type { components } from "../api/schema";

const VERIFICATION: Record<string, string> = {
  none: "Not submitted",
  pending: "Waiting for admin review",
  approved: "Approved",
  rejected: "Rejected, upload a new document",
};

export function Profile() {
  const { user, logout } = useAuth();
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-6 py-12">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold">Profile</h1>
        <p>
          {user?.full_name}, {user?.email}
        </p>
        <Button variant="secondary" onClick={logout}>
          Log out
        </Button>
      </section>
      <OrganizerProfile />
    </div>
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
      <h2 className="text-2xl font-bold">Organizer profile</h2>
      <form
        className="grid max-w-xl gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Display name" id="display_name">
          <Input id="display_name" required value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
        </Field>
        <Field label="Contact email" id="contact_email">
          <Input id="contact_email" type="email" required value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
        </Field>
        <Field label="Phone" id="phone">
          <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Payout account (IBAN, test data only)" id="payout_account">
          <Input id="payout_account" value={form.payout_account} onChange={(e) => setForm({ ...form, payout_account: e.target.value })} />
        </Field>
        <div>
          <Button type="submit" loading={save.isPending}>
            Save
          </Button>
          {save.isSuccess && <span className="ml-3">Saved.</span>}
        </div>
        {save.isError && <ErrorState message={errorMessage(save.error, "Could not save the profile")} />}
      </form>

      <div className="space-y-3">
        <h3 className="text-xl font-bold">Identity verification</h3>
        <p>
          Status: <strong>{VERIFICATION[status] ?? status}</strong>
          {profile.verification_document && ` (${profile.verification_document})`}
        </p>
        <p className="text-sm">Needed only to sell paid tickets. Upload any ID document; an admin reviews it.</p>
        {status !== "approved" && (
          <form
            className="flex flex-wrap items-center gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              upload.mutate();
            }}
          >
            <label htmlFor="document" className="sr-only">
              Verification document
            </label>
            <input id="document" type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Button type="submit" loading={upload.isPending} disabled={!file}>
              Upload
            </Button>
          </form>
        )}
        {upload.isError && <ErrorState message={errorMessage(upload.error, "Could not upload the document")} />}
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
