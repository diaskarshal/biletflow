import { useState} from "react";
import {
    View,
    Text,
    TextInput,
    Button,
    StyleSheet,
} from "react-native";
import { useNavigation} from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type {RootStackParamList} from "../navigation/AppNavigation";
import { useSession } from "../session/SessionContext";
import { requestPasswordReset } from "../api/auth";
import { LanguageSwitcher, t } from "../i18n";

type LoginNavigationProp = NativeStackNavigationProp<
    RootStackParamList,
    "Login"
>;

export default function LoginScreen(){
    const navigation = useNavigation<LoginNavigationProp>();
    const { signIn } = useSession();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleLogin(){
        setLoading(true);
        setMessage("");

        try{
            await signIn({ email, password });
        } catch (error){
            if (error instanceof Error){
                setMessage(error.message);
            } else {
                setMessage(t("common.error"));
            }
            setLoading(false);
        }
    }

    async function handleForgot() {
        if (!email.trim()) {
            setMessage(t("login.enterEmail"));
            return;
        }
        try {
            await requestPasswordReset(email.trim());
            setMessage(t("login.resetSent", { email: email.trim() }));
        } catch (error) {
            setMessage(error instanceof Error ? error.message : t("common.error"));
        }
    }

    return (
        <View style = {styles.container}>
            <LanguageSwitcher />
            <Text style = {styles.title}>{t("login.title")}</Text>

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

            <Button
                title = {loading ? t("login.loggingIn") : t("login.submit")}
                onPress = {handleLogin}
                disabled = {loading}
            />

            <Button
                title = {t("login.createAccount")}
                onPress ={() => navigation.navigate("Register")}
            />
            <Button title = {t("login.forgot")} onPress = {handleForgot} />

            {message !== "" && (
                <Text style = {styles.message}>{message}</Text>
            )}
        </View>
    );
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