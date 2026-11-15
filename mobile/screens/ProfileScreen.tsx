
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
import { pickAndUpload } from "../api/upload";
import { LanguageSwitcher, t, tOptional } from "../i18n";

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
                err?.message ?? t("common.error")
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
            setError(t("profile.enterName"));
            return;
        }

        try {
            setSavingName(true);

            const updatedUser = await updateAccountName(fullName.trim());
            updateUser(updatedUser);

            setSuccess(t("profile.nameUpdated"));
        } catch (err: any) {
            setError(err?.message ?? t("common.error"));
        } finally {
            setSavingName(false);
        }
    }

    async function handleResendEmail() {
        clearMessages();

        try {
            setSendingEmail(true);
            await resendVerificationEmail();
            setSuccess(t("profile.linkSent"));
        } catch (err: any) {
            setError(err?.message ?? t("common.error"));
        } finally {
            setSendingEmail(false);
        }
    }

    async function handleChangePassword() {
        clearMessages();

        if (!currentPassword || !newPassword) {
            setError(t("profile.fillPasswords"));
            return;
        }

        if (newPassword.length < 8) {
            setError(t("register.passwordRule"));
            return;
        }

        try {
            setChangingPassword(true);

            await changePassword(currentPassword, newPassword);

            setCurrentPassword("");
            setNewPassword("");
            setSuccess(t("profile.passwordChanged"));
        } catch (err: any) {
            setError(err?.message ?? t("common.error"));
        } finally {
            setChangingPassword(false);
        }
    }

    async function handleSaveOrganizer() {
        clearMessages();

        if (!displayName.trim() || !contactEmail.trim()) {
            setError(t("org.required"));
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
            setSuccess(t("org.saved"));
        } catch (err: any) {
            setError(err?.message ?? t("common.error"));
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
            setError(err?.message ?? t("common.error"));
        } finally {
            setRefreshing(false);
        }
    } 

    async function handleUploadDocument() {
        setError("");
        setSuccess("");
        try {
            const updated = await pickAndUpload<OrganizerProfile>("/api/v1/organizer/verification", "document");
            if (updated) {
                setOrganizer(updated);
                setSuccess(t("profile.documentSent"));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t("common.error"));
        }
    }

    async function handleLogout() {
        try {
            setLoggingOut(true);
            clearMessages();
            await signOut();
        } catch {
            setError(t("common.error"));
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
                <Text style={styles.title}>{t("profile.title")}</Text>
                <Text style={styles.subtitle}>
                    {t("profile.subtitle")}
                </Text>
                <LanguageSwitcher />
            </View>

            <View style={styles.profileCard}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initial}</Text>
                </View>

                <View style={styles.userInfo}>
                    <Text style={styles.name}>
                        {user?.full_name || ""}
                    </Text>
                    <Text style={styles.email}>
                        {user?.email || t("profile.notProvided")}
                    </Text>
                </View>
            </View>

            <SectionTitle>{t("profile.personal")}</SectionTitle>

            <View style={styles.card}>
                <Field
                    label={t("profile.fullName")}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder={t("profile.namePlaceholder")}
                />

                <Text style={styles.label}>{t("profile.emailAddress")}</Text>
                <Text style={styles.readOnlyValue}>
                    {user?.email || t("profile.notProvided")}
                </Text>

                <ActionButton
                    title={t("profile.save")}
                    onPress={handleSaveName}
                    loading={savingName}
                />
            </View>

            <SectionTitle>{t("profile.emailVerification")}</SectionTitle>

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
                        {isEmailVerified ? t("profile.emailConfirmed") : t("profile.emailNotVerified")}
                    </Text>
                </View>

                {!isEmailVerified && (
                    <>
                        <Text style={styles.helpText}>
                            {t("profile.emailHint")}
                        </Text>

                        <ActionButton
                            title={t("profile.resend")}
                            onPress={handleResendEmail}
                            loading={sendingEmail}
                        />
                    </>
                )}
            </View>

            <SectionTitle>{t("profile.security")}</SectionTitle>

            <View style={styles.card}>
                <Field
                    label={t("profile.currentPassword")}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder={t("profile.currentPassword")}
                    secureTextEntry
                />

                <Field
                    label={t("profile.newPasswordLabel")}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder={t("profile.newPassword")}
                    secureTextEntry
                />

                <ActionButton
                    title={t("profile.changePassword")}
                    onPress={handleChangePassword}
                    loading={changingPassword}
                />
            </View>

            <SectionTitle>{t("org.title")}</SectionTitle>

            {loadingOrganizer ? (
                <View style={styles.card}>
                    <ActivityIndicator color="#2563eb" />
                    <Text style={styles.helpText}>
                        {t("org.loading")}
                    </Text>
                </View>
            ) : organizerError ? (
                <View style={styles.card}>
                    <Text style={styles.error}>{organizerError}</Text>
                    <ActionButton
                        title={t("common.tryAgain")}
                        onPress={loadOrganizerProfile}
                    />
                </View>
            ) : organizer ? (
                <View style={styles.card}>
                    <Text style={styles.helpText}>
                        {t("org.hint")}
                    </Text>

                    <Field
                        label={t("org.displayName")}
                        value={displayName}
                        onChangeText={setDisplayName}
                        placeholder={t("org.displayName")}
                    />

                    <Field
                        label={t("org.contactEmail")}
                        value={contactEmail}
                        onChangeText={setContactEmail}
                        placeholder={t("org.contactEmail")}
                        keyboardType="email-address"
                    />

                    <Field
                        label={t("org.phone")}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder={t("org.phone")}
                        keyboardType="phone-pad"
                    />

                    <Field
                        label={t("org.payout")}
                        value={payoutAccount}
                        onChangeText={setPayoutAccount}
                        placeholder={t("org.payout")}
                    />

                    <ActionButton
                        title={t("org.save")}
                        onPress={handleSaveOrganizer}
                        loading={savingOrganizer}
                    />

                    <View style={styles.separator} />

                    <Text style={styles.label}>{t("org.verification")}</Text>

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
                            {tOptional(`verification.${organizer.verification_status}`) ??
                                organizer.verification_status}
                        </Text>
                    </View>

                    <Text style={styles.helpText}>
                        {t("org.verificationHint")}
                    </Text>

                    {organizer.verification_document ? (
                        <Text style={styles.smallText}>
                            {t("org.documentSubmitted")}
                        </Text>
                    ) : null}

                    {organizer.verification_status !== "approved" && (
                        <ActionButton title={t("profile.uploadDocument")} onPress={handleUploadDocument} />
                    )}
                </View>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}

            <SectionTitle>{t("profile.session")}</SectionTitle>

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
                        <Text style={styles.logoutText}>{t("profile.logout")}</Text>
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
