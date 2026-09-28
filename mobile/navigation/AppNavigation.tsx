import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RootTagContext } from "../node_modules/react-native/types/index";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";

export type RootStackParamList = {
    Login: undefined;
    Register: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName = "Login">
                <Stack.Screen
                name = "Login"
                component = {LoginScreen}
                options = {{ title: "Log In"}}
                />

                <Stack.Screen
                name = "Register"
                component = {RegisterScreen}
                options = {{title: "Register"}}
                ></Stack.Screen>
            </Stack.Navigator>
        </NavigationContainer>
    );
}