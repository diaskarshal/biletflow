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
    duplicateEvent,
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
import { locale, t, tOptional, type MessageKey } from "../i18n";

type Nav = NativeStackNavigationProp<RootStackParamList>;
const errorText = (e: unknown) => (e instanceof Error ? e.message : t("common.error"));
const statusText = (e: OrganizerEvent) =>
    t(e.status === "published" && e.review_status !== "approved"
        ? (e.review_status === "rejected" ? "status.rejected" : "status.in_review")
        : (`status.${e.status}` as MessageKey));
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
            <Button title={t("organizer.new")} onPress={() => navigation.navigate("NewEvent")} />
            <Button title={t("om.checkin")} kind="secondary" onPress={() => navigation.navigate("Events")} />
            {error !== "" && <Text style={styles.error}>{error}</Text>}
            {events.length === 0 && <Text style={styles.muted}>{t("om.noEvents")}</Text>}
            {events.map((e) => (
                <Pressable key={e.id} style={styles.card} onPress={() => navigation.navigate("ManageEvent", { eventId: e.id })}>
                    <Text style={styles.cardTitle}>{e.title}</Text>
                    <Text style={styles.muted}>
                        {new Date(e.starts_at).toLocaleString(locale(), { timeZone: e.display_timezone, dateStyle: "medium", timeStyle: "short" })}
                        {" · "}
                        {statusText(e)}
                    </Text>
                </Pressable>
            ))}
        </ScrollView>
    );
}

const POLICIES: NewEvent["refund_policy"][] = ["full_until_48h", "full_anytime", "no_refunds"];

function toIso(date: string, time: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
    const value = new Date(`${date}T${time}:00+05:00`);
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

export function NewEventScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "NewEvent">) {
    const [form, setForm] = useState({ title: "", description: "", venue: "", address: "", date: "", start: "", end: "" });
    const [cover, setCover] = useState<string | null>(null);
    const [policy, setPolicy] = useState<NewEvent["refund_policy"]>("full_until_48h");
    const [types, setTypes] = useState(() => [{ name: t("om.generalAdmission"), price: "0", quantity: "100" }]);
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
            setError(t("om.formInvalid"));
            return;
        }
        const ticketTypes: NewTicketType[] = types.map((type) => ({ name: type.name.trim(), price_kzt: Number(type.price) || 0, quantity_total: Number(type.quantity) || 0 }));
        if (ticketTypes.some((type) => !type.name || type.quantity_total <= 0)) {
            setError(t("om.typesInvalid"));
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
            <Field label={t("manage.eventTitle")} value={form.title} onChangeText={set("title")} />
            <Field label={t("manage.description")} value={form.description} onChangeText={set("description")} multiline />
            <Field label={t("manage.venue")} value={form.venue} onChangeText={set("venue")} />
            <Field label={t("form.address")} value={form.address} onChangeText={set("address")} />
            <Field label={t("om.date")} value={form.date} onChangeText={set("date")} placeholder="2026-12-01" />
            <Field label={t("om.start")} value={form.start} onChangeText={set("start")} placeholder="19:00" />
            <Field label={t("om.end")} value={form.end} onChangeText={set("end")} placeholder="21:00" />

            <Section title={t("manage.cover")}>
                {cover && <Image source={{ uri: cover }} style={styles.cover} />}
                <Button title={t(cover ? "cover.change" : "cover.choose")} kind="secondary" onPress={uploadCover} />
            </Section>

            <Section title={t("event.refundPolicy")}>
                {POLICIES.map((value) => (
                    <Pressable key={value} onPress={() => setPolicy(value)} style={[styles.option, policy === value && styles.optionActive]}>
                        <Text style={policy === value ? styles.optionActiveText : undefined}>{t(`refund.${value}`)}</Text>
                    </Pressable>
                ))}
            </Section>

            <Section title={t("manage.ticketTypes")}>
                {types.map((type, i) => (
                    <View key={i} style={styles.typeRow}>
                        <TextInput style={[styles.input, styles.flex2]} value={type.name} placeholder={t("om.typeName")} onChangeText={(name) => setTypes(types.map((x, j) => (j === i ? { ...x, name } : x)))} />
                        <TextInput style={[styles.input, styles.flex1]} value={type.price} placeholder="KZT" keyboardType="number-pad" onChangeText={(price) => setTypes(types.map((x, j) => (j === i ? { ...x, price } : x)))} />
                        <TextInput style={[styles.input, styles.flex1]} value={type.quantity} placeholder={t("om.qty")} keyboardType="number-pad" onChangeText={(quantity) => setTypes(types.map((x, j) => (j === i ? { ...x, quantity } : x)))} />
                    </View>
                ))}
                <Text style={styles.muted}>{t("om.typesHint")}</Text>
                <Button title={t("newEvent.addType")} kind="secondary" onPress={() => setTypes([...types, { name: "", price: "0", quantity: "50" }])} />
            </Section>

            {error !== "" && <Text style={styles.error}>{error}</Text>}
            <Button title={t(busy ? "om.creating" : "om.create")} onPress={submit} disabled={busy} />
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
        Alert.alert(title, message, [{ text: t("common.no"), style: "cancel" }, { text: t("common.yes"), style: "destructive", onPress: act(task) }]);

    async function duplicate() {
        try {
            const copy = await duplicateEvent(eventId);
            navigation.replace("ManageEvent", { eventId: copy.id });
        } catch (e) {
            setError(errorText(e));
        }
    }

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
              [t("manage.stepPaidType"), activation.has_paid_ticket_type],
              [t("manage.stepVerified"), activation.organizer_verified],
              [t("manage.stepPayout"), activation.payout_account_set],
              [t("om.stepTerms"), activation.terms_accepted],
              [t("manage.stepFee", { amount: activation.fee_kzt.toLocaleString("ru-RU") }), activation.fee_paid],
          ]
        : [];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.heading}>{event.title}</Text>
            <Text style={styles.muted}>{t("om.status", { status: statusText(event) })}</Text>
            {event.status === "published" && event.review_status === "pending" && (
                <Text style={styles.notice}>{t("manage.pending")}</Text>
            )}
            {event.review_status === "rejected" && (
                <Text style={[styles.notice, styles.errorBorder]}>{t("om.rejected", { note: event.review_note ?? t("manage.noReason") })}</Text>
            )}
            {event.suspended_at && <Text style={[styles.notice, styles.errorBorder]}>{t("manage.suspended")}</Text>}

            <View style={styles.actions}>
                {event.status === "draft" && <Button title={t("manage.publish")} onPress={act(() => publishEvent(eventId))} />}
                {event.status === "published" && <Button title={t("manage.unpublish")} kind="secondary" onPress={act(() => unpublishEvent(eventId))} />}
                <Button title={t("manage.duplicate")} kind="secondary" onPress={duplicate} />
                {(event.status === "draft" || event.status === "published") && (
                    <Button title={t("manage.cancelEvent")} kind="danger" onPress={() => confirm(t("manage.cancelEvent"), t("manage.cancelConfirm"), () => cancelEvent(eventId))} />
                )}
                <Button title={t("om.preview")} kind="secondary" onPress={() => navigation.navigate("EventDetails", { slug: event.slug })} />
                <Button title={t("om.checkinAttendees")} kind="secondary" onPress={() => navigation.navigate("Scanner", { eventId, title: event.title })} />
            </View>
            {error !== "" && <Text style={styles.error}>{error}</Text>}

            {stats && (
                <Section title={t("om.sales")}>
                    <Text>{t("om.sold", { sold: stats.sold, capacity: stats.capacity, left: stats.remaining })}</Text>
                    <Text>{t("om.money", { gross: kzt(stats.gross_kzt), discounts: kzt(stats.discount_kzt), refunds: kzt(stats.refunds_kzt) })}</Text>
                    <Text style={styles.bold}>{t("om.net", { net: kzt(stats.net_kzt) })}</Text>
                    <Text>{t("om.payout", { fees: kzt(stats.fees_kzt), payout: kzt(stats.payout_kzt) })}</Text>
                    <Text>{t("om.attendance", { in: stats.checked_in, absent: stats.absent, percent: stats.checkin_percent })}</Text>
                </Section>
            )}

            {activation && !activation.paid_sales_enabled && (
                <Section title={t("manage.paid")}>
                    {steps.map(([label, done]) => (
                        <Text key={label}>{t(done ? "manage.done" : "manage.missing")}: {label}</Text>
                    ))}
                    {!activation.terms_accepted && <Button title={t("manage.acceptTerms")} kind="secondary" onPress={act(() => acceptTerms(eventId))} />}
                    {!activation.fee_paid && (
                        <Button
                            title={t("manage.payFee")}
                            onPress={payFee}
                            disabled={steps.slice(0, 4).some(([, done]) => !done)}
                        />
                    )}
                </Section>
            )}

            <Section title={t("manage.staff")}>
                <TextInput style={styles.input} value={staffEmail} onChangeText={setStaffEmail} placeholder={t("manage.staffEmail")} autoCapitalize="none" keyboardType="email-address" />
                <Button title={t("om.addStaff")} kind="secondary" disabled={!staffEmail} onPress={act(async () => { await addStaff(eventId, staffEmail.trim()); setStaffEmail(""); })} />
            </Section>

            <Section title={t("manage.promos")}>
                {campaigns.map((c) => (
                    <Text key={c.id}>
                        {t("om.promoLine", {
                            code: c.code,
                            discount: c.discount_type === "percent" ? `${c.discount_value}%` : kzt(c.discount_value),
                            used: `${c.redemptions}${c.max_redemptions ? `/${c.max_redemptions}` : ""}`,
                            net: kzt(c.net_kzt),
                        })}
                        {c.disabled ? ` (${t("manage.disabled")})` : ""}
                    </Text>
                ))}
                <View style={styles.typeRow}>
                    <TextInput style={[styles.input, styles.flex2]} value={promo.code} onChangeText={(code) => setPromo({ ...promo, code })} placeholder={t("manage.codeHint")} autoCapitalize="characters" />
                    <TextInput style={[styles.input, styles.flex1]} value={promo.percent} onChangeText={(percent) => setPromo({ ...promo, percent })} placeholder="%" keyboardType="number-pad" />
                </View>
                <Button
                    title={t("om.createPromo")}
                    kind="secondary"
                    onPress={act(async () => {
                        await createCampaign(eventId, { name: promo.code || "Mobile promo", code: promo.code.trim() || null, discount_type: "percent", discount_value: Number(promo.percent) });
                        setPromo({ code: "", percent: "10" });
                    })}
                />
            </Section>

            <Section title={`${t("manage.attendees")} (${attendees.filter((a) => a.status === "valid" || a.status === "checked_in").length})`}>
                {attendees.map((a) => (
                    <Text key={a.ticket_id}>
                        {a.attendee_name} · {a.ticket_type_name} · {tOptional(`att.${a.status}`) ?? a.status}
                    </Text>
                ))}
                {orders.map((o) => {
                    const paid = o.order_total_kzt > 0;
                    const action = t(paid ? "manage.refund" : "manage.cancel");
                    const message = paid
                        ? t("manage.refundConfirm", { amount: o.order_total_kzt.toLocaleString("ru-RU"), id: o.order_id })
                        : t("manage.cancelOrderConfirm", { id: o.order_id });
                    return (
                        <Button
                            key={o.order_id}
                            title={t("om.orderButton", { action, id: o.order_id, name: o.attendee_name })}
                            kind="secondary"
                            onPress={() => confirm(action, message, () => refundOrder(o.order_id))}
                        />
                    );
                })}
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
