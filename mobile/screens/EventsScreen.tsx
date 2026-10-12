import { useCallback, useLayoutEffect, useState } from "react";
import {
    ActivityIndicator,
    Button,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { getMyEvents } from "../api/events";
import type { EventItem } from "../api/events";
import type { RootStackParamList } from "../navigation/AppNavigation";
import { useSession } from "../session/SessionContext";
import { formatEventDate } from "../utils/formatDate";

type Props = NativeStackScreenProps<RootStackParamList, "Events">;

const STATUS_LABEL: Record<EventItem["status"], string> = {
    draft: "Draft",
    published: "Open for check-in",
    cancelled: "Cancelled",
    completed: "Completed",
};

// Only published events can be scanned; the rest are shown but disabled.
function isScannable(event: EventItem) {
    return event.status === "published";
}

export default function EventsScreen({ navigation }: Props) {
    const { user, signOut } = useSession();

    const [events, setEvents] = useState<EventItem[] | null>(null);
    const [error, setError] = useState("");
    const [refreshing, setRefreshing] = useState(false);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => <Button title="Log out" onPress={signOut} />,
        });
    }, [navigation, signOut]);

    const load = useCallback(async () => {
        setError("");
        try {
            setEvents(await getMyEvents());
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not load events");
        }
    }, []);

    // Reload whenever the screen comes into focus (also after returning from the scanner).
    useFocusEffect(
        useCallback(() => {
            load();
        }, [load])
    );

    async function handleRefresh() {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }

    if (events === null && error === "") {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (events === null) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>{error}</Text>
                <Button title="Try again" onPress={load} />
            </View>
        );
    }

    return (
        <FlatList
            data={events}
            keyExtractor={(event) => String(event.id)}
            contentContainerStyle={styles.list}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            ListHeaderComponent={
                <View>
                    <Text style={styles.greeting}>Hi, {user?.full_name}</Text>
                    <Text style={styles.subtitle}>Choose an event to check people in.</Text>
                    {error !== "" && <Text style={styles.errorText}>{error}</Text>}
                </View>
            }
            ListEmptyComponent={
                <Text style={styles.empty}>No events found for this account.</Text>
            }
            renderItem={({ item }) => {
                const scannable = isScannable(item);
                return (
                    <Pressable
                        style={[styles.card, !scannable && styles.cardDisabled]}
                        disabled={!scannable}
                        onPress={() =>
                            navigation.navigate("Scanner", {
                                eventId: item.id,
                                title: item.title,
                            })
                        }
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !scannable }}
                    >
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        <Text style={styles.cardLine}>
                            {formatEventDate(item.starts_at, item.display_timezone)}
                        </Text>
                        {item.venue_name !== null && (
                            <Text style={styles.cardLine}>{item.venue_name}</Text>
                        )}
                        <Text style={[styles.status, scannable && styles.statusOpen]}>
                            {STATUS_LABEL[item.status]}
                        </Text>
                    </Pressable>
                );
            }}
        />
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 12,
    },

    list: {
        padding: 16,
        gap: 12,
    },

    greeting: {
        fontSize: 24,
        fontWeight: "bold",
    },

    subtitle: {
        marginTop: 4,
        marginBottom: 12,
        color: "#555",
    },

    errorText: {
        color: "#b00020",
        textAlign: "center",
        marginBottom: 8,
    },

    empty: {
        textAlign: "center",
        marginTop: 32,
        color: "#555",
    },

    card: {
        borderWidth: 1,
        borderColor: "#aaa",
        borderRadius: 8,
        padding: 14,
        backgroundColor: "#fff",
        gap: 2,
    },

    cardDisabled: {
        opacity: 0.5,
    },

    cardTitle: {
        fontSize: 18,
        fontWeight: "bold",
    },

    cardLine: {
        color: "#333",
    },

    status: {
        marginTop: 6,
        fontWeight: "600",
        color: "#555",
    },

    statusOpen: {
        color: "#1b7a34",
    },
});
