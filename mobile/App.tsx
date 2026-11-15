import { SafeAreaProvider } from "react-native-safe-area-context";
import AppNavigator from "./navigation/AppNavigation";
import { SessionProvider } from "./session/SessionContext";
import { useLang } from "./i18n";

export default function App() {
    const lang = useLang();
    return (
        <SafeAreaProvider>
            <SessionProvider>
                <AppNavigator key={lang} />
            </SessionProvider>
        </SafeAreaProvider>
    );
}
