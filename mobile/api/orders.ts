import { apiRequest } from "./client";

export type OrderTicket = {
    id: number;
    order_item_id: number;
    ticket_type_id: number;
    attendee_name: string;
    attendee_email: string;
    qr_token: string;
    status: string;
    created_at: string;
};

export type OrderItem = {
    id: number;
    ticket_type_id: number;
    quantity: number;
    unit_price_kzt: number;
};

export type OrderEvent = {
    id: number;
    title: string;
    slug: string;
    starts_at: string;
    ends_at: string;
    display_timezone: string;
    venue_name: string | null;
    venue_address: string | null;
};

export type Order = {
    id: number;
    event_id: number;
    user_id: number;
    status: string;
    subtotal_kzt: number;
    discount_kzt: number;
    fee_kzt: number;
    total_kzt: number;
    created_at: string;
    expires_at: string | null;
    payment_id: number | null;
    event: OrderEvent;
    items: OrderItem[];
    tickets: OrderTicket[];
};

export type CreateOrderData = {
    event_id: number;
    items: {
        ticket_type_id: number;
        quantity: number;
        attendees: {
            name: string;
            email: string;
        }[];
    }[];
};

export async function createOrder(data: CreateOrderData): Promise<Order> {
    const idempotencyKey = `mobile-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;

    return apiRequest<Order>("/api/v1/orders", {
        method: "POST",
        headers: {"Idempotency-Key": idempotencyKey,},
        body: JSON.stringify(data),
    });
}

export async function getMyOrders(): Promise<Order[]> {
    return apiRequest<Order[]>("/api/v1/me/orders");
}