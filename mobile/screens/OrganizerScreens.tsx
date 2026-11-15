import { useCallback, useState, type ReactNode } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import {
    acceptTerms,
    addStaff,
    cancelEvent,
    createCampaign,
    createEvent,
    getActivation,
    getAnalytics,
    getAttendees,
    getCampaigns,
    getOrganizerEvents,
    payActivation,
    publishEvent,
    refundOrder,
    unpublishEvent,
    type Activation,
    type Analytics,
    type Campaign,
    type EventAttendee,
    type NewEvent,
    type NewTicketType,
    type OrganizerEvent,
} from "../api/organizer";
import { pickAndUpload } from "../api/upload";
import type { RootStackParamList } from "../navigation/AppNavigation";

type Nav = NativeStackNavigationProp<RootStackParamList>;
const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
const kzt = (n: number) => `${n.toLocaleString("ru-RU")} KZT`;

function Button({ title, onPress, kind = "primary", disabled }: { title: string; onPress: () => void; kind?: "primary" | "secondary" | "danger"; disabled?: boolean }) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={[styles.button, kind === "secondary" && styles.secondary, kind === "danger" && styles.danger, disabled && styles.disabled]}
        >
            <Text style={[styles.buttonText, kind === "secondary" && styles.secondaryText]}>{title}</Text>
        </Pressable>
    );
}

function Field(props: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; multiline?: boolean }) {
    return (
        <View style={styles.field}>
            <Text style={styles.label}>{props.label}</Text>
            <TextInput
                style={[styles.input, props.multiline && styles.multiline]}
                value={props.value}
                onChangeText={props.onChangeText}
                placeholder={props.placeholder}
                multiline={props.multiline}
            />
        </View>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {children}
        </View>
    );
}

export function OrganizerHomeScreen() {
    const navigation = useNavigation<Nav>();
    const [events, setEvents] = useState<OrganizerEvent[]>([]);
    const [error, setError] = useState("");

    useFocusEffect(
        useCallback(() => {
            getOrganizerEvents().then(setEvents, (e) => setError(errorText(e)));
        }, []),
    );

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Button title="+ New event" onPress={() => navigation.navigate("NewEvent")} />
            <Button title="Check-in and scanner" kind="secondary" onPress={() => navigation.navigate("Events")} />
            {error !== "" && <Text style={styles.error}>{error}</Text>}
            {events.length === 0 && <Text style={styles.muted}>You have no events yet.</Text>}
            {events.map((e) => (
                <Pressable key={e.id} style={styles.card} onPress={() => navigation.navigate("ManageEvent", { eventId: e.id })}>
                    <Text style={styles.cardTitle}>{e.title}</Text>
                    <Text style={styles.muted}>
                        {new Date(e.starts_at).toLocaleString("ru-RU", { timeZone: e.display_timezone, dateStyle: "medium", timeStyle: "short" })}
                        {" · "}
                        {e.status === "published" && e.review_status !== "approved" ? `in review (${e.review_status})` : e.status}
                    </Text>
                </Pressable>
            ))}
        </ScrollView>
    );
}

const POLICIES: { value: NewEvent["refund_policy"]; label: string }[] = [
    { value: "full_until_48h", label: "Full refund until 48h before" },
    { value: "full_anytime", label: "Full refund any time" },
    { value: "no_refunds", label: "No refunds" },
];

