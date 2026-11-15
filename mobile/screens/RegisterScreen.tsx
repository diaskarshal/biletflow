import { useState} from "react";
import {
    View,
    Text,
    TextInput,
    Button,
    StyleSheet,
} from "react-native";
import { registerUser } from "../api/auth";
import { t } from "../i18n";

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
            await registerUser({
                full_name: fullName,
                email,
                password,
            });

            setMessage(t("register.done"));
        } catch (error) {
            if (error instanceof Error) {
                setMessage(error.message);
            } else {
                setMessage(t("common.error"));
            }
        } finally {
            setLoading(false);
        }
    }

    return(
        <View style = {styles.container}>
            <Text style = {styles.title}>{t("register.title")}</Text>

            <TextInput
                style = {styles.input}
                placeholder = {t("register.fullName")}
                value = {fullName}
                onChangeText = {setFullName}
            />

            <TextInput
                style = {styles.input}
                placeholder = {t("login.email")}
                value = {email}
                onChangeText = {setEmail}
                keyboardType = "email-address"
                autoCapitalize = "none"
            />

            <TextInput
                style = {styles.input}
                placeholder = {t("login.password")}
                value = {password}
                onChangeText = {setPassword}
                secureTextEntry
            />
            <Text style = {[styles.hint, password.length > 0 && password.length < 8 && styles.hintError]}>
                {t("register.passwordRule")}
            </Text>

            <Button
                title = {loading ? t("register.registering") : t("register.submit")}
                onPress = {handleRegister}
                disabled = {loading || password.length < 8}
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
    hint: {
        marginBottom: 12,
        color: "#555555",
    },
    hintError: {
        color: "#b00020",
    },
})