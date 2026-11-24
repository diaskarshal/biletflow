import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { calendarFileUrl } from "../api/events";
import { getPayment, simulatePayment, type Payment } from "../api/orders";
import type { RootStackParamList } from "../navigation/AppNavigation";
import { t, tOptional } from "../i18n";

type Props = NativeStackScreenProps<RootStackParamList, "Payment">;
type Outcome = "success" | "failure" | "timeout";

export default function PaymentScreen({ route, navigation }: Props) {
    const { paymentId } = route.params;
    const [payment, setPayment] = useState<Payment | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        getPayment(paymentId).then(setPayment, (e) => setError(e instanceof Error ? e.message : t("common.error")));
    }, [paymentId]);

    async function answer(outcome: Outcome) {
        setBusy(true);
        setError("");
        try {
            setPayment(await simulatePayment(paymentId, outcome));
        } catch (e) {
            setError(e instanceof Error ? e.message : t("common.error"));
        } finally {
            setBusy(false);
        }
    }

    if (!payment) {
        return (
            <View style={styles.center}>
                {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color="#2563eb" />}
            </View>
        );
    }

    const purpose = payment.purpose === "order" ? "pay.forTickets" : "pay.forActivation";

    return (
        <View style={styles.container}>
            <Text style={styles.notice}>{t("pay.notice")}</Text>
            <Text style={styles.title}>{t(purpose, { event: payment.event_title })}</Text>
            <Text style={styles.amount}>{t("pay.amount", { amount: payment.amount_kzt.toLocaleString("ru-RU") })}</Text>
            {payment.status === "pending" ? (
                <>
                    <Text style={styles.text}>{t("pay.choose")}</Text>
                    {(["success", "failure", "timeout"] as Outcome[]).map((outcome) => (
                        <Pressable
                            key={outcome}
                            disabled={busy}
                            onPress={() => answer(outcome)}
                            style={[styles.button, outcome !== "success" && styles.secondary, busy && styles.disabled]}
                        >
                            <Text style={[styles.buttonText, outcome !== "success" && styles.secondaryText]}>
                                {t(`pay.${outcome}`)}
                            </Text>
                        </Pressable>
                    ))}
                </>
            ) : (
                <>
                    <Text style={styles.result}>{tOptional(`pay.result.${payment.status}`) ?? payment.status}</Text>
                    {payment.purpose === "order" && payment.status === "succeeded" && (
                        <Pressable
                            style={[styles.button, styles.secondary]}
                            onPress={() => Linking.openURL(calendarFileUrl(payment.event_slug))}
                        >
                            <Text style={[styles.buttonText, styles.secondaryText]}>{t("cal.add")}</Text>
                        </Pressable>
                    )}
                    <Pressable style={styles.button} onPress={() => navigation.goBack()}>
                        <Text style={styles.buttonText}>{t("pay.done")}</Text>
                    </Pressable>
                </>
            )}
            {error !== "" && <Text style={styles.error}>{error}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, gap: 12, backgroundColor: "#ffffff" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
    notice: { borderWidth: 1, borderColor: "#999999", padding: 12, fontWeight: "600" },
    title: { fontSize: 20, fontWeight: "700", color: "#111111" },
    amount: { fontSize: 18 },
    text: { fontSize: 15 },
    result: { fontSize: 18, fontWeight: "700" },
    button: { backgroundColor: "#2563eb", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
    secondary: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#2563eb" },
    disabled: { opacity: 0.5 },
    buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
    secondaryText: { color: "#2563eb" },
    error: { color: "#b00020" },
});
