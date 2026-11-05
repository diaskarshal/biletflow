
import { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ScrollView,
    ActivityIndicator,
    TextInput,
    RefreshControl,
} from "react-native";
import { getCurrentUser} from "../api/auth";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "../session/SessionContext";
import {
    changePassword,
    getOrganizerProfile,
    resendVerificationEmail,
    updateAccountName,
    updateOrganizerProfile,
} from "../api/profile";
import type { OrganizerProfile } from "../api/profile";

function Field({
    label,
    value,
    onChangeText,
    placeholder,
    secureTextEntry = false,
    keyboardType = "default",
}: {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    placeholder?: string;
    secureTextEntry?: boolean;
    keyboardType?: "default" | "email-address" | "phone-pad";
}) {
    return (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#94a3b8"
                secureTextEntry={secureTextEntry}
                keyboardType={keyboardType}
                autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
            />
        </View>
    );
}

function ActionButton({
    title,
    onPress,
    loading = false,
}: {
    title: string;
    onPress: () => void;
    loading?: boolean;
}) {
    return (
        <Pressable
            style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.pressed,
                loading && styles.disabled,
            ]}
            onPress={onPress}
            disabled={loading}
        >
            {loading ? (
                <ActivityIndicator color="#ffffff" />
            ) : (
                <Text style={styles.actionButtonText}>{title}</Text>
            )}
        </Pressable>
    );
}

function SectionTitle({ children }: { children: string }) {
    return <Text style={styles.sectionTitle}>{children}</Text>;
}

const verificationLabels: Record<string, string> = {
    none: "Not submitted",
    pending: "Waiting for admin review",
    approved: "Approved",
    rejected: "Rejected",
};

