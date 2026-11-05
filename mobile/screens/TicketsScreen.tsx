
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { getMyOrders, type Order, type OrderTicket } from "../api/orders";

type TicketListItem = {
    ticket: OrderTicket;
    order: Order;
};

export default function TicketsScreen() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const loadOrders = useCallback(async (refresh = false) => {
        try {
            if (refresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError("");

            const result = await getMyOrders();
            setOrders(result);
        } catch (e) {
            console.error("MY TICKETS ERROR:", e);

            setError(
                e instanceof Error
                    ? e.message
                    : "Could not load your tickets."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void loadOrders();
        }, [loadOrders])
    );

    const tickets: TicketListItem[] = orders.flatMap((order) =>
        order.tickets.map((ticket) => ({
            ticket,
            order,
        }))
    );

    function formatDate(dateString: string) {
        return new Date(dateString).toLocaleDateString("ru-RU", {
            weekday: "short",
            month: "long",
            day: "numeric",
            year: "numeric",
        });
    }

    function formatTime(dateString: string, timezone: string) {
        return new Date(dateString).toLocaleTimeString("ru-RU", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: timezone || "Asia/Almaty",
        });
    }

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.muted}>Loading your tickets...</Text>
            </View>
        );
    }

    if (error && tickets.length === 0) {
        return (
            <View style={styles.center}>
                <Text style={styles.title}>Could not load tickets</Text>
                <Text style={styles.muted}>{error}</Text>
                <Text style={styles.retry} onPress={() => void loadOrders()}>
                    Try again
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>My Tickets</Text>
                <Text style={styles.subtitle}>
                    Your purchased event tickets
                </Text>
            </View>

            <FlatList
                data={tickets}
                keyExtractor={(item) => String(item.ticket.id)}
                contentContainerStyle={[
                    styles.list,
                    tickets.length === 0 && styles.emptyList,
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => void loadOrders(true)}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyTitle}>
                            No tickets yet
                        </Text>
                        <Text style={styles.muted}>
                            Tickets you purchase will appear here.
                        </Text>
                    </View>
                }
                renderItem={({ item }) => {
                    const { ticket, order } = item;
                    const event = order.event;

                    return (
                        <View style={styles.ticketCard}>
                            <View style={styles.ticketTop}>
                                <View style={styles.eventInfo}>
                                    <Text style={styles.eventTitle}>
                                        {event.title}
                                    </Text>

                                    <Text style={styles.date}>
                                        {formatDate(event.starts_at)}
                                    </Text>

                                    <Text style={styles.time}>
                                        {formatTime(
                                            event.starts_at,
                                            event.display_timezone
                                        )}
                                    </Text>
                                </View>

                                <View style={styles.statusBadge}>
                                    <Text style={styles.statusText}>
                                        {ticket.status.toUpperCase()}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.divider} />

                            <Text style={styles.detailLabel}>
                                TICKET HOLDER
                            </Text>
                            <Text style={styles.detailValue}>
                                {ticket.attendee_name}
                            </Text>

                            <Text style={styles.detailLabel}>
                                VENUE
                            </Text>
                            <Text style={styles.detailValue}>
                                {event.venue_name ||
                                    event.venue_address ||
                                    "Venue not specified"}
                            </Text>

                            <View style={styles.ticketFooter}>
                                <Text style={styles.ticketNumber}>
                                    Ticket #{ticket.id}
                                </Text>
                                <Text style={styles.orderStatus}>
                                    Order: {order.status}
                                </Text>
                            </View>
                        </View>
                    );
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8fafc",
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 22,
        paddingBottom: 15,
    },
    title: {
        fontSize: 27,
        fontWeight: "800",
        color: "#172033",
    },
    subtitle: {
        fontSize: 14,
        color: "#64748b",
        marginTop: 5,
    },
    list: {
        paddingHorizontal: 16,
        paddingBottom: 25,
    },
    emptyList: {
        flexGrow: 1,
    },
    ticketCard: {
        backgroundColor: "#ffffff",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#e5e9f0",
        padding: 17,
        marginBottom: 14,
    },
    ticketTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 10,
    },
    eventInfo: {
        flex: 1,
    },
    eventTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#172033",
    },
    date: {
        fontSize: 14,
        color: "#475569",
        marginTop: 9,
    },
    time: {
        fontSize: 13,
        color: "#64748b",
        marginTop: 4,
    },
    statusBadge: {
        backgroundColor: "#dcfce7",
        paddingHorizontal: 9,
        paddingVertical: 6,
        borderRadius: 8,
    },
    statusText: {
        color: "#166534",
        fontSize: 10,
        fontWeight: "800",
    },
    divider: {
        height: 1,
        backgroundColor: "#e5e9f0",
        marginVertical: 15,
    },
    detailLabel: {
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 0.8,
        color: "#94a3b8",
        marginTop: 10,
    },
    detailValue: {
        fontSize: 14,
        fontWeight: "600",
        color: "#334155",
        marginTop: 4,
    },
    ticketFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 17,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: "#e5e9f0",
    },
    ticketNumber: {
        fontSize: 12,
        color: "#64748b",
    },
    orderStatus: {
        fontSize: 12,
        color: "#64748b",
        textTransform: "capitalize",
    },
    empty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 25,
    },
    emptyTitle: {
        fontSize: 19,
        fontWeight: "800",
        color: "#172033",
        marginBottom: 8,
    },
    muted: {
        fontSize: 14,
        color: "#64748b",
        textAlign: "center",
        marginTop: 8,
    },
    retry: {
        color: "#2563eb",
        fontWeight: "700",
        marginTop: 18,
    },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 25,
        backgroundColor: "#f8fafc",
    },
});
