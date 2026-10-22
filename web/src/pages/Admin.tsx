import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Block, Table } from "../components/Block";
import { Button } from "../components/Button";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Input } from "../components/Input";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../lib/format";

export function Admin() {
  const { user } = useAuth();
  if (!user?.is_admin) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <ErrorState message="This page is for platform admins." />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-5xl space-y-10 px-6 py-12">
      <h1 className="text-3xl font-bold">Platform admin</h1>
      <Verifications />
      <ActivationFee />
      <Activations />
    </div>
  );
}

function Verifications() {
  const queryClient = useQueryClient();
  const pending = useQuery({
    queryKey: ["admin-organizers"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/admin/organizers", { params: { query: { status: "pending" } } });
      if (error) throw error;
      return data;
    },
  });
  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "rejected" }) => {
      const { error } = await api.POST("/api/v1/admin/organizers/{organizer_id}/verification", {
        params: { path: { organizer_id: id } },
        body: { status },
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-organizers"] }),
  });

  return (
    <Block title="Organizer verification requests">
      {pending.isError && <ErrorState message={errorMessage(pending.error)} />}
      {pending.data?.length === 0 && <EmptyState title="No requests waiting" />}
      {!!pending.data?.length && (
        <Table head={["Organizer", "Email", "Document", "Payout account", ""]}>
          {pending.data.map((o) => (
            <tr key={o.id} className="border-b border-slate-200">
              <td className="py-2 pr-4">{o.display_name}</td>
              <td className="py-2 pr-4">{o.email}</td>
              <td className="py-2 pr-4">{o.verification_document}</td>
              <td className="py-2 pr-4">{o.payout_account ?? "Not set"}</td>
              <td className="space-x-2 py-2 text-right whitespace-nowrap">
                <Button onClick={() => decide.mutate({ id: o.id, status: "approved" })} disabled={decide.isPending}>
                  Approve
                </Button>
                <Button variant="danger" onClick={() => decide.mutate({ id: o.id, status: "rejected" })} disabled={decide.isPending}>
                  Reject
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}
      {decide.isError && <ErrorState message={errorMessage(decide.error)} />}
    </Block>
  );
}

function ActivationFee() {
  const fee = useQuery({
    queryKey: ["admin-fee"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/admin/settings/activation-fee");
      if (error) throw error;
      return data;
    },
  });
  return (
    <Block title="Paid sales activation fee">
      {fee.data && <FeeForm initial={fee.data.amount_kzt} />}
    </Block>
  );
}

function FeeForm({ initial }: { initial: number }) {
  const [value, setValue] = useState(String(initial));
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await api.PUT("/api/v1/admin/settings/activation-fee", { body: { amount_kzt: Number(value) } });
      if (error) throw error;
    },
  });

  return (
    <>
      <form
        className="flex items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label htmlFor="fee">KZT per event</label>
        <Input id="fee" type="number" min={0} required className="max-w-40 border-slate-400!" value={value} onChange={(e) => setValue(e.target.value)} />
        <Button type="submit" loading={save.isPending}>
          Save
        </Button>
        {save.isSuccess && <span>Saved.</span>}
      </form>
      {save.isError && <ErrorState message={errorMessage(save.error)} />}
    </>
  );
}

function Activations() {
  const queryClient = useQueryClient();
  const events = useQuery({
    queryKey: ["admin-activations"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/admin/activations");
      if (error) throw error;
      return data;
    },
  });
  const toggle = useMutation({
    mutationFn: async ({ id, suspended }: { id: number; suspended: boolean }) => {
      const { error } = await api.POST("/api/v1/admin/events/{event_id}/paid-sales", {
        params: { path: { event_id: id } },
        body: { suspended },
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-activations"] }),
  });

  return (
    <Block title="Events with paid sales">
      {events.data?.length === 0 && <EmptyState title="No event has activated paid sales yet" />}
      {!!events.data?.length && (
        <Table head={["Event", "Activated", "Status", ""]}>
          {events.data.map((e) => (
            <tr key={e.event_id} className="border-b border-slate-200">
              <td className="py-2 pr-4">{e.title}</td>
              <td className="py-2 pr-4">{e.activation_paid_at && new Date(e.activation_paid_at).toLocaleString("en-GB")}</td>
              <td className="py-2 pr-4">{e.suspended ? "Suspended" : "Selling"}</td>
              <td className="py-2 text-right">
                <Button
                  variant={e.suspended ? "secondary" : "danger"}
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: e.event_id, suspended: !e.suspended })}
                >
                  {e.suspended ? "Resume" : "Suspend"}
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Block>
  );
}
