import { Button, StyleSheet, Text, View } from "react-native";
import { useSession } from "../session/SessionContext";

// Shown at launch when a saved session exists but the server can't be reached.
export default function ConnectionErrorScreen() {
    const { retry } = useSession();

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Can't reach BiletFlow</Text>
            <Text style={styles.text}>
                Check that your phone is online and the backend is running, then try again.
            </Text>
            <Button title="Try again" onPress={retry} />
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
