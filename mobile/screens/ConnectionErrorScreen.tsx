import { Button, StyleSheet, Text, View } from "react-native";
import { useSession } from "../session/SessionContext";
import { t } from "../i18n";

export default function ConnectionErrorScreen() {
    const { retry } = useSession();

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{t("conn.title")}</Text>
            <Text style={styles.text}>
                {t("conn.text")}
            </Text>
            <Button title={t("common.tryAgain")} onPress={retry} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 12,
    },

    title: {
        fontSize: 22,
        fontWeight: "bold",
    },

    text: {
        textAlign: "center",
    },
});
