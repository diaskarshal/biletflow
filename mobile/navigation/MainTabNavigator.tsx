import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
    View,
    Text,
    Pressable,
    StyleSheet,
} from "react-native";
import { useNavigation} from "@react-navigation/native";
import { NativeStackNavigationProp} from "@react-navigation/native-stack";
import type { RootStackParamList } from "./AppNavigation";
type TabParamList = {
    EventsTab: undefined;
    TicketsTab: undefined;
    OrganizerTab: undefined;
    SupportTab: undefined;
    ProfileTab: undefined;
};

import { useSafeAreaInsets} from "react-native-safe-area-context";

import {Ionicons} from "@expo/vector-icons";

import EventsTabScreen from "../screens/EventsTabScreen";
import ProfileScreen from "../screens/ProfileScreen";
import TicketsScreen from "../screens/TicketsScreen";

const Tab = createBottomTabNavigator<TabParamList>();

function PlaceholderScreen({
    title,
    description,
} : {
    title: string;
    description: string;
}) {
    return (
        <View style = {styles.container}>
            <Text style = {styles.title}>{title}</Text>
            <Text style = {styles.description}>{description}</Text>
        </View>
    );
}

function TicketsTabScreen() {
    return <TicketsScreen />;
}

function OrganizerTabScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    return (
        <View style = {styles.container}>
            <Text style = {styles.title}>Organizer</Text>
            <Text style = {styles.description}>
                Create and manage events
            </Text>

            <Pressable
                style = {styles.button}
                onPress={() => navigation.navigate("Events")} 
        >       
                <Text style = {styles.buttonText}>
                 My events and check-in
                 </Text>
            </Pressable>
        </View>
    );
}

function SupportTabScreen() {
    return(
        <PlaceholderScreen
            title="Support"
            description="Get help with your account, events, and tickets"
        />
    );
}

function ProfileTabScreen() {
    return <ProfileScreen />;
}

export default function MainTabNavigator(){
    const insets = useSafeAreaInsets();
    return (
        <Tab.Navigator
            screenOptions={({route}) => ({
                headerTitleAlign: "center",
                tabBarActiveTintColor: "#2563eb",
                tabBarInactiveTintColor: "#777",
                tabBarHideOnKeyboard: true,
                tabBarIcon: ({ focused, color, size}) => {
                    let iconName: keyof typeof Ionicons.glyphMap

                    switch (route.name) {
                        case "EventsTab":
                            iconName = focused ? "calendar" : "calendar-outline";
                            break;
                        case "TicketsTab":
                            iconName = focused ? "ticket" : "ticket-outline";
                            break;
                        case "OrganizerTab":
                            iconName = focused ? "briefcase" : "briefcase-outline";
                            break;
                        case "SupportTab":
                            iconName = focused ? "help-circle" : "help-circle-outline";
                            break;
                        case "ProfileTab":
                            iconName = focused ? "person" : "person-outline";
                            break;
                        default:
                            iconName = "apps-outline";
                    }
                    return <Ionicons name = {iconName} size = {size} color = {color} />;
                },
                tabBarStyle: {
                    height: 60 + insets.bottom,
                    paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
                    paddingTop: 5,
                    backgroundColor: "#ffffff",
                    borderTopWidth: 1,
                    borderTopColor: "#dddddd",
                },
                tabBarLabelStyle: {
                fontSize: 11,
                fontWeight: "500",
                },
            })}
        >
            <Tab.Screen
                name = "EventsTab"
                component = {EventsTabScreen}
                options = {{title: "Events", tabBarLabel: "Events"}}
            />

            <Tab.Screen
                name = "TicketsTab"
                component = {TicketsTabScreen}
                options = {{
                    title: "My Tickets",
                    tabBarLabel: "Tickets",
                }}
            />

            <Tab.Screen
                name = "OrganizerTab"
                component = {OrganizerTabScreen}
                options = {{title: "Organizer", tabBarLabel: "Organizer"}}
            />

            <Tab.Screen
                name = "SupportTab"
                component = {SupportTabScreen}
                options = {{title: "Support", tabBarLabel: "Support"}}
            />

            <Tab.Screen
                name="ProfileTab"
                component = {ProfileTabScreen}
                options= {{title: "Profile", tabBarLabel: "Profile"}}
            />
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: "#fff",
    },

    title: {
        fontSize: 26,
        fontWeight: "bold",
        marginBottom: 12,
    },

    description: {
        fontSize: 15,
        color: "#666",
        textAlign: "center",
        marginBottom: 24,
    },

    button: {
        backgroundColor: "#2563eb",
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 10,
    },

    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
});