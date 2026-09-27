const API_URL = "http://192.168.0.136:8000"; //change to your WIFI ip

export async function apiRequest<T>(
    endpoint: string,
    options?: RequestInit
): Promise<T> {
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
    });
    
    const data = await response.json();

    if(!response.ok){
        console.log("API error status:", response.status);
        console.log("API error data:", data);

        throw new Error(
            typeof data?.detail === "string"
            ? data.detail
            : JSON.stringify(data)
        );
    }

    return data;
}
