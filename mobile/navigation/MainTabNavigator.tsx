import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
type TabParamList = {
    EventsTab: undefined;
    TicketsTab: undefined;
    OrganizerTab: undefined;
    SupportTab: undefined;
    ProfileTab: undefined;
};

import { useSafeAreaInsets} from "react-native-safe-area-context";

import {Ionicons} from "@expo/vector-icons";
import { t } from "../i18n";

import EventsTabScreen from "../screens/EventsTabScreen";
import ProfileScreen from "../screens/ProfileScreen";
import TicketsScreen from "../screens/TicketsScreen";
import { OrganizerHomeScreen } from "../screens/OrganizerScreens";
import { SupportScreen } from "../screens/SupportScreens";

const Tab = createBottomTabNavigator<TabParamList>();

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
                options = {{title: t("tab.events"), tabBarLabel: t("tab.events")}}
            />

            <Tab.Screen
                name = "TicketsTab"
                component = {TicketsScreen}
                options = {{
                    title: t("title.myTickets"),
                    tabBarLabel: t("tab.tickets"),
                }}
            />

            <Tab.Screen
                name = "OrganizerTab"
                component = {OrganizerHomeScreen}
                options = {{title: t("tab.organizer"), tabBarLabel: t("tab.organizer")}}
            />

            <Tab.Screen
                name = "SupportTab"
                component = {SupportScreen}
                options = {{title: t("tab.support"), tabBarLabel: t("tab.support")}}
            />

            <Tab.Screen
                name="ProfileTab"
                component = {ProfileScreen}
                options= {{title: t("tab.profile"), tabBarLabel: t("tab.profile")}}
            />
        </Tab.Navigator>
    );
}
