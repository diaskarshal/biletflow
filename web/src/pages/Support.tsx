import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { Block, Table } from "../components/Block";
import { Button } from "../components/Button";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Input } from "../components/Input";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../lib/format";

type Case = components["schemas"]["CaseOut"];
type Category = components["schemas"]["CaseCreate"]["category"];
type Status = components["schemas"]["CaseUpdate"]["status"] & string;

const CATEGORIES: Record<Category, string> = {
  ticket_delivery: "Ticket delivery",
  payment: "Payment",
  refund: "Refund",
  seating: "Seating",
  event_information: "Event information",
  check_in: "Check-in",
  account: "Account",
  activation: "Paid-sales activation",
  technical: "Technical problem",
};
const ORGANIZER_CATEGORIES: Category[] = ["account", "activation", "payment", "technical"];
const STATUSES: Record<Status, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_for_customer: "Waiting for customer",
  resolved: "Resolved",
};

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function CaseTable({ cases, showRequester }: { cases: Case[]; showRequester?: boolean }) {
  return (
    <Table head={["#", "Subject", ...(showRequester ? ["From"] : []), "Event", "Status", "Updated"]}>
      {cases.map((c) => (
        <tr key={c.id} className="border-b border-slate-200">
          <td className="py-2 pr-4">{c.id}</td>
          <td className="py-2 pr-4">
            <Link className="underline" to={`/support/${c.id}`}>
              {c.subject}
            </Link>
          </td>
          {showRequester && <td className="py-2 pr-4">{c.requester_name}</td>}
          <td className="py-2 pr-4">{c.event_title ?? (c.kind === "organizer" ? "Platform support" : "")}</td>
          <td className="py-2 pr-4">{STATUSES[c.status as Status]}</td>
          <td className="py-2 pr-4">{when(c.updated_at)}</td>
        </tr>
      ))}
    </Table>
  );
}

