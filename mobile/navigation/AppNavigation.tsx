import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import AttendeesScreen from "../screens/AttendeesScreen";
import ConnectionErrorScreen from "../screens/ConnectionErrorScreen";
import EventsScreen from "../screens/EventsScreen";
import EventDetailsScreen from "../screens/EventDetailsScreen";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import ScannerScreen from "../screens/ScannerScreen";
import MainTabNavigator from "./MainTabNavigator";
import TicketDetailsScreen from "../screens/TicketDetailsScreen";
import NewSupportCaseScreen from "../screens/NewSupportCaseScreen";
import PaymentScreen from "../screens/PaymentScreen";
import { SupportCaseScreen } from "../screens/SupportScreens";
import { ManageEventScreen, NewEventScreen } from "../screens/OrganizerScreens";

import type {OrderTicket, OrderEvent} from "../api/orders";
import { useSession } from "../session/SessionContext";
import { t } from "../i18n";

export type RootStackParamList = {
    Login: undefined;
    Register: undefined;
    MainTabs: undefined;
    Events: undefined;
    EventDetails: {slug : string};
    Scanner: { eventId: number; title: string };
    Attendees: { eventId: number };
    TicketDetails: {ticket: OrderTicket; event: OrderEvent};
    NewSupportCase: { ticketId?: number; eventId?: number; orderId?: number };
    Payment: { paymentId: number };
    SupportCase: { caseId: number };
    NewEvent: undefined;
    ManageEvent: { eventId: number };
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
                <Stack.Navigator initialRouteName = "MainTabs"
                screenOptions = {{headerBackButtonDisplayMode: "minimal"}}>
                    <Stack.Screen
                        name = "MainTabs"
                        component = {MainTabNavigator}
                        options = {{ headerShown: false }}
                    />
                    <Stack.Screen
                        name="Events"
                        component={EventsScreen}
                        options={{ title: t("organizer.title") }}
                    />
                    <Stack.Screen
                        name = "EventDetails"
                        component = {EventDetailsScreen}
                        options = {{title: t("title.eventDetails")}}
                    />
                    <Stack.Screen
                        name="Scanner"
                        component={ScannerScreen}
                        options={({ route }) => ({ title: route.params.title })}
                    />
                    <Stack.Screen
                        name="Attendees"
                        component={AttendeesScreen}
                        options={{ title: t("manage.attendees") }}
                    />
                    <Stack.Screen
                        name = "TicketDetails"
                        component = {TicketDetailsScreen}
                        options = {{ title: t("title.ticket")}}
                    />
                    <Stack.Screen name="Payment" component={PaymentScreen} options={{ title: t("title.payment") }} />
                    <Stack.Screen name="SupportCase" component={SupportCaseScreen} options={{ title: t("title.supportCase") }} />
                    <Stack.Screen name="NewEvent" component={NewEventScreen} options={{ title: t("newEvent.title") }} />
                    <Stack.Screen name="ManageEvent" component={ManageEventScreen} options={{ title: t("title.manageEvent") }} />
                    <Stack.Screen
                        name = "NewSupportCase"
                        component = {NewSupportCaseScreen}
                        options = {{title : t("title.contactOrganizer")}}
                    />
                </Stack.Navigator>
            ) : (
                <Stack.Navigator initialRouteName="Login">
                    <Stack.Screen
                        name="Login"
                        component={LoginScreen}
                        options={{ title: t("title.login") }}
                    />
                    <Stack.Screen
                        name="Register"
                        component={RegisterScreen}
                        options={{ title: t("title.register") }}
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