function toIso(date: string, time: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
    const value = new Date(`${date}T${time}:00+05:00`);
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

export function NewEventScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "NewEvent">) {
    const [form, setForm] = useState({ title: "", description: "", venue: "", address: "", date: "", start: "", end: "" });
    const [cover, setCover] = useState<string | null>(null);
    const [policy, setPolicy] = useState<NewEvent["refund_policy"]>("full_until_48h");
    const [types, setTypes] = useState([{ name: "General admission", price: "0", quantity: "100" }]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const set = (key: keyof typeof form) => (value: string) => setForm({ ...form, [key]: value });

    async function uploadCover() {
        try {
            const uploaded = await pickAndUpload<{ url: string }>("/api/v1/uploads/cover", "image");
            if (uploaded) setCover(uploaded.url);
        } catch (e) {
            setError(errorText(e));
        }
    }

    async function submit() {
        const startsAt = toIso(form.date, form.start);
        const endsAt = toIso(form.date, form.end || form.start);
        if (!form.title.trim() || !startsAt || !endsAt) {
            setError("Fill in the title, a date as YYYY-MM-DD and times as HH:MM.");
            return;
        }
        const ticketTypes: NewTicketType[] = types.map((t) => ({ name: t.name.trim(), price_kzt: Number(t.price) || 0, quantity_total: Number(t.quantity) || 0 }));
        if (ticketTypes.some((t) => !t.name || t.quantity_total <= 0)) {
            setError("Every ticket type needs a name and a quantity above 0.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            const event = await createEvent({
                title: form.title.trim(),
                description: form.description.trim() || null,
                venue_name: form.venue.trim() || null,
                venue_address: form.address.trim() || null,
                cover_image_url: cover,
                starts_at: startsAt,
                ends_at: endsAt === startsAt ? new Date(Date.parse(startsAt) + 2 * 3600 * 1000).toISOString() : endsAt,
                refund_policy: policy,
                ticket_types: ticketTypes,
            });
            navigation.replace("ManageEvent", { eventId: event.id });
        } catch (e) {
            setError(errorText(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Field label="Title" value={form.title} onChangeText={set("title")} />
            <Field label="Description" value={form.description} onChangeText={set("description")} multiline />
            <Field label="Venue" value={form.venue} onChangeText={set("venue")} />
            <Field label="Address" value={form.address} onChangeText={set("address")} />
            <Field label="Date (YYYY-MM-DD)" value={form.date} onChangeText={set("date")} placeholder="2026-12-01" />
            <Field label="Start time (HH:MM, Almaty)" value={form.start} onChangeText={set("start")} placeholder="19:00" />
            <Field label="End time (optional, HH:MM)" value={form.end} onChangeText={set("end")} placeholder="21:00" />

            <Section title="Cover image">
                {cover && <Image source={{ uri: cover }} style={styles.cover} />}
                <Button title={cover ? "Change image" : "Choose image"} kind="secondary" onPress={uploadCover} />
            </Section>

            <Section title="Refund policy">
                {POLICIES.map((p) => (
                    <Pressable key={p.value} onPress={() => setPolicy(p.value)} style={[styles.option, policy === p.value && styles.optionActive]}>
                        <Text style={policy === p.value ? styles.optionActiveText : undefined}>{p.label}</Text>
                    </Pressable>
                ))}
            </Section>

            <Section title="Ticket types">
                {types.map((t, i) => (
                    <View key={i} style={styles.typeRow}>
                        <TextInput style={[styles.input, styles.flex2]} value={t.name} placeholder="Name" onChangeText={(name) => setTypes(types.map((x, j) => (j === i ? { ...x, name } : x)))} />
                        <TextInput style={[styles.input, styles.flex1]} value={t.price} placeholder="KZT" keyboardType="number-pad" onChangeText={(price) => setTypes(types.map((x, j) => (j === i ? { ...x, price } : x)))} />
                        <TextInput style={[styles.input, styles.flex1]} value={t.quantity} placeholder="Qty" keyboardType="number-pad" onChangeText={(quantity) => setTypes(types.map((x, j) => (j === i ? { ...x, quantity } : x)))} />
                    </View>
                ))}
                <Text style={styles.muted}>Name, price in KZT (0 means free), quantity.</Text>
                <Button title="+ Add ticket type" kind="secondary" onPress={() => setTypes([...types, { name: "", price: "0", quantity: "50" }])} />
            </Section>

            {error !== "" && <Text style={styles.error}>{error}</Text>}
            <Button title={busy ? "Creating..." : "Create and submit for review"} onPress={submit} disabled={busy} />
        </ScrollView>
    );
}

export function ManageEventScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, "ManageEvent">) {
    const { eventId } = route.params;
    const [event, setEvent] = useState<OrganizerEvent | null>(null);
    const [stats, setStats] = useState<Analytics | null>(null);
    const [activation, setActivation] = useState<Activation | null>(null);
    const [attendees, setAttendees] = useState<EventAttendee[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [staffEmail, setStaffEmail] = useState("");
    const [promo, setPromo] = useState({ code: "", percent: "10" });
    const [error, setError] = useState("");

    const load = useCallback(() => {
        Promise.all([getOrganizerEvents(), getAnalytics(eventId), getActivation(eventId), getAttendees(eventId), getCampaigns(eventId)]).then(
            ([events, a, act, att, camp]) => {
                setEvent(events.find((e) => e.id === eventId) ?? null);
                setStats(a);
                setActivation(act);
                setAttendees(att);
                setCampaigns(camp);
            },
            (e) => setError(errorText(e)),
        );
    }, [eventId]);

    useFocusEffect(load);

    const act = (task: () => Promise<unknown>) => async () => {
        setError("");
        try {
            await task();
            load();
        } catch (e) {
            setError(errorText(e));
        }
    };

    const confirm = (title: string, message: string, task: () => Promise<unknown>) =>
        Alert.alert(title, message, [{ text: "No", style: "cancel" }, { text: "Yes", style: "destructive", onPress: act(task) }]);

    async function payFee() {
        try {
            const { payment_id } = activation?.pending_payment_id ? { payment_id: activation.pending_payment_id } : await payActivation(eventId);
            navigation.navigate("Payment", { paymentId: payment_id });
        } catch (e) {
            setError(errorText(e));
        }
    }

    if (!event) return <Text style={styles.error}>{error}</Text>;

    const orders = [...new Map(attendees.filter((a) => a.status === "valid").map((a) => [a.order_id, a])).values()];
    const steps: [string, boolean][] = activation
        ? [
              ["Has a paid ticket type", activation.has_paid_ticket_type],
              ["Organizer verified (Profile)", activation.organizer_verified],
              ["Payout account set (Profile)", activation.payout_account_set],
              ["Terms accepted", activation.terms_accepted],
              [`Activation fee paid (${kzt(activation.fee_kzt)})`, activation.fee_paid],
          ]
        : [];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.heading}>{event.title}</Text>
            <Text style={styles.muted}>Status: {event.status}</Text>
            {event.status === "published" && event.review_status === "pending" && (
                <Text style={styles.notice}>Waiting for platform approval. The event is hidden until an admin approves it.</Text>
            )}
            {event.review_status === "rejected" && (
                <Text style={[styles.notice, styles.errorBorder]}>Not approved: {event.review_note ?? "no reason given"}. Edit it on the web to resubmit.</Text>
            )}
            {event.suspended_at && <Text style={[styles.notice, styles.errorBorder]}>Suspended by the platform.</Text>}

            <View style={styles.actions}>
                {event.status === "draft" && <Button title="Publish" onPress={act(() => publishEvent(eventId))} />}
                {event.status === "published" && <Button title="Unpublish" kind="secondary" onPress={act(() => unpublishEvent(eventId))} />}
                {(event.status === "draft" || event.status === "published") && (
                    <Button title="Cancel event" kind="danger" onPress={() => confirm("Cancel event?", "Every ticket stops working and paid orders are refunded.", () => cancelEvent(eventId))} />
                )}
                <Button title="Check in attendees" kind="secondary" onPress={() => navigation.navigate("Scanner", { eventId, title: event.title })} />
            </View>
            {error !== "" && <Text style={styles.error}>{error}</Text>}

            {stats && (
                <Section title="Sales">
                    <Text>Sold {stats.sold} of {stats.capacity}, {stats.remaining} left</Text>
                    <Text>Gross {kzt(stats.gross_kzt)}, discounts {kzt(stats.discount_kzt)}, refunds {kzt(stats.refunds_kzt)}</Text>
                    <Text style={styles.bold}>Net {kzt(stats.net_kzt)}</Text>
                    <Text>Checked in {stats.checked_in}, absent {stats.absent} ({stats.checkin_percent}%)</Text>
                </Section>
            )}

            {activation && !activation.paid_sales_enabled && (
                <Section title="Paid sales">
                    {steps.map(([label, done]) => (
                        <Text key={label}>{done ? "Done" : "Missing"}: {label}</Text>
                    ))}
                    {!activation.terms_accepted && <Button title="Accept paid-sales terms" kind="secondary" onPress={act(() => acceptTerms(eventId))} />}
                    {!activation.fee_paid && (
                        <Button
                            title="Pay activation fee"
                            onPress={payFee}
                            disabled={steps.slice(0, 4).some(([, done]) => !done)}
                        />
                    )}
                </Section>
            )}

            <Section title="Door staff">
                <TextInput style={styles.input} value={staffEmail} onChangeText={setStaffEmail} placeholder="Staff email" autoCapitalize="none" keyboardType="email-address" />
                <Button title="Add as event admin" kind="secondary" disabled={!staffEmail} onPress={act(async () => { await addStaff(eventId, staffEmail.trim()); setStaffEmail(""); })} />
            </Section>

            <Section title="Promo codes">
                {campaigns.map((c) => (
                    <Text key={c.id}>
                        {c.code}: {c.discount_type === "percent" ? `${c.discount_value}%` : kzt(c.discount_value)}, used {c.redemptions}
                        {c.max_redemptions ? `/${c.max_redemptions}` : ""}, net {kzt(c.net_kzt)}
                        {c.disabled ? " (disabled)" : ""}
                    </Text>
                ))}
                <View style={styles.typeRow}>
                    <TextInput style={[styles.input, styles.flex2]} value={promo.code} onChangeText={(code) => setPromo({ ...promo, code })} placeholder="Code (empty = random)" autoCapitalize="characters" />
                    <TextInput style={[styles.input, styles.flex1]} value={promo.percent} onChangeText={(percent) => setPromo({ ...promo, percent })} placeholder="%" keyboardType="number-pad" />
                </View>
                <Button
                    title="Create percent promo code"
                    kind="secondary"
                    onPress={act(async () => {
                        await createCampaign(eventId, { name: promo.code || "Mobile promo", code: promo.code.trim() || null, discount_type: "percent", discount_value: Number(promo.percent) });
                        setPromo({ code: "", percent: "10" });
                    })}
                />
            </Section>

            <Section title={`Attendees (${attendees.filter((a) => a.status === "valid" || a.status === "checked_in").length})`}>
                {attendees.map((a) => (
                    <Text key={a.ticket_id}>
                        {a.attendee_name} · {a.ticket_type_name} · {a.status.replace(/_/g, " ")}
                    </Text>
                ))}
                {orders.map((o) => (
                    <Button
                        key={o.order_id}
                        title={`${o.order_total_kzt > 0 ? "Refund" : "Cancel"} order #${o.order_id} (${o.attendee_name})`}
                        kind="secondary"
                        onPress={() => confirm("Are you sure?", "The tickets in this order stop working.", () => refundOrder(o.order_id))}
                    />
                ))}
            </Section>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#ffffff" },
    content: { padding: 16, gap: 12, paddingBottom: 40 },
    heading: { fontSize: 22, fontWeight: "700" },
    section: { borderWidth: 1, borderColor: "#dddddd", borderRadius: 10, padding: 12, gap: 8 },
    sectionTitle: { fontSize: 17, fontWeight: "700" },
    card: { borderWidth: 1, borderColor: "#dddddd", borderRadius: 10, padding: 12, gap: 4 },
    cardTitle: { fontSize: 16, fontWeight: "600" },
    field: { gap: 4 },
    label: { fontWeight: "600" },
    input: { borderWidth: 1, borderColor: "#999999", borderRadius: 8, padding: 10, backgroundColor: "#ffffff" },
    multiline: { minHeight: 90, textAlignVertical: "top" },
    typeRow: { flexDirection: "row", gap: 6 },
    flex1: { flex: 1 },
    flex2: { flex: 2 },
    option: { borderWidth: 1, borderColor: "#999999", borderRadius: 8, padding: 10 },
    optionActive: { borderColor: "#2563eb", backgroundColor: "#2563eb" },
    optionActiveText: { color: "#ffffff" },
    cover: { width: 120, height: 150, borderRadius: 8 },
    actions: { gap: 8 },
    button: { backgroundColor: "#2563eb", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center" },
    secondary: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#2563eb" },
    danger: { backgroundColor: "#b00020" },
    disabled: { opacity: 0.5 },
    buttonText: { color: "#ffffff", fontWeight: "600" },
    secondaryText: { color: "#2563eb" },
    notice: { borderWidth: 1, borderColor: "#999999", padding: 10 },
    errorBorder: { borderColor: "#b00020", color: "#b00020" },
    muted: { color: "#555555" },
    bold: { fontWeight: "700" },
    error: { color: "#b00020", padding: 4 },
});