export function Support() {
  const [status, setStatus] = useState<Status | "">("");
  const mine = useQuery({
    queryKey: ["support-mine"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/support/cases");
      if (error) throw error;
      return data;
    },
  });
  const inbox = useQuery({
    queryKey: ["support-inbox", status],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/support/inbox", {
        params: { query: { status: status || null } },
      });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-6 py-12">
      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-bold">Support</h1>
        <Link className="ml-auto underline" to="/support/new?kind=organizer">
          Contact platform support
        </Link>
      </div>
      <Block title="My requests">
        {mine.isError && <ErrorState message={errorMessage(mine.error)} />}
        {mine.data?.length === 0 && (
          <EmptyState title="No requests yet">
            To ask about a ticket or order, use "Get help" on the My tickets page.
          </EmptyState>
        )}
        {!!mine.data?.length && <CaseTable cases={mine.data} />}
      </Block>
      {(!!inbox.data?.length || status) && (
        <Block title="Requests to handle">
          <label className="block">
            Status{" "}
            <select className="border border-slate-400 px-2 py-1" value={status} onChange={(e) => setStatus(e.target.value as Status | "")}>
              <option value="">All</option>
              {Object.entries(STATUSES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          {inbox.data?.length === 0 && <EmptyState title="Nothing with this status" />}
          {!!inbox.data?.length && <CaseTable cases={inbox.data} showRequester />}
        </Block>
      )}
    </div>
  );
}

export function NewSupportCase() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const organizer = params.get("kind") === "organizer";
  const context = {
    event_id: params.get("event_id") ? Number(params.get("event_id")) : null,
    order_id: params.get("order_id") ? Number(params.get("order_id")) : null,
    ticket_id: params.get("ticket_id") ? Number(params.get("ticket_id")) : null,
  };
  const categories = organizer
    ? ORGANIZER_CATEGORIES
    : (Object.keys(CATEGORIES) as Category[]).filter((c) => c !== "activation");
  const [category, setCategory] = useState<Category>(categories[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST("/api/v1/support/cases", {
        body: { kind: organizer ? "organizer" : "attendee", category, subject, message, ...context },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => navigate(`/support/${data.id}`),
  });

  const about = context.ticket_id
    ? `Ticket #${context.ticket_id}`
    : context.order_id
      ? `Order #${context.order_id}`
      : context.event_id
        ? "This event"
        : null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold">{organizer ? "Contact platform support" : "Contact the organizer"}</h1>
      {about && <p className="mt-2">About: {about}</p>}
      {!organizer && !about && (
        <p className="mt-4">
          Open a request from the event page or from <Link className="underline" to="/tickets">My tickets</Link> so the
          organizer knows which event it is about.
        </p>
      )}
      {(organizer || about) && (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <label className="block space-y-1">
            <span className="block">Category</span>
            <select className="w-full border border-slate-400 px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIES[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="block">Subject</span>
            <Input required maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="block">Message</span>
            <textarea required rows={6} maxLength={5000} className="w-full border border-slate-400 px-3 py-2" value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>
          {create.isError && <ErrorState message={errorMessage(create.error, "Could not send the request")} />}
          <Button type="submit" loading={create.isPending}>
            Send request
          </Button>
        </form>
      )}
    </div>
  );
}

export function SupportCase() {
  const id = Number(useParams().id);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const detail = useQuery({
    queryKey: ["support-case", id],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/support/cases/{case_id}", { params: { path: { case_id: id } } });
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["support-case", id] });
    queryClient.invalidateQueries({ queryKey: ["support-inbox"] });
    queryClient.invalidateQueries({ queryKey: ["support-mine"] });
  };
  const send = useMutation({
    mutationFn: async () => {
      const { error } = await api.POST("/api/v1/support/cases/{case_id}/messages", {
        params: { path: { case_id: id } },
        body: { body: reply },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReply("");
      refresh();
    },
  });
  const update = useMutation({
    mutationFn: async (body: { status?: Status; assignee_id?: number }) => {
      const { error } = await api.PATCH("/api/v1/support/cases/{case_id}", {
        params: { path: { case_id: id } },
        body,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  if (detail.isError) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <ErrorState message={errorMessage(detail.error)} />
      </div>
    );
  }
  const c = detail.data;
  if (!c) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <p>
        <Link className="underline" to="/support">
          All requests
        </Link>
      </p>
      <h1 className="text-3xl font-bold">
        #{c.id} {c.subject}
      </h1>
      <table className="text-left">
        <tbody>
          {[
            ["Status", STATUSES[c.status as Status]],
            ["Category", CATEGORIES[c.category as Category]],
            ["From", `${c.requester_name} (${c.requester_email})`],
            ["Event", c.event_title ?? (c.kind === "organizer" ? "Platform support" : "")],
            ["Order", c.order_id ? `#${c.order_id}` : ""],
            ["Ticket", c.ticket_id ? `#${c.ticket_id}` : ""],
            ["Assigned to", c.assignee_name ?? "Nobody"],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <tr key={k}>
                <th className="py-1 pr-6 font-normal text-slate-600">{k}</th>
                <td className="py-1">{v}</td>
              </tr>
            ))}
        </tbody>
      </table>
      {c.can_manage && (
        <div className="flex flex-wrap items-center gap-3 border border-slate-300 p-4">
          <label>
            Status{" "}
            <select
              className="border border-slate-400 px-2 py-1"
              value={c.status}
              onChange={(e) => update.mutate({ status: e.target.value as Status })}
            >
              {Object.entries(STATUSES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          {user && c.assignee_id !== user.id && (
            <Button variant="secondary" onClick={() => update.mutate({ assignee_id: user.id })}>
              Assign to me
            </Button>
          )}
          {update.isError && <ErrorState message={errorMessage(update.error)} />}
        </div>
      )}
      <ol className="space-y-3">
        {c.messages.map((m) => (
          <li key={m.id} className={`border p-3 ${m.from_requester ? "border-slate-300" : "border-brand"}`}>
            <p className="text-sm text-slate-600">
              {m.author_name}
              {m.from_requester ? "" : " (support)"}, {when(m.created_at)}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
      </ol>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <textarea
          required
          rows={4}
          maxLength={5000}
          aria-label="Reply"
          className="w-full border border-slate-400 px-3 py-2"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
        />
        {send.isError && <ErrorState message={errorMessage(send.error, "Could not send the reply")} />}
        <Button type="submit" loading={send.isPending}>
          Send reply
        </Button>
      </form>
    </div>
  );
}