export default function ProfileScreen() {
    const { user, signOut, updateUser } = useSession();
    const [refreshing, setRefreshing] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [fullName, setFullName] = useState(user?.full_name ?? "");
    const [savingName, setSavingName] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [changingPassword, setChangingPassword] = useState(false);
    const [organizer, setOrganizer] = useState<OrganizerProfile | null>(null);
    const [loadingOrganizer, setLoadingOrganizer] = useState(true);
    const [organizerError, setOrganizerError] = useState("");
    const [savingOrganizer, setSavingOrganizer] = useState(false);
    const [displayName, setDisplayName] = useState("");
    const [contactEmail, setContactEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [payoutAccount, setPayoutAccount] = useState("");

    useEffect(() => {
        loadOrganizerProfile();
    }, []);

    async function loadOrganizerProfile() {
        try {
            setLoadingOrganizer(true);
            setOrganizerError("");

            const profile = await getOrganizerProfile();

            setOrganizer(profile);
            setDisplayName(profile.display_name);
            setContactEmail(profile.contact_email);
            setPhone(profile.phone ?? "");
            setPayoutAccount(profile.payout_account ?? "");
        } catch (err: any) {
            setOrganizerError(
                err?.message ?? "Could not load organizer profile."
            );
        } finally {
            setLoadingOrganizer(false);
        }
    }

    function clearMessages() {
        setError("");
        setSuccess("");
    }

    async function handleSaveName() {
        clearMessages();

        if (!fullName.trim()) {
            setError("Please enter your name.");
            return;
        }

        try {
            setSavingName(true);

            const updatedUser = await updateAccountName(fullName.trim());
            updateUser(updatedUser);

            setSuccess("Your name has been updated.");
        } catch (err: any) {
            setError(err?.message ?? "Could not update your name.");
        } finally {
            setSavingName(false);
        }
    }

    async function handleResendEmail() {
        clearMessages();

        try {
            setSendingEmail(true);
            await resendVerificationEmail();
            setSuccess("Verification email sent. Check your inbox.");
        } catch (err: any) {
            setError(err?.message ?? "Could not send verification email.");
        } finally {
            setSendingEmail(false);
        }
    }

    async function handleChangePassword() {
        clearMessages();

        if (!currentPassword || !newPassword) {
            setError("Please fill in both password fields.");
            return;
        }

        if (newPassword.length < 8) {
            setError("Your new password must contain at least 8 characters.");
            return;
        }

        try {
            setChangingPassword(true);

            await changePassword(currentPassword, newPassword);

            setCurrentPassword("");
            setNewPassword("");
            setSuccess("Your password has been changed.");
        } catch (err: any) {
            setError(err?.message ?? "Could not change your password.");
        } finally {
            setChangingPassword(false);
        }
    }

    async function handleSaveOrganizer() {
        clearMessages();

        if (!displayName.trim() || !contactEmail.trim()) {
            setError("Organizer name and contact email are required.");
            return;
        }

        try {
            setSavingOrganizer(true);

            const updated = await updateOrganizerProfile({
                display_name: displayName.trim(),
                contact_email: contactEmail.trim(),
                phone: phone.trim(),
                payout_account: payoutAccount.trim(),
            });

            setOrganizer(updated);
            setSuccess("Organizer profile updated.");
        } catch (err: any) {
            setError(err?.message ?? "Could not update organizer profile.");
        } finally {
            setSavingOrganizer(false);
        }
    }

    async function handleRefresh() {
        try {
            setRefreshing(true);
            clearMessages();

            const updatedUser = await getCurrentUser();
            updateUser(updatedUser);

            await loadOrganizerProfile();
        } catch (err: any) {
            setError(err?.message ?? "Could not refreshe the page");
        } finally {
            setRefreshing(false);
        }
    } 

    async function handleLogout() {
        try {
            setLoggingOut(true);
            clearMessages();
            await signOut();
        } catch {
            setError("Could not log out. Please try again.");
        } finally {
            setLoggingOut(false);
        }
    }

    const initial =
        user?.full_name?.trim()?.charAt(0)?.toUpperCase() || "?";

    const isEmailVerified = Boolean(user?.email_verified_at);

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            refreshControl = {
                <RefreshControl
                    refreshing = {refreshing}
                    onRefresh = {handleRefresh}
                    colors = {["#2563eb"]}
                    tintColor = "#2563eb"
                />
            }
        >
            <View style={styles.heading}>
                <Text style={styles.title}>My Profile</Text>
                <Text style={styles.subtitle}>
                    Manage your BiletFlow account
                </Text>
            </View>

            <View style={styles.profileCard}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initial}</Text>
                </View>

                <View style={styles.userInfo}>
                    <Text style={styles.name}>
                        {user?.full_name || "User"}
                    </Text>
                    <Text style={styles.email}>
                        {user?.email || "No email available"}
                    </Text>
                </View>
            </View>

            <SectionTitle>Personal information</SectionTitle>

            <View style={styles.card}>
                <Field
                    label="Full name"
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Your full name"
                />

                <Text style={styles.label}>Email address</Text>
                <Text style={styles.readOnlyValue}>
                    {user?.email || "Not provided"}
                </Text>

                <ActionButton
                    title="Save changes"
                    onPress={handleSaveName}
                    loading={savingName}
                />
            </View>

            <SectionTitle>Email verification</SectionTitle>

            <View style={styles.card}>
                <View style={styles.statusRow}>
                    <Ionicons
                        name={isEmailVerified ? "checkmark-circle" : "alert-circle"}
                        size={23}
                        color={isEmailVerified ? "#16a34a" : "#d97706"}
                    />
                    <Text
                        style={[
                            styles.statusText,
                            { color: isEmailVerified ? "#16a34a" : "#d97706" },
                        ]}
                    >
                        {isEmailVerified ? "Email confirmed" : "Email not verified"}
                    </Text>
                </View>

                {!isEmailVerified && (
                    <>
                        <Text style={styles.helpText}>
                            Your email address is not confirmed yet. Check your inbox for the confirmation link.
                        </Text>

                        <ActionButton
                            title="Send the link again"
                            onPress={handleResendEmail}
                            loading={sendingEmail}
                        />
                    </>
                )}
            </View>

            <SectionTitle>Security</SectionTitle>

            <View style={styles.card}>
                <Field
                    label="Current password"
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter current password"
                    secureTextEntry
                />

                <Field
                    label="New password (at least 8 characters)"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password"
                    secureTextEntry
                />

                <ActionButton
                    title="Change password"
                    onPress={handleChangePassword}
                    loading={changingPassword}
                />
            </View>

            <SectionTitle>Organizer profile</SectionTitle>

            {loadingOrganizer ? (
                <View style={styles.card}>
                    <ActivityIndicator color="#2563eb" />
                    <Text style={styles.helpText}>
                        Loading organizer profile...
                    </Text>
                </View>
            ) : organizerError ? (
                <View style={styles.card}>
                    <Text style={styles.error}>{organizerError}</Text>
                    <ActionButton
                        title="Try again"
                        onPress={loadOrganizerProfile}
                    />
                </View>
            ) : organizer ? (
                <View style={styles.card}>
                    <Text style={styles.helpText}>
                        These details are used for your organizer account.
                        They are separate from your personal account information.
                    </Text>

                    <Field
                        label="Organizer display name"
                        value={displayName}
                        onChangeText={setDisplayName}
                        placeholder="Organizer name"
                    />

                    <Field
                        label="Contact email"
                        value={contactEmail}
                        onChangeText={setContactEmail}
                        placeholder="Contact email"
                        keyboardType="email-address"
                    />

                    <Field
                        label="Phone number"
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="Phone number"
                        keyboardType="phone-pad"
                    />

                    <Field
                        label="Payout account (IBAN, test data only)"
                        value={payoutAccount}
                        onChangeText={setPayoutAccount}
                        placeholder="Payout account details"
                    />

                    <ActionButton
                        title="Save organizer profile"
                        onPress={handleSaveOrganizer}
                        loading={savingOrganizer}
                    />

                    <View style={styles.separator} />

                    <Text style={styles.label}>Identity verification</Text>

                    <View style={styles.statusRow}>
                        <Ionicons
                            name={
                                organizer.verification_status === "approved"
                                    ? "checkmark-circle"
                                    : "information-circle"
                            }
                            size={22}
                            color={
                                organizer.verification_status === "approved"
                                    ? "#16a34a"
                                    : "#64748b"
                            }
                        />
                        <Text style={styles.statusText}>
                            {verificationLabels[organizer.verification_status] ??
                                organizer.verification_status}
                        </Text>
                    </View>

                    <Text style={styles.helpText}>
                        Needed only to sell paid tickets. Upload any ID document; an admin reviews it.
                    </Text>

                    {organizer.verification_document ? (
                        <Text style={styles.smallText}>
                            A verification document has been submitted.
                        </Text>
                    ) : null}
                </View>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}

            <SectionTitle>Session</SectionTitle>

            <Pressable
                style={({ pressed }) => [
                    styles.logoutButton,
                    pressed && styles.pressed,
                    loggingOut && styles.disabled,
                ]}
                onPress={handleLogout}
                disabled={loggingOut}
            >
                {loggingOut ? (
                    <ActivityIndicator color="#dc2626" />
                ) : (
                    <>
                        <Ionicons
                            name="log-out-outline"
                            size={21}
                            color="#dc2626"
                        />
                        <Text style={styles.logoutText}>Log out</Text>
                    </>
                )}
            </Pressable>

            <Text style={styles.footer}>BiletFlow</Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8fafc",
    },
    content: {
        padding: 20,
        paddingBottom: 45,
    },
    heading: {
        marginBottom: 25,
    },
    title: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#172554",
    },
    subtitle: {
        fontSize: 15,
        color: "#64748b",
        marginTop: 5,
    },
    profileCard: {
        backgroundColor: "#ffffff",
        borderRadius: 16,
        padding: 20,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 28,
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },
    avatar: {
        width: 62,
        height: 62,
        borderRadius: 31,
        backgroundColor: "#dbeafe",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 16,
    },
    avatarText: {
        fontSize: 27,
        fontWeight: "bold",
        color: "#2563eb",
    },
    userInfo: {
        flex: 1,
    },
    name: {
        fontSize: 19,
        fontWeight: "bold",
        color: "#1e293b",
    },
    email: {
        fontSize: 14,
        color: "#64748b",
        marginTop: 5,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1e293b",
        marginBottom: 12,
        marginTop: 5,
    },
    card: {
        backgroundColor: "#ffffff",
        borderRadius: 16,
        padding: 16,
        marginBottom: 25,
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },
    field: {
        marginBottom: 15,
    },
    label: {
        fontSize: 13,
        color: "#64748b",
        marginBottom: 7,
        fontWeight: "500",
    },
    input: {
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 10,
        paddingHorizontal: 13,
        paddingVertical: 12,
        fontSize: 15,
        color: "#1e293b",
        backgroundColor: "#ffffff",
    },
    readOnlyValue: {
        fontSize: 15,
        color: "#1e293b",
        marginBottom: 17,
    },
    actionButton: {
        backgroundColor: "#2563eb",
        borderRadius: 10,
        paddingVertical: 13,
        paddingHorizontal: 16,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 5,
    },
    actionButtonText: {
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "600",
    },
    statusRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        marginBottom: 8,
    },
    statusText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#1e293b",
    },
    helpText: {
        fontSize: 13,
        color: "#64748b",
        lineHeight: 19,
        marginBottom: 13,
    },
    smallText: {
        fontSize: 13,
        color: "#64748b",
        marginTop: 10,
    },
    separator: {
        height: 1,
        backgroundColor: "#e2e8f0",
        marginVertical: 18,
    },
    logoutButton: {
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#fecaca",
        borderRadius: 14,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#dc2626",
    },
    pressed: {
        opacity: 0.7,
    },
    disabled: {
        opacity: 0.5,
    },
    error: {
        color: "#dc2626",
        marginBottom: 15,
        lineHeight: 20,
    },
    success: {
        color: "#16a34a",
        marginBottom: 15,
        lineHeight: 20,
    },
    footer: {
        textAlign: "center",
        color: "#94a3b8",
        marginTop: 35,
        fontSize: 13,
    },
});
