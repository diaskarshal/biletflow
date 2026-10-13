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
            // On success the session switches to signedIn and this screen unmounts.
            await signIn({ email, password });
        } catch (error){
            if (error instanceof Error){
                setMessage(error.message);
            } else {
                setMessage ("Login failed");
            }
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