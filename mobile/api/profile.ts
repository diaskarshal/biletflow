import { apiRequest, saveTokens } from "./client";
import type { TokenPair} from "./client";
import type { User} from "./auth";

export type OrganizerProfile = {
    id: number;
    user_id: number;
    display_name: string;
    contact_email: string;
    phone: string | null;
    verification_status: string;
    verification_document: string | null;
    payout_account: string | null;
    created_at: string;
};

export type OrganizerProfileUpdate = {
    display_name: string;
    contact_email: string;
    phone: string;
    payout_account: string;
};

export async function updateAccountName(full_name: string): Promise<User> {
    return apiRequest<User>("/api/v1/me", {
        method: "PATCH",
        body: JSON.stringify({ full_name }),
    });
}

export async function resendVerificationEmail(): Promise<void> {
    await apiRequest<void>("/api/v1/me/verification-email", {
        method: "POST",
    });
}

export async function changePassword(
    current_password: string,
    new_password: string
): Promise<void> {
    const tokens = await apiRequest<TokenPair>("/api/v1/me/password", {
        method: "POST",
        body: JSON.stringify({
            current_password,
            new_password,
        }),
    });

    await saveTokens(tokens);
}

export async function getOrganizerProfile(): Promise<OrganizerProfile> {
    return apiRequest<OrganizerProfile>("/api/v1/organizer/profile");
}

export async function updateOrganizerProfile(
    data: OrganizerProfileUpdate
): Promise<OrganizerProfile> {
    return apiRequest<OrganizerProfile>("/api/v1/organizer/profile", {
        method: "PATCH",
        body: JSON.stringify(data),
    });
}