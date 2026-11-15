import { useCallback, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import {
    getMySupportCases,
    getSupportCase,
    getSupportInbox,
    sendSupportMessage,
    setSupportStatus,
    type SupportCase,
    type SupportCaseDetail,
    type SupportStatus,
} from "../api/support";
import type { RootStackParamList } from "../navigation/AppNavigation";
import { locale, t, type MessageKey } from "../i18n";

const STATUSES: SupportStatus[] = ["open", "in_progress", "waiting_for_customer", "resolved"];
const statusLabel = (s: string) => t(`case.${s}` as MessageKey);
const when = (iso: string) => new Date(iso).toLocaleString(locale(), { dateStyle: "medium", timeStyle: "short" });

export function SupportScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [mine, setMine] = useState<SupportCase[]>([]);
    const [inbox, setInbox] = useState<SupportCase[]>([]);
    const [error, setError] = useState("");

    useFocusEffect(
        useCallback(() => {
            Promise.all([getMySupportCases(), getSupportInbox()]).then(
                ([m, i]) => {
                    setMine(m);
                    setInbox(i);
                },
                (e) => setError(e instanceof Error ? e.message : t("common.error")),
            );
        }, []),
    );

    const row = (c: SupportCase) => (
        <Pressable key={c.id} style={styles.row} onPress={() => navigation.navigate("SupportCase", { caseId: c.id })}>
            <Text style={styles.subject}>#{c.id} {c.subject}</Text>
            <Text style={styles.meta}>
                {statusLabel(c.status)}
                {c.event_title ? ` · ${c.event_title}` : ""}
            </Text>
        </Pressable>
    );

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {error !== "" && <Text style={styles.error}>{error}</Text>}
            <Text style={styles.heading}>{t("support.mine")}</Text>
            {mine.length === 0 ? <Text style={styles.meta}>{t("support.none")}</Text> : mine.map(row)}
            {inbox.length > 0 && <Text style={styles.heading}>{t("support.toHandle")}</Text>}
            {inbox.map(row)}
        </ScrollView>
    );
}

export function SupportCaseScreen({ route }: NativeStackScreenProps<RootStackParamList, "SupportCase">) {
    const { caseId } = route.params;
    const [detail, setDetail] = useState<SupportCaseDetail | null>(null);
    const [reply, setReply] = useState("");
    const [error, setError] = useState("");

    const run = (task: Promise<SupportCaseDetail>) =>
        task.then(setDetail, (e) => setError(e instanceof Error ? e.message : t("common.error")));

    useFocusEffect(
        useCallback(() => {
            run(getSupportCase(caseId));
        }, [caseId]),
    );

    if (!detail) return <Text style={styles.error}>{error}</Text>;

    return (
        <View style={styles.container}>
            <FlatList
                contentContainerStyle={styles.content}
                data={detail.messages}
                keyExtractor={(m) => String(m.id)}
                ListHeaderComponent={
                    <View style={styles.header}>
                        <Text style={styles.heading}>#{detail.id} {detail.subject}</Text>
                        <Text style={styles.meta}>{statusLabel(detail.status)}</Text>
                        {detail.can_manage && (
                            <View style={styles.chips}>
                                {STATUSES.map((s) => (
                                    <Pressable
                                        key={s}
                                        onPress={() => run(setSupportStatus(caseId, s))}
                                        style={[styles.chip, detail.status === s && styles.chipActive]}
                                    >
                                        <Text style={detail.status === s ? styles.chipActiveText : styles.chipText}>
                                            {statusLabel(s)}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={[styles.message, !item.from_requester && styles.staffMessage]}>
                        <Text style={styles.meta}>
                            {item.author_name}
                            {item.from_requester ? "" : ` (${t("support.staff")})`}, {when(item.created_at)}
                        </Text>
                        <Text style={styles.body}>{item.body}</Text>
                    </View>
                )}
            />
            <View style={styles.replyBar}>
                <TextInput
                    style={styles.input}
                    value={reply}
                    onChangeText={setReply}
                    placeholder={t("support.reply")}
                    multiline
                />
                <Pressable
                    style={[styles.send, !reply.trim() && styles.disabled]}
                    disabled={!reply.trim()}
                    onPress={() => run(sendSupportMessage(caseId, reply.trim()).then((d) => (setReply(""), d)))}
                >
                    <Text style={styles.sendText}>{t("support.sendReply")}</Text>
                </Pressable>
            </View>
            {error !== "" && <Text style={styles.error}>{error}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#ffffff" },
    content: { padding: 16, gap: 10 },
    header: { gap: 6, marginBottom: 8 },
    heading: { fontSize: 18, fontWeight: "700", marginTop: 8 },
    row: { borderWidth: 1, borderColor: "#dddddd", borderRadius: 10, padding: 12, gap: 4 },
    subject: { fontSize: 16, fontWeight: "600" },
    meta: { color: "#555555", fontSize: 13 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: { borderWidth: 1, borderColor: "#2563eb", borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 },
    chipActive: { backgroundColor: "#2563eb" },
    chipText: { color: "#2563eb", fontSize: 13 },
    chipActiveText: { color: "#ffffff", fontSize: 13 },
    message: { borderWidth: 1, borderColor: "#dddddd", borderRadius: 10, padding: 10, gap: 4 },
    staffMessage: { borderColor: "#2563eb" },
    body: { fontSize: 15 },
    replyBar: { flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: "#dddddd" },
    input: { flex: 1, borderWidth: 1, borderColor: "#999999", borderRadius: 8, padding: 10, maxHeight: 120 },
    send: { backgroundColor: "#2563eb", borderRadius: 8, paddingHorizontal: 14, justifyContent: "center" },
    sendText: { color: "#ffffff", fontWeight: "600" },
    disabled: { opacity: 0.5 },
    error: { color: "#b00020", padding: 16 },
});
