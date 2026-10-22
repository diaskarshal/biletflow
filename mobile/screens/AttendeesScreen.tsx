import { useCallback, useEffect, useState } from "react";
import { Button, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { checkInById, getSummary, searchAttendees, undoCheckIn } from "../api/checkin";
import type { Attendee, CheckinSummary } from "../api/checkin";
import type { RootStackParamList } from "../navigation/AppNavigation";

type Props = NativeStackScreenProps<RootStackParamList, "Attendees">;

const STATUS_LABEL: Record<string, string> = {
    valid: "Not checked in",
    checked_in: "Checked in",
    cancelled: "Cancelled",
    refunded: "Refunded",
};

export default function AttendeesScreen({ route }: Props) {
    const { eventId } = route.params;
    const [query, setQuery] = useState("");
    const [attendees, setAttendees] = useState<Attendee[]>([]);
    const [summary, setSummary] = useState<CheckinSummary | null>(null);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        try {
            const [list, counts] = await Promise.all([
                searchAttendees(eventId, query),
                getSummary(eventId),
            ]);
            setAttendees(list);
            setSummary(counts);
            setError("");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not load attendees");
        }
    }, [eventId, query]);

    useEffect(() => {
        const timer = setTimeout(load, 300);
        return () => clearTimeout(timer);
    }, [load]);

    async function act(attendee: Attendee) {
        try {
            if (attendee.status === "checked_in") {
                await undoCheckIn(attendee.ticket_id, eventId);
            } else {
                await checkInById(attendee.ticket_id, eventId);
            }
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Action failed");
        }
    }

    return (
        <View style={styles.container}>
            {summary && (
                <Text style={styles.counts}>
                    Checked in {summary.checked_in} of {summary.registered}
                </Text>
            )}
            <TextInput
                style={styles.input}
                placeholder="Search by name or email"
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
            />
            {error !== "" && <Text style={styles.error}>{error}</Text>}
            <FlatList
                data={attendees}
                keyExtractor={(a) => String(a.ticket_id)}
                ListEmptyComponent={<Text style={styles.empty}>No attendees found.</Text>}
                renderItem={({ item }) => (
                    <View style={styles.row}>
                        <View style={styles.info}>
                            <Text style={styles.name}>{item.attendee_name}</Text>
                            <Text>{item.attendee_email}</Text>
                            <Text>
                                {item.ticket_type_name} · {STATUS_LABEL[item.status] ?? item.status}
                            </Text>
                        </View>
                        {item.status === "valid" && (
                            <Button title="Check in" onPress={() => act(item)} />
                        )}
                        {item.status === "checked_in" && (
                            <Button title="Undo" color="#b00020" onPress={() => act(item)} />
                        )}
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        gap: 12,
    },

    counts: {
        fontSize: 18,
        fontWeight: "bold",
    },

    input: {
        borderWidth: 1,
        borderColor: "#999",
        padding: 10,
        fontSize: 16,
    },

    error: {
        color: "#b00020",
    },

    empty: {
        textAlign: "center",
        marginTop: 24,
    },

    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#ddd",
        gap: 12,
    },

    info: {
        flex: 1,
    },

    name: {
        fontSize: 16,
        fontWeight: "bold",
    },
});
