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
import {Alert, Pressable} from "react-native";
import {createOrder} from "../api/orders";
import {useSession} from "../session/SessionContext";

type Props = NativeStackScreenProps<RootStackParamList, "EventDetails">;

export default function EventDetailsScreen({ route }: Props) {
    const { slug } = route.params;

    const [event, setEvent] = useState<PublicEventDetails | null>(null);
    const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
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
                            : "Could not load this event."
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
                <Text style={styles.loadingText}>Loading event...</Text>
            </View>
        );
    }

    if (error || !event) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Could not open event</Text>
                <Text style={styles.errorText}>
                    {error || "Event not found."}
                </Text>
            </View>
        );
    }

    const visibleTypes = ticketTypes.filter((t) => !t.is_hidden);
    const slots = calculateSlots(ticketTypes);

    const timezone = event.display_timezone || "Asia/Almaty";

    const date = new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: timezone,
    }).format(new Date(event.starts_at));

    const time = new Intl.DateTimeFormat("en-US", {
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
                <Text style={styles.eyebrow}>EVENT DETAILS</Text>

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
                    <Text style={styles.slotsLabel}>AVAILABLE SLOTS</Text>
                    <Text style={styles.slotsValue}>
                        {slots.left} / {slots.total}
                    </Text>
                    <Text style={styles.slotsDescription}>
                        Remaining tickets
                    </Text>
                </View>

                {event.description && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>About this event</Text>
                        <Text style={styles.description}>
                            {event.description}
                        </Text>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Tickets</Text>

                    {visibleTypes.length === 0 ? (
                        <Text style={styles.mutedText}>
                            No ticket types are currently available.
                        </Text>
                    ) : (
                        visibleTypes.map((ticket) => (
                            <TicketCard
                                key={ticket.id}
                                ticket={ticket}
                                eventId = {event.id}
                                eventCancelled={event.status === "cancelled"}
                                paidSalesEnabled={event.paid_sales_enabled}
                            />
                        ))
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Refund policy</Text>
                    <Text style={styles.description}>
                        {event.refund_policy === "full_until_48h"
                            ? "Full refund up to 48 hours before the event."
                            : event.refund_policy === "full_anytime"
                                ? "Full refund any time before the event."
                                : event.refund_policy === "no_refunds"
                                    ? "No refunds."
                                    : event.refund_policy}
                    </Text>
                </View>
            </View>
        </ScrollView>
    );
}

function TicketCard({
    ticket,
    eventId,
    eventCancelled,
    paidSalesEnabled,
}: {
    ticket: TicketType;
    eventCancelled: boolean;
    paidSalesEnabled: boolean;
    eventId: number;
}) {
    const {user} = useSession();
    const [purchasing, setPurchasing] = useState(false);
    const remaining = Math.max(
        ticket.quantity_total -
            ticket.quantity_sold -
            ticket.quantity_reserved,
        0
    );

    let unavailableReason: string | null = null;

    if (eventCancelled) {
        unavailableReason = "Cancelled";
    } else if (ticket.price_kzt > 0 && !paidSalesEnabled) {
        unavailableReason = "Not on sale yet";
    } else if (remaining <= 0) {
        unavailableReason = "Sold out";
    } else if (
        ticket.sales_start_at &&
        new Date(ticket.sales_start_at).getTime() > Date.now()
    ) {
        unavailableReason = "Not on sale yet";
    } else if (
        ticket.sales_end_at &&
        new Date(ticket.sales_end_at).getTime() < Date.now()
    ) {
        unavailableReason = "Sales closed";
    }

    const isFree = ticket.price_kzt === 0;
    const canPurchase = !unavailableReason && isFree && !purchasing;

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
            });

            if (order.status === "paid" && order.tickets.length > 0) {
                Alert.alert(
                    "Ticket purchased!",
                    `Your ticket for this event is ready. You can find it in My Tickets.`
                );
            } else {
                Alert.alert(
                    "Order created",
                    "Your order was created, but the ticket is not ready yet."
                );
            }
        } catch (error) {
            Alert.alert(
                "Purchase failed",
                error instanceof Error
                    ? error.message
                    : "Could not purchase this ticket. Please try again."
            );
        } finally {
            setPurchasing(false);
        }
    }

    return (
        <View style={styles.ticketCard}>
            <View style={styles.ticketInfo}>
                <Text style={styles.ticketName}>{ticket.name}</Text>
                <Text style={styles.ticketAvailability}>
                    {unavailableReason ?? `${remaining} tickets available`}
                </Text>
            </View>

            <View style = {styles.ticketActions}>
                <Text style = {styles.ticketPrice}>
                    {isFree
                        ? "Free"
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
                            ? "Processing..."
                            : unavailableReason
                                ? unavailableReason
                                : isFree
                                    ? "Get ticket"
                                    : "Coming soon"}
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
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
});