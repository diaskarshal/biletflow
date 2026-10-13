import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { checkInTicket } from "../api/checkin";
import type { RootStackParamList } from "../navigation/AppNavigation";
import { classifyQrPayload } from "../utils/qr";
import { outcomeFromError, rejectedQrOutcome } from "../utils/scanOutcome";
import type { ScanOutcome } from "../utils/scanOutcome";

type Props = NativeStackScreenProps<RootStackParamList, "Scanner">;

// A successful check-in closes itself so staff can keep scanning; problems stay until tapped.
const VALID_AUTO_DISMISS_MS = 2500;
// After a result is dismissed, ignore the same QR for a moment: it is usually still in front of
// the camera and would otherwise be read again (and show "already used" right after "valid").
const SAME_QR_COOLDOWN_MS = 3000;

// Every result uses colour AND a symbol AND text, so it is readable without relying on colour.
const OUTCOME_UI: Record<ScanOutcome["kind"], { color: string; symbol: string; label: string }> = {
    valid: { color: "#1b7a34", symbol: "✓", label: "VALID" },
    already_used: { color: "#b26a00", symbol: "!", label: "ALREADY USED" },
    cancelled: { color: "#b00020", symbol: "✕", label: "CANCELLED" },
    refunded: { color: "#b00020", symbol: "✕", label: "REFUNDED" },
    invalid: { color: "#b00020", symbol: "✕", label: "INVALID TICKET" },
    not_ticket: { color: "#555555", symbol: "?", label: "NOT A TICKET" },
    forbidden: { color: "#555555", symbol: "!", label: "NOT ALLOWED" },
    error: { color: "#555555", symbol: "!", label: "SCAN FAILED" },
};

export default function ScannerScreen({ route }: Props) {
    const { eventId } = route.params;

    const [permission, requestPermission] = useCameraPermissions();
    const [outcome, setOutcome] = useState<ScanOutcome | null>(null);

    // Refs, not state: the camera can report the same QR several times before a state update lands.
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
            show({ kind: "valid", attendeeName: result.attendee_name });
        } catch (error) {
            show(outcomeFromError(error));
        }
    }

    if (!permission) {
        return <View style={styles.center} />;
    }

    if (!permission.granted) {
        return (
            <View style={styles.center}>
                <Text style={styles.permissionText}>
                    BiletFlow needs camera access to scan ticket QR codes.
                </Text>
                {permission.canAskAgain ? (
                    <Button title="Grant camera permission" onPress={requestPermission} />
                ) : (
                    <Button title="Open settings" onPress={() => Linking.openSettings()} />
                )}
            </View>
        );
    }

    const ui = outcome ? OUTCOME_UI[outcome.kind] : null;

    return (
        <View style={styles.container}>
            <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={outcome ? undefined : handleScan}
            />

            <View style={styles.hintBar} pointerEvents="none">
                <Text style={styles.hintText}>Point the camera at the ticket QR code</Text>
            </View>

            {outcome && ui && (
                <Pressable
                    style={[StyleSheet.absoluteFill, styles.result, { backgroundColor: ui.color }]}
                    onPress={dismiss}
                    accessibilityRole="alert"
                    accessibilityLabel={`${ui.label}. ${
                        outcome.kind === "valid" ? outcome.attendeeName : outcome.message
                    }. Tap to scan next.`}
                >
                    <Text style={styles.resultSymbol}>{ui.symbol}</Text>
                    <Text style={styles.resultLabel}>{ui.label}</Text>
                    <Text style={styles.resultMessage}>
                        {outcome.kind === "valid" ? outcome.attendeeName : outcome.message}
                    </Text>
                    <Text style={styles.resultHint}>Tap to scan next</Text>
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
