import { useState} from "react";
import {
    View,
    Text,
    TextInput,
    Button,
    StyleSheet,
} from "react-native";
import {
    loginUser,
    getCurrentUser,
} from "../api/auth";
import * as SecureStore from "expo-secure-store";
import { useNavigation} from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type {RootStackParamList} from "../navigation/AppNavigation";

export default function LoginScreen(){
   type LoginNavigationProp = NativeStackNavigationProp<
    RootStackParamList,
    "Login"
    >;

    const navigation = useNavigation<LoginNavigationProp>();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleLogin(){
        setLoading(true);
        setMessage("");

        try{
            const tokens = await loginUser({
                email,
                password,
            });

            await SecureStore.setItemAsync(
                "access_token",
                tokens.access_token
            );

            await SecureStore.setItemAsync(
                "refresh_token",
                tokens.refresh_token
            );

            const savedAccessToken = await SecureStore.getItemAsync("access_token");
            const savedRefreshToken = await SecureStore.getItemAsync("refresh_token");

            console.log("Access token saved:", savedAccessToken != null);
            console.log("Refresh token saved:", savedRefreshToken != null);

            console.log("Login completed", tokens);

            const user = await getCurrentUser(tokens.access_token);

            console.log("Current user:", user);

            setMessage(`Welcome, ${user.full_name}!`);
        } catch (error){
            console.error("Login error:", error);

            if (error instanceof Error){
                setMessage(error.message);
            } else {
                setMessage ("Login failed");
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style = {styles.container}>
            <Text style = {styles.title}>Log in</Text>

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
                title = {loading ? "Logging in..." : "Log in"}
                onPress = {handleLogin}
                disabled = {loading}
            />

            <Button
                title = "Create an account"
                onPress ={() => navigation.navigate("Register")}
            />

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