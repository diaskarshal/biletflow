import { useState} from "react";
import {
    View,
    Text,
    TextInput,
    Button,
    StyleSheet,
} from "react-native";
import { registerUser } from "../api/auth";

export default function RegisterScreen() {
    const [fullName, setFullName] = useState("")
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleRegister() {
        setLoading(true);
        setMessage("");

        try{
            const user = await registerUser({
                full_name: fullName,
                email,
                password,
            });

            console.log("Registered:", user);

            setMessage("Registration complete");
        } catch (error) {
            console.error("Registration error:", error);

            if (error instanceof Error) {
                setMessage(error.message);
            } else {
                setMessage("Registration failed");
            }
        } finally {
            setLoading(false);
        }
    }

    return(
        <View style = {styles.container}>
            <Text style = {styles.title}> Create account </Text>

            <TextInput
                style = {styles.input}
                placeholder = "Full name"
                value = {fullName}
                onChangeText = {setFullName}
            />

            <TextInput
                style = {styles.input}
                placeholder = "Email"
                value = {email}
                onChangeText = {setEmail}
                keyboardType = "email-address"
                autoCapitalize = "none"
            />

            <TextInput
                style = {styles.input}
                placeholder = "Password"
                value = {password}
                onChangeText = {setPassword}
                secureTextEntry
            />

            <Button
                title = {loading ? "Registering..." : "Register"}
                onPress = {handleRegister}
                disabled = {loading}
            />

            {message != "" && (
                <Text style = {styles.message}>{message}</Text>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        padding: 24,
    },

    title: {
        fontSize: 28,
        fontWeight: "bold",
        marginBottom: 24,
    },

    input: {
        borderWidth: 1,
        borderColor: "#aaa",
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },

    message: {
        marginTop: 16,
        textAlign: "center",
    },
})