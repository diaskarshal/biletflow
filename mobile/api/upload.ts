import * as ImagePicker from "expo-image-picker";
import { apiRequest } from "./client";

export async function pickAndUpload<T>(endpoint: string, field: string): Promise<T | null> {
    const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (picked.canceled) return null;
    const asset = picked.assets[0];
    const form = new FormData();
    form.append(field, {
        uri: asset.uri,
        name: asset.fileName ?? "image.jpg",
        type: asset.mimeType ?? "image/jpeg",
    } as unknown as Blob);
    return apiRequest<T>(endpoint, { method: "POST", body: form });
}
