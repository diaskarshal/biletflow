import { ScrollView, StyleSheet, Text, View, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { getAuthenticatedImageUrl } from "../api/client";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useEffect, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import { downloadAuthenticatedFile } from "../api/client";

type Props = NativeStackScreenProps<RootStackParamList, "TicketDetails">;

export default function TicketDetailsScreen({route, navigation}: Props) {
    const {ticket, event, orderStatus} = route.params;
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState("");
    const [qrImage, setQrImage] = useState<{
        uri: string;
        headers ?: Record<string, string>;
    } | null>(null);
    const [qrError, setQrError] = useState(false);

    useEffect(() => {
        let active = true;

        async function loadQr(){
            try {
                const image = await getAuthenticatedImageUrl(
                    `/api/v1/tickets/${ticket.id}/qr`
                );

                if (active) {
                    setQrImage(image);
                }
            } catch (error){
                console.error("QR IMAGE ERROR", error);

                if (active) {
                    setQrError(true);
                }
            }
        }

        void loadQr();

        return () => {
            active = false;
        };
    }, [ticket.id]);

    function formatDate(dateString: string) {
        return new Date (dateString).toLocaleDateString("ru-RU", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    }

    function formatTime(dateString: string, timezone: string) {
        return new Date(dateString).toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
            timeZone: timezone || "Asia/Almaty",
        });
    }

    
async function downloadPdf() {
    try {
        setDownloading(true);
        setDownloadError("");

        const directory =
            FileSystem.cacheDirectory ?? FileSystem.documentDirectory;

        if (!directory) {
            throw new Error("Could not access device storage.");
        }

        const fileUri = `${directory}ticket-${ticket.id}.pdf`;

        const uri = await downloadAuthenticatedFile(
            `/api/v1/tickets/${ticket.id}/pdf`,
            fileUri
        );

        const permissions =
            await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

        if (!permissions.granted) {
            return;
        }

        const destinationUri =
            await FileSystem.StorageAccessFramework.createFileAsync(
                permissions.directoryUri,
                `ticket-${ticket.id}.pdf`,
                "application/pdf"
            );

        const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
        });

        await FileSystem.writeAsStringAsync(destinationUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
        });

    } catch (error) {
        console.error("TICKET PDF ERROR:", error);

        setDownloadError(
            error instanceof Error
                ? error.message
                : "Could not save the ticket PDF."
        );
    } finally {
        setDownloading(false);
    }
}

    return (
        <ScrollView style = {styles.container} contentContainerStyle = {styles.content}>
            <View style = {styles.card}>
                <Text style = {styles.eventTitle}>{event.title}</Text>
                <Text style = {styles.eventDate}>{formatDate(event.starts_at)}</Text>
                <Text style = {styles.eventTIme}>
                    {formatTime(event.starts_at, event.display_timezone)}
                </Text>
                <View style = {styles.divider} />
                <View style = {styles.qrContainer}>
                    <Text style = {styles.qrTitle}>{ticket.attendee_name}</Text>
                    <View style={styles.qrBox}>
                        {qrImage && !qrError ? (
                            <Image
                                source={qrImage}
                                style={{ width: 240, height: 240 }}
                                contentFit="contain"
                            />
                        ) : qrError ? (
                            <Text>Could not load QR code.</Text>
                        ) : (
                            <ActivityIndicator size="large" />
                        )}
                    </View>
                    <Text style = {styles.qrHint}>
                        Show this code at the entrance.
                    </Text>
                </View>
                <Pressable style = {[styles.downloadButton, downloading && styles.disableButton,]} onPress = {downloadPdf} disabled = {downloading}>
                    {downloading ? (
                        <ActivityIndicator color = "#ffffff" />
                    ) : (
                        <Text style = {styles.downloadButtonText}>
                            Download PDF
                        </Text>
                    )}
                </Pressable>
                {downloadError ? (
                    <Text style = {styles.errorText}>{downloadError}</Text>
                ): null}

                <Pressable style = {styles.helpButton} onPress={() => navigation.navigate("NewSupportCase", { ticketId: ticket.id})}>
                    <Text stle = {styles.helpButtonText}>
                        Get help with this ticket
                    </Text>
                </Pressable>
            </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8fafc",
    },
    content: {
        padding: 16,
    },
    card: {
        backgroundColor: "#ffffff",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#e5e9f0",
        padding: 20,
    },
    eventDate: {
        fontSize: 15,
        color: "#475569",
        textAlign: "center",
        marginTop: 5,
    },
    divider: {
        height: 1,
        backgroundColor: "#e5e9f0",
        marginVertical: 22,
    },
    qrContainer: {
        alignItems: "center",
    },
    qrTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#172033",
        marginBottom: 20,
    },
    qrBox: {
        backgroundColor: "#ffffff",
        padding: 15,
        borderRadius: 12,
    },
    qrHint: {
        fontSize: 13,
        color: "#64748b",
        textAlign: "center",
        lineHeight: 20,
        marginTop: 18,
        paddingHorizontal: 10,
    },
    label: {
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 0.8,
        color: "#94a3b8",
        marginTop: 13,
    },
    value: {
        fontSize: 15,
        fontWeight: "600",
        color: "#334155",
        marginTop: 5,
    },
    downloadButton: {
        backgroundColor: "#2563eb",
        borderRadius: 12,
        padding: 16,
        alignItems: "center",
        marginTop: 25,
    },
    disableButton: {
        opacity: 0.6,
    },
    downloadButtonText: {
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "700",
    },
    errorText: {
        color: "#dc2626",
        fontSize: 13,
        textAlign: "center",
        marginTop: 12,
    },
    eventTitle: {
        fontSize: 22,
        fontWeight: "800",
        color: "#172033",
        textAlign: "center",
    },
    eventTIme: {
        fontSize: 15,
        color: "#475569",
        textAlign: "center",
        marginTop: 5,
    },
    helpButton: {
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#2563eb",
        borderRadius: 12,
        padding: 16,
        alignItems: "center",
        marginTop: 12,
    },
    
    helpButtonText: {
        color: "#2563eb",
        fontSize: 15,
        fontWeight: "700",
    },
});