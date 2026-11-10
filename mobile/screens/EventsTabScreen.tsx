import { useCallback, useEffect, useState} from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import {
    getPublicEvents,
    type PublicEvent, 
} from "../api/events";

import {useNavigation} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigation";

import {
    calculateSlots,
    getEventTicketTypes,
    type TicketType,
} from "../api/events";

export default function EventsTabScreen() {
    const [events, setEvents] = useState <PublicEvent[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const [search, setSearch] = useState("");
    const [error, setError] = useState("");

    const loadFirstPage = useCallback(async ()=> {
        try{
            setError("");

            const response = await getPublicEvents();

            setEvents(response.items);
            setNextCursor(response.next_cursor);
        } catch(e) {
            setError(
                e instanceof Error ? e.message: "Could not load events"
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void loadFirstPage();
    }, [loadFirstPage]);
    
    const refresh = () => {
        setRefreshing(true);
        void loadFirstPage();
    };

    const loadMore = async () => {
        if (!nextCursor || loadingMore || loading || refreshing) {
            return;
        }

        try {
            setLoadingMore(true);

            const response = await getPublicEvents(nextCursor);

            setEvents((previous) => {
                const existingIds = new Set(previous.map((event) => event.id));

                return [
                    ...previous,
                    ...response.items.filter(
                        (event) => !existingIds.has(event.id)
                    ),
                ];
            });

            setNextCursor(response.next_cursor);
        } catch (e) {
            setError(
                e instanceof Error? e.message : "Could not load more events"
            );
        } finally {
            setLoadingMore (false);
        }
    };

    const filteredEvents = events.filter((event) => {
        const query = search.trim().toLowerCase();

        if (!query) return true;

        return (
            event.title.toLowerCase().includes(query) ||
            (event.venue_address ?? "").toLowerCase().includes(query)
        );
    });

    return (
        <View style = {styles.container}>
            <FlatList
                data = {filteredEvents}
                keyExtractor = {(item) => item.id.toString()}
                renderItem = {({item}) => <EventCard event = {item} />}
                contentContainerStyle = {styles.listContent}
                showsVerticalScrollIndicator = {false}

                ListHeaderComponent={
                    <View>
                        <Text style = {styles.heading}>
                            Discover Events
                        </Text>

                        <Text style = {styles.subtitle}>
                            Find something exciting happening around you!
                        </Text>

                        <View style = {styles.searchContainer}>
                            <Text style = {styles.searchIcon}>⌕</Text>

                            <TextInput
                                style={styles.searchInput}
                                placeholder = "Search events or locations..."
                                placeholderTextColor = "#999"
                                value = {search}
                                onChangeText = {setSearch}
                            />
                        </View>

                        <Text style = {styles.sectionTitle}>
                            Upcoming Events
                        </Text>

                        {error !== "" && (
                            <View style = {styles.errorContainer}>
                                <Text style = {styles.errorText}>
                                    {error}
                                </Text>

                                <Pressable onPress={loadFirstPage}>
                                    <Text style = {styles.retryText}>
                                        Try again
                                    </Text>
                                </Pressable>
                            </View>
                        )}

                        {loading && (
                            <ActivityIndicator
                                size = "large"
                                color = "#2563eb"
                                style = {styles.loader}
                            />
                        )}
                    </View>
                }

                ListEmptyComponent={
                    !loading && !error ? (
                        <View style = {styles.emptyContainer}>
                            <Text style = {styles.emptyTitle}>
                                No events found
                            </Text>

                            <Text style = {styles.emptyText}>
                                Search for something else or check back later
                            </Text>
                        </View>
                    ) : undefined
                }

                ListFooterComponent = {
                    loadingMore ? (
                        <ActivityIndicator
                            color = "#2563eb"
                            style = {styles.footerLoader}
                        />
                    ) : undefined
                }
                onEndReached = {loadMore}
                onEndReachedThreshold = {0.5}

                refreshControl = {
                    <RefreshControl
                        refreshing = {refreshing}
                        onRefresh = {refresh}
                        tintColor = "#2563eb"
                    />
                }
            />
        </View>
    );
}

function EventCard({event}: {event: PublicEvent}) {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const [imageFailed, setImageFailed] = useState(false);
    const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
    const [slotsLoaded, setSlotsLoaded] = useState(false);

    useEffect(() => {
        let active = true;

        getEventTicketTypes(event.id)
            .then((types) => {
                if (active) {
                    setTicketTypes(types);
                    setSlotsLoaded(true);
                }
            })
            .catch(() => {
                if (active) setSlotsLoaded(true);
            });
        return () => {
            active = false;
        };
    }, [event.id]);

    const date = new Intl.DateTimeFormat("en-GB", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: event.display_timezone || "Asia/Almaty",
    }).format(new Date(event.starts_at));

    const time = new Intl.DateTimeFormat("en-GB", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: event.display_timezone || "Asia/Almaty",
    }).format(new Date(event.starts_at));

    const slots = calculateSlots(ticketTypes);

    return (
        <Pressable
            style={styles.card}
            onPress={() =>
                navigation.navigate("EventDetails", {
                    slug: event.slug,
                })
            }
            accessibilityRole="button"
        >
            {event.cover_image_url && !imageFailed ? (
                <Image
                    source={{ uri: event.cover_image_url }}
                    style={styles.coverImage}
                    resizeMode="cover"
                    onError={() => setImageFailed(true)}
                />
            ) : (
                <View style={styles.imagePlaceholder}>
                    <Text style={styles.placeholderText}>
                        {event.title}
                    </Text>
                </View>
            )}

            <View style={styles.cardContent}>
                <Text style={styles.cardEyebrow}>
                    UPCOMING EVENT
                </Text>

                <Text style={styles.eventTitle}>
                    {event.title}
                </Text>

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

                <View style={styles.infoRow}>
                    <Text style={styles.infoIcon}>♙</Text>
                    <Text style={styles.infoText}>
                        {slotsLoaded
                            ? slots.total > 0
                                ? `${slots.left} / ${slots.total} slots available`
                                : "No ticket slots"
                            : "Loading slots..."}
                    </Text>
                </View>

                <View style={styles.cardDivider} />

                <Text style={styles.cardBottomText}>
                    Discover this event →
                </Text>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8fafc",
    },

    listContent: {
        paddingHorizontal: 18,
        paddingTop: 24,
        paddingBottom: 30,
    },

    heading: {
        fontSize: 30,
        fontWeight: "800",
        color: "#172033",
        letterSpacing: -0.7,
    },

    subtitle: {
        fontSize: 15,
        color: "#737d8f",
        marginTop: 7,
        marginBottom: 22,
    },

    searchContainer: {
        height: 52,
        backgroundColor: "#ffffff",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#e5e9f0",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 15,
        marginBottom: 27,
    },

    searchIcon: {
        fontSize: 27,
        color: "#8993a3",
        marginRight: 10,
    },

    searchInput: {
        flex: 1,
        fontSize: 14,
        color: "#172033",
    },

    sectionTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#172033",
        marginBottom: 16,
    },

    card: {
        backgroundColor: "#ffffff",
        borderRadius: 20,
        overflow: "hidden",
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "#edf0f5",
        elevation: 3,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
    },

    coverImage: {
        width: "100%",
        height: 190,
        backgroundColor: "#e8edf5",
    },

    imagePlaceholder: {
        height: 190,
        backgroundColor: "#dce8fb",
        justifyContent: "center",
        alignItems: "center",
        padding: 25,
    },

    placeholderText: {
        fontSize: 23,
        fontWeight: "700",
        color: "#2455a5",
        textAlign: "center",
    },

    cardContent: {
        padding: 18,
    },

    cardEyebrow: {
        color: "#2563eb",
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 1.2,
        marginBottom: 8,
    },

    eventTitle: {
        color: "#172033",
        fontSize: 21,
        fontWeight: "800",
        marginBottom: 15,
    },

    infoRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 10,
    },

    infoIcon: {
        width: 25,
        fontSize: 18,
        color: "#64748b",
    },

    infoText: {
        flex: 1,
        fontSize: 14,
        color: "#64748b",
    },

    cardDivider: {
        height: 1,
        backgroundColor: "#edf0f5",
        marginTop: 7,
        marginBottom: 13,
    },

    cardBottomText: {
        color: "#2563eb",
        fontWeight: "700",
        fontSize: 14,
    },

    loader: {
        marginTop: 35,
    },

    footerLoader: {
        marginVertical: 20,
    },

    emptyContainer: {
        alignItems: "center",
        paddingVertical: 45,
    },

    emptyTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#172033",
    },

    emptyText: {
        fontSize: 14,
        color: "#8993a3",
        marginTop: 8,
        textAlign: "center",
    },

    errorContainer: {
        padding: 15,
        backgroundColor: "#fff1f2",
        borderRadius: 12,
        marginBottom: 15,
    },

    errorText: {
        color: "#be123c",
        fontSize: 14,
    },

    retryText: {
        color: "#2563eb",
        fontWeight: "700",
        marginTop: 8,
    },
});