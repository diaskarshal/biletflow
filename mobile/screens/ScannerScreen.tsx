import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { checkInTicket, getSummary, undoCheckIn } from "../api/checkin";
import type { CheckinSummary } from "../api/checkin";
import type { RootStackParamList } from "../navigation/AppNavigation";
import { classifyQrPayload } from "../utils/qr";
import { outcomeFromError, rejectedQrOutcome } from "../utils/scanOutcome";
import type { ScanOutcome } from "../utils/scanOutcome";
import { t } from "../i18n";

type Props = NativeStackScreenProps<RootStackParamList, "Scanner">;

const VALID_AUTO_DISMISS_MS = 2500;
const SAME_QR_COOLDOWN_MS = 3000;

const OUTCOME_UI: Record<ScanOutcome["kind"], { color: string; symbol: string }> = {
    valid: { color: "#1b7a34", symbol: "✓" },
    already_used: { color: "#b26a00", symbol: "!" },
    cancelled: { color: "#b00020", symbol: "✕" },
    refunded: { color: "#b00020", symbol: "✕" },
    invalid: { color: "#b00020", symbol: "✕" },
    not_ticket: { color: "#555555", symbol: "?" },
    forbidden: { color: "#555555", symbol: "!" },
    error: { color: "#555555", symbol: "!" },
};

export default function ScannerScreen({ route, navigation }: Props) {
    const { eventId } = route.params;

    const [permission, requestPermission] = useCameraPermissions();
    const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
    const [summary, setSummary] = useState<CheckinSummary | null>(null);

    const loadSummary = useCallback(() => {
        getSummary(eventId).then(setSummary, () => undefined);
    }, [eventId]);

    useFocusEffect(loadSummary);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <Button title={t("scan.search")} onPress={() => navigation.navigate("Attendees", { eventId })} />
            ),
        });
    }, [navigation, eventId]);

    const busy = useRef(false);
    const lastScan = useRef<{ data: string; at: number } | null>(null);
    const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearDismissTimer = useCallback(() => {
        if (dismissTimer.current !== null) {
            clearTimeout(dismissTimer.current);
            dismissTimer.current = null;
        }
    }, []);

    const dismiss = useCallback(() => {
        clearDismissTimer();
        if (lastScan.current) {
            lastScan.current.at = Date.now();
        }
        setOutcome(null);
        busy.current = false;
    }, [clearDismissTimer]);

    useEffect(() => clearDismissTimer, [clearDismissTimer]);

    function show(result: ScanOutcome) {
        setOutcome(result);
        loadSummary();
        if (result.kind === "valid") {
            dismissTimer.current = setTimeout(dismiss, VALID_AUTO_DISMISS_MS);
        }
    }

    async function handleScan({ data }: BarcodeScanningResult) {
        if (busy.current) return;

        const last = lastScan.current;
        if (last && last.data === data && Date.now() - last.at < SAME_QR_COOLDOWN_MS) return;

        busy.current = true;
        lastScan.current = { data, at: Date.now() };

        const qr = classifyQrPayload(data);
        if (qr.kind !== "ticket") {
            show(rejectedQrOutcome(qr.kind));
            return;
        }

        try {
            const result = await checkInTicket(qr.token, eventId);
            show({ kind: "valid", attendeeName: result.attendee_name, ticketId: result.ticket_id });
        } catch (error) {
            show(outcomeFromError(error));
        }
    }

    async function undo(ticketId: number) {
        clearDismissTimer();
        try {
            await undoCheckIn(ticketId, eventId);
            lastScan.current = null;
            setOutcome(null);
            busy.current = false;
            loadSummary();
        } catch (error) {
            setOutcome(outcomeFromError(error));
        }
    }

    if (!permission) {
        return <View style={styles.center} />;
    }

    if (!permission.granted) {
        return (
            <View style={styles.center}>
                <Text style={styles.permissionText}>
                    {t("scan.permission")}
                </Text>
                {permission.canAskAgain ? (
                    <Button title={t("scan.grant")} onPress={requestPermission} />
                ) : (
                    <Button title={t("scan.settings")} onPress={() => Linking.openSettings()} />
                )}
            </View>
        );
    }

    const ui = outcome ? { ...OUTCOME_UI[outcome.kind], label: t(`scan.${outcome.kind}`) } : null;

    return (
        <View style={styles.container}>
            <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={outcome ? undefined : handleScan}
            />

            {summary && (
                <View style={styles.countBar} pointerEvents="none">
                    <Text style={styles.countText}>
                        {t("manage.checkedIn", { n: summary.checked_in, total: summary.registered })}
                    </Text>
                </View>
            )}

            <View style={styles.hintBar} pointerEvents="none">
                <Text style={styles.hintText}>{t("scan.hint")}</Text>
            </View>

            {outcome && ui && (
                <Pressable
                    style={[StyleSheet.absoluteFill, styles.result, { backgroundColor: ui.color }]}
                    onPress={dismiss}
                    accessibilityRole="alert"
                    accessibilityLabel={`${ui.label}. ${
                        outcome.kind === "valid" ? outcome.attendeeName : outcome.message
                    }. ${t("scan.next")}`}
                >
                    <Text style={styles.resultSymbol}>{ui.symbol}</Text>
                    <Text style={styles.resultLabel}>{ui.label}</Text>
                    <Text style={styles.resultMessage}>
                        {outcome.kind === "valid" ? outcome.attendeeName : outcome.message}
                    </Text>
                    {outcome.kind === "valid" && (
                        <Pressable style={styles.undoButton} onPress={() => undo(outcome.ticketId)}>
                            <Text style={styles.undoText}>{t("scan.undo")}</Text>
                        </Pressable>
                    )}
                    <Text style={styles.resultHint}>{t("scan.next")}</Text>
                </Pressable>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },

    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 16,
    },

    permissionText: {
        textAlign: "center",
    },

    hintBar: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        padding: 16,
        backgroundColor: "rgba(0,0,0,0.6)",
    },

    countBar: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        padding: 12,
        backgroundColor: "rgba(0,0,0,0.6)",
    },

    countText: {
        color: "#fff",
        textAlign: "center",
        fontSize: 18,
        fontWeight: "bold",
    },

    undoButton: {
        marginTop: 24,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderWidth: 2,
        borderColor: "#fff",
    },

    undoText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "bold",
    },

    hintText: {
        color: "#fff",
        textAlign: "center",
        fontSize: 16,
    },

    result: {
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 12,
    },

    resultSymbol: {
        color: "#fff",
        fontSize: 96,
        fontWeight: "bold",
    },

    resultLabel: {
        color: "#fff",
        fontSize: 32,
        fontWeight: "bold",
        textAlign: "center",
    },

    resultMessage: {
        color: "#fff",
        fontSize: 20,
        textAlign: "center",
    },

    resultHint: {
        position: "absolute",
        bottom: 32,
        color: "#fff",
        opacity: 0.8,
    },
});
