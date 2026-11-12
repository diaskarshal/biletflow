
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
    Modal,
} from "react-native";

import { useState } from "react";

import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigation";

import {
    createSupportCase,
    type SupportCategory,
} from "../api/support";

type Props = NativeStackScreenProps<
    RootStackParamList,
    "NewSupportCase"
>;

const CATEGORIES: { value: SupportCategory; label: string }[] = [
    { value: "ticket_delivery", label: "Ticket delivery" },
    { value: "payment", label: "Payment" },
    { value: "refund", label: "Refund" },
    { value: "seating", label: "Seating" },
    { value: "event_information", label: "Event information" },
    { value: "check_in", label: "Check-in" },
    { value: "account", label: "Account" },
    { value: "technical", label: "Technical issue" },
];

export default function NewSupportCaseScreen({
    route,
    navigation,
}: Props) {
    const { ticketId, eventId } = route.params;

    const [category, setCategory] =
        useState<SupportCategory>("ticket_delivery");

    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");

    const [categoryVisible, setCategoryVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const selectedCategory = CATEGORIES.find(
        (item) => item.value === category
    );

    async function submitRequest() {
        if (!subject.trim() || !message.trim()) {
            setError("Please fill in both the subject and message.");
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            const created = await createSupportCase({
                kind: "attendee",
                category,
                subject: subject.trim(),
                message: message.trim(),
                ...(ticketId ? { ticket_id: ticketId } : { event_id: eventId }),
            });

            Alert.alert(
                "Request submitted",
                `Your support request #${created.id} has been sent to the organizer.`,
                [
                    {
                        text: "OK",
                        onPress: () => navigation.goBack(),
                    },
                ]
            );
        } catch (err) {
            console.error("SUPPORT CREATE ERROR:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Could not submit your request."
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
        >
            <Text style={styles.title}>Contact the organizer</Text>

            <Text style={styles.description}>
                About: This event
            </Text>

            <Text style={styles.label}>Category</Text>

            <Pressable
                style={styles.select}
                onPress={() => setCategoryVisible(true)}
            >
                <Text style={styles.selectText}>
                    {selectedCategory?.label}
                </Text>
                <Text style={styles.arrow}>▼</Text>
            </Pressable>

            <Text style={styles.label}>Subject</Text>

            <TextInput
                style={styles.input}
                placeholder="What is the problem?"
                value={subject}
                onChangeText={setSubject}
                maxLength={200}
                editable={!submitting}
            />

            <Text style={styles.counter}>
                {subject.length}/200
            </Text>

            <Text style={styles.label}>Message</Text>

            <TextInput
                style={[styles.input, styles.messageInput]}
                placeholder="Describe your problem in detail..."
                value={message}
                onChangeText={setMessage}
                multiline
                textAlignVertical="top"
                maxLength={5000}
                editable={!submitting}
            />

            <Text style={styles.counter}>
                {message.length}/5000
            </Text>

            {error ? (
                <Text style={styles.error}>{error}</Text>
            ) : null}

            <Pressable
                style={[
                    styles.submitButton,
                    submitting && styles.disabledButton,
                ]}
                onPress={submitRequest}
                disabled={submitting}
            >
                {submitting ? (
                    <ActivityIndicator color="#ffffff" />
                ) : (
                    <Text style={styles.submitText}>
                        Send request
                    </Text>
                )}
            </Pressable>

            <Modal
                visible={categoryVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setCategoryVisible(false)}
            >
                <Pressable
                    style={styles.modalBackground}
                    onPress={() => setCategoryVisible(false)}
                >
                    <Pressable
                        style={styles.modalContent}
                        onPress={() => {}}
                    >
                        <Text style={styles.modalTitle}>
                            Select a category
                        </Text>

                        {CATEGORIES.map((item) => (
                            <Pressable
                                key={item.value}
                                style={styles.categoryOption}
                                onPress={() => {
                                    setCategory(item.value);
                                    setCategoryVisible(false);
                                }}
                            >
                                <Text
                                    style={[
                                        styles.categoryText,
                                        category === item.value &&
                                            styles.selectedCategory,
                                    ]}
                                >
                                    {item.label}
                                </Text>
                            </Pressable>
                        ))}
                    </Pressable>
                </Pressable>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8fafc",
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    title: {
        fontSize: 25,
        fontWeight: "800",
        color: "#172033",
        marginBottom: 10,
    },
    description: {
        fontSize: 14,
        color: "#64748b",
        lineHeight: 21,
        marginBottom: 25,
    },
    label: {
        fontSize: 15,
        fontWeight: "700",
        color: "#334155",
        marginBottom: 9,
        marginTop: 18,
    },
    select: {
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 10,
        padding: 15,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    selectText: {
        fontSize: 15,
        color: "#334155",
    },
    arrow: {
        color: "#64748b",
    },
    input: {
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 10,
        padding: 14,
        fontSize: 15,
        color: "#172033",
    },
    messageInput: {
        height: 160,
    },
    counter: {
        textAlign: "right",
        color: "#94a3b8",
        fontSize: 12,
        marginTop: 5,
    },
    submitButton: {
        backgroundColor: "#2563eb",
        borderRadius: 10,
        padding: 16,
        alignItems: "center",
        marginTop: 25,
    },
    disabledButton: {
        opacity: 0.6,
    },
    submitText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "700",
    },
    error: {
        color: "#dc2626",
        marginTop: 15,
        fontSize: 14,
    },
    modalBackground: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "center",
        padding: 25,
    },
    modalContent: {
        backgroundColor: "#ffffff",
        borderRadius: 15,
        padding: 20,
    },
    modalTitle: {
        fontSize: 19,
        fontWeight: "800",
        marginBottom: 15,
        color: "#172033",
    },
    categoryOption: {
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: "#f1f5f9",
    },
    categoryText: {
        fontSize: 15,
        color: "#334155",
    },
    selectedCategory: {
        color: "#2563eb",
        fontWeight: "800",
    },
});
