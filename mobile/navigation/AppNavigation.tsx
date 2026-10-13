import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ConnectionErrorScreen from "../screens/ConnectionErrorScreen";
import EventsScreen from "../screens/EventsScreen";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import ScannerScreen from "../screens/ScannerScreen";
import { useSession } from "../session/SessionContext";

export type RootStackParamList = {
    Login: undefined;
    Register: undefined;
    Events: undefined;
    Scanner: { eventId: number; title: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
    const { status } = useSession();

    if (status === "loading") {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (status === "unreachable") {
        return <ConnectionErrorScreen />;
    }

    return (
        <NavigationContainer>
            {status === "signedIn" ? (
                <Stack.Navigator>
                    <Stack.Screen
                        name="Events"
                        component={EventsScreen}
                        options={{ title: "My events" }}
                    />
                    <Stack.Screen
                        name="Scanner"
                        component={ScannerScreen}
                        options={({ route }) => ({ title: route.params.title })}
                    />
                </Stack.Navigator>
            ) : (
                <Stack.Navigator initialRouteName="Login">
                    <Stack.Screen
                        name="Login"
                        component={LoginScreen}
                        options={{ title: "Log In" }}
                    />
                    <Stack.Screen
                        name="Register"
                        component={RegisterScreen}
                        options={{ title: "Register" }}
                    />
                </Stack.Navigator>
            )}
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
});
