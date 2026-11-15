import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
    calculateSlots,
    getEventTicketTypes,
    getPublicEventDetails,
    type PublicEventDetails,
    type TicketType,
} from "../api/events";

import type { RootStackParamList } from "../navigation/AppNavigation";
import {Alert, Pressable, TextInput} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {createOrder} from "../api/orders";
import { reportEvent } from "../api/events";
import {useSession} from "../session/SessionContext";
import { locale, t, tOptional } from "../i18n";

type Props = NativeStackScreenProps<RootStackParamList, "EventDetails">;

export default function EventDetailsScreen({ route, navigation }: Props) {
    const { slug } = route.params;

    const [event, setEvent] = useState<PublicEventDetails | null>(null);
    const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
    const [promoCode, setPromoCode] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        async function loadEvent() {
            try {
                setLoading(true);
                setError("");

                const eventData = await getPublicEventDetails(slug);
                const types = await getEventTicketTypes(eventData.id);

                if (active) {
                    setEvent(eventData);
                    setTicketTypes(types);
                }
            } catch (e) {
                if (active) {
                    setError(
                        e instanceof Error
                            ? e.message
                            : t("event.openFailed")
                    );
                }
            } finally {
                if (active) setLoading(false);
            }
        }

        void loadEvent();

        return () => {
            active = false;
        };
    }, [slug]);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.loadingText}>{t("event.loading")}</Text>
            </View>
        );
    }

    if (error || !event) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>{t("event.openFailed")}</Text>
                <Text style={styles.errorText}>
                    {error || t("event.notFound")}
                </Text>
            </View>
        );
    }

    const visibleTypes = ticketTypes.filter((t) => !t.is_hidden);
    const slots = calculateSlots(ticketTypes);

    const timezone = event.display_timezone || "Asia/Almaty";

    const date = new Intl.DateTimeFormat(locale(), {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: timezone,
    }).format(new Date(event.starts_at));

    const time = new Intl.DateTimeFormat(locale(), {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: timezone,
    }).format(new Date(event.starts_at));

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            {event.cover_image_url ? (
                <Image
                    source={{ uri: event.cover_image_url }}
                    style={styles.coverImage}
                    resizeMode="cover"
                />
            ) : (
                <View style={styles.imagePlaceholder}>
                    <Text style={styles.placeholderTitle}>
                        {event.title}
                    </Text>
                </View>
            )}

            <View style={styles.body}>
                <Text style={styles.eyebrow}>{t("event.eyebrow")}</Text>

                <Text style={styles.title}>{event.title}</Text>

                <View style={styles.infoRow}>
                    <Text style={styles.infoIcon}>▦</Text>
                    <Text style={styles.infoText}>{date}</Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.infoIcon}>◷</Text>
                    <Text style={styles.infoText}>{time}</Text>
                </View>

                {event.venue_address && (
                    <View style={styles.infoRow}>
                        <Text style={styles.infoIcon}>⌖</Text>
                        <Text style={styles.infoText}>
                            {event.venue_address}
                        </Text>
                    </View>
                )}

                <View style={styles.slotsBox}>
                    <Text style={styles.slotsLabel}>{t("event.slots")}</Text>
                    <Text style={styles.slotsValue}>
                        {slots.left} / {slots.total}
                    </Text>
                    <Text style={styles.slotsDescription}>
                        {t("event.remaining")}
                    </Text>
                </View>

                {event.description && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t("event.about")}</Text>
                        <Text style={styles.description}>
                            {event.description}
                        </Text>
                    </View>
                )}

                <Pressable
                    style={styles.contactButton}
                    onPress={() =>
                        navigation.navigate("NewSupportCase", {
                            eventId: event.id,
                        })
                    }
                >
                    <Text style={styles.contactButtonText}>
                        {t("event.contact")}
                    </Text>
                </Pressable>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t("event.tickets")}</Text>
                    <TextInput
                        style={styles.promoInput}
                        value={promoCode}
                        onChangeText={setPromoCode}
                        placeholder={t("event.promo")}
                        autoCapitalize="characters"
                    />

                    {visibleTypes.length === 0 ? (
                        <Text style={styles.mutedText}>
                            {t("event.noTypes")}
                        </Text>
                    ) : (
                        visibleTypes.map((ticket) => (
                            <TicketCard
                                key={ticket.id}
                                ticket={ticket}
                                eventId = {event.id}
                                promoCode = {promoCode.trim()}
                                eventCancelled={event.status === "cancelled"}
                                paidSalesEnabled={event.paid_sales_enabled}
                            />
                        ))
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t("event.refundPolicy")}</Text>
                    <Text style={styles.description}>
                        {tOptional(`refund.${event.refund_policy}`) ?? event.refund_policy}
                    </Text>
                </View>

                <ReportEvent eventId={event.id} />
            </View>
        </ScrollView>
    );
}

function ReportEvent({ eventId }: { eventId: number }) {
    const [reason, setReason] = useState("");
    const [sent, setSent] = useState(false);
    if (sent) return <Text style={styles.description}>{t("report.thanks")}</Text>;
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("report.open")}</Text>
            <TextInput style={styles.promoInput} value={reason} onChangeText={setReason} placeholder={t("report.placeholder")} multiline />
            <Pressable
                style={[styles.contactButton, !reason.trim() && styles.purchaseButtonDisabled]}
                disabled={!reason.trim()}
                onPress={() =>
                    reportEvent(eventId, reason.trim()).then(
                        () => setSent(true),
                        (e) => Alert.alert(t("common.error"), e instanceof Error ? e.message : ""),
                    )
                }
            >
                <Text style={styles.contactButtonText}>{t("report.send")}</Text>
            </Pressable>
        </View>
    );
}

function TicketCard({
    ticket,
    eventId,
    promoCode,
    eventCancelled,
    paidSalesEnabled,
}: {
    ticket: TicketType;
    promoCode: string;
    eventCancelled: boolean;
    paidSalesEnabled: boolean;
    eventId: number;
}) {
    const {user} = useSession();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [purchasing, setPurchasing] = useState(false);
    const remaining = Math.max(
        ticket.quantity_total -
            ticket.quantity_sold -
            ticket.quantity_reserved,
        0
    );

    let unavailableReason: string | null = null;

    if (eventCancelled) {
        unavailableReason = t("event.reasonCancelled");
    } else if (ticket.price_kzt > 0 && !paidSalesEnabled) {
        unavailableReason = t("event.reasonNotOnSale");
    } else if (remaining <= 0) {
        unavailableReason = t("event.reasonSoldOut");
    } else if (
        ticket.sales_start_at &&
        new Date(ticket.sales_start_at).getTime() > Date.now()
    ) {
        unavailableReason = t("event.reasonNotOnSale");
    } else if (
        ticket.sales_end_at &&
        new Date(ticket.sales_end_at).getTime() < Date.now()
    ) {
        unavailableReason = t("event.reasonClosed");
    }

    const isFree = ticket.price_kzt === 0;
    const canPurchase = !unavailableReason && !purchasing;

    async function handlePurchase() {
        if (!user || !canPurchase) return;

        try {
            setPurchasing(true);

            const order = await createOrder({
                event_id: eventId,
                items: [
                    {
                        ticket_type_id: ticket.id,
                        quantity: 1,
                        attendees: [
                            {
                                name: user.full_name,
                                email: user.email,
                            },
                        ],
                    },
                ],
                promo_code: ticket.price_kzt > 0 && promoCode ? promoCode : null,
            });

            if (order.payment_id) {
                navigation.navigate("Payment", { paymentId: order.payment_id });
            } else {
                Alert.alert(t("event.purchasedTitle"), t("event.purchasedBody"));
            }
        } catch (error) {
            Alert.alert(t("event.purchaseFailed"), error instanceof Error ? error.message : t("common.error"));
        } finally {
            setPurchasing(false);
        }
    }

    return (
        <View style={styles.ticketCard}>
            <View style={styles.ticketInfo}>
                <Text style={styles.ticketName}>{ticket.name}</Text>
                <Text style={styles.ticketAvailability}>
                    {unavailableReason ?? t("event.available", { n: remaining })}
                </Text>
            </View>

            <View style = {styles.ticketActions}>
                <Text style = {styles.ticketPrice}>
                    {isFree
                        ? t("common.free")
                        : `${ticket.price_kzt.toLocaleString("ru-RU")} KZT`}
                </Text>

                <Pressable style = {[
                    styles.purchaseButton,
                    !canPurchase && styles.purchaseButtonDisabled,
                    ]}
                    disabled = {!canPurchase}
                    onPress = {handlePurchase}
                >
                    <Text style = {styles.purchaseButtonText}>
                        {purchasing
                            ? t("event.processing")
                            : unavailableReason
                                ? unavailableReason
                                : isFree
                                    ? t("event.getTicket")
                                    : t("event.buy")}
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    promoInput: {
        borderWidth: 1,
        borderColor: "#999999",
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
    },
    ticketActions:{
        alignItems: "flex-end",
        gap: 9,
    },
    purchaseButton: {
        backgroundColor: "#2563eb",
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 9,
    },

    purchaseButtonDisabled: {
        backgroundColor: "#94a3b8",
    },

    purchaseButtonText: {
        color: "#ffffff",
        fontSize: 12,
        fontWeight: "700",
    },

    container: {
        flex: 1,
        backgroundColor: "#f8fafc",
    },
    content: {
        paddingBottom: 35,
    },
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 25,
        backgroundColor: "#f8fafc",
    },
    loadingText: {
        marginTop: 12,
        color: "#64748b",
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: "800",
        color: "#172033",
        marginBottom: 8,
    },
    errorText: {
        color: "#64748b",
        textAlign: "center",
    },
    coverImage: {
        width: "100%",
        height: 250,
        backgroundColor: "#e2e8f0",
    },
    imagePlaceholder: {
        height: 220,
        backgroundColor: "#dce8fb",
        alignItems: "center",
        justifyContent: "center",
        padding: 25,
    },
    placeholderTitle: {
        fontSize: 25,
        fontWeight: "800",
        color: "#2455a5",
        textAlign: "center",
    },
    body: {
        padding: 20,
    },
    eyebrow: {
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 1.2,
        color: "#2563eb",
        marginBottom: 8,
    },
    title: {
        fontSize: 29,
        lineHeight: 35,
        fontWeight: "800",
        color: "#172033",
        marginBottom: 20,
    },
    infoRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 13,
    },
    infoIcon: {
        width: 28,
        fontSize: 19,
        color: "#64748b",
    },
    infoText: {
        flex: 1,
        fontSize: 15,
        color: "#64748b",
    },
    slotsBox: {
        backgroundColor: "#eaf1ff",
        borderRadius: 16,
        padding: 18,
        marginTop: 15,
    },
    slotsLabel: {
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 1,
        color: "#2563eb",
    },
    slotsValue: {
        fontSize: 28,
        fontWeight: "800",
        color: "#172033",
        marginTop: 5,
    },
    slotsDescription: {
        color: "#64748b",
        fontSize: 13,
        marginTop: 2,
    },
    section: {
        marginTop: 28,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "800",
        color: "#172033",
        marginBottom: 13,
    },
    description: {
        fontSize: 15,
        lineHeight: 24,
        color: "#64748b",
    },
    mutedText: {
        color: "#64748b",
        fontSize: 14,
    },
    ticketCard: {
        backgroundColor: "#ffffff",
        borderRadius: 15,
        borderWidth: 1,
        borderColor: "#e5e9f0",
        padding: 16,
        marginBottom: 11,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    ticketInfo: {
        flex: 1,
        paddingRight: 10,
    },
    ticketName: {
        fontSize: 16,
        fontWeight: "700",
        color: "#172033",
    },
    ticketAvailability: {
        fontSize: 12,
        color: "#64748b",
        marginTop: 5,
    },
    ticketPrice: {
        fontSize: 15,
        fontWeight: "800",
        color: "#2563eb",
    },
    contactButton: {
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#2563eb",
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
        marginTop: 22,
    },
    contactButtonText: {
        color: "#2563eb",
        fontSize: 15,
        fontWeight: "700",
    },
});