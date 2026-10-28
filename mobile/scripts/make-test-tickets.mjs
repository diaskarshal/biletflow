// Dev helper: creates fresh test tickets in YOUR local database and saves their QR images,
// so the scanner screen can be tried without the web app.
//
// Usage (backend must be running, seed data loaded):
//   node scripts/make-test-tickets.mjs                      # uses http://localhost:8000
//   node scripts/make-test-tickets.mjs http://192.168.0.5:8000
//
// WARNING: this WRITES to the database it points at. It creates orders and tickets for the
// seeded organizer aru@biletflow.kz and checks one of them in. Use it on a dev database only.
//
// QR images are saved to scripts/test-qr/ (git-ignored). Each image holds a token that exists
// only in the database it was created in, so images cannot be shared between machines;
// every developer runs this script themselves.

import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const API = `${(process.argv[2] ?? "http://localhost:8000").replace(/\/$/, "")}/api/v1`;
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "test-qr");

// Seed account from backend/app/db/seed.py (dev only).
const ORGANIZER = { email: "aru@biletflow.kz", password: "password123" };

async function call(method, endpoint, { body, token, headers } = {}) {
    let response;
    try {
        response = await fetch(API + endpoint, {
            method,
            headers: {
                "Content-Type": "application/json",
                ...(token && { Authorization: `Bearer ${token}` }),
                ...headers,
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch {
        throw new Error(`Cannot reach ${API}. Is the backend running? (docker compose up -d)`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const isJson = (response.headers.get("content-type") ?? "").includes("json");
    return { status: response.status, data: isJson ? JSON.parse(buffer.toString()) : buffer };
}

function must(result, what) {
    if (result.status >= 400) {
        throw new Error(`${what} failed (HTTP ${result.status}): ${JSON.stringify(result.data)}`);
    }
    return result.data;
}

const { access_token: token } = must(
    await call("POST", "/auth/login", { body: ORGANIZER }),
    "Login as aru@biletflow.kz (did you run the seed command?)"
);

const events = must(await call("GET", "/organizer/events", { token }), "Listing events");
const event = events.find((e) => e.status === "published");
if (!event) throw new Error("Aru has no published event. Run: docker compose exec api uv run python -m app.db.seed");

const ticketTypes = must(await call("GET", `/events/${event.id}/ticket-types`), "Listing ticket types");
const freeType = ticketTypes.find((t) => t.price_kzt === 0);
if (!freeType) throw new Error(`Event "${event.title}" has no free ticket type.`);

console.log(`Event: #${event.id} "${event.title}" (ticket type: ${freeType.name})\n`);
await mkdir(OUT_DIR, { recursive: true });

async function createTicket(name, fileName) {
    const order = must(
        await call("POST", "/orders", {
            token,
            headers: { "Idempotency-Key": randomUUID() },
            body: {
                event_id: event.id,
                items: [
                    {
                        ticket_type_id: freeType.id,
                        quantity: 1,
                        attendees: [{ name, email: "test.guest@example.com" }],
                    },
                ],
            },
        }),
        `Creating order for ${name}`
    );
    const ticket = order.tickets[0];
    const png = must(await call("GET", `/tickets/${ticket.id}/qr`, { token }), "Downloading QR");
    await writeFile(path.join(OUT_DIR, fileName), png);
    return ticket;
}

const fresh = await createTicket("Test Fresh", "qr_fresh.png");
const used = await createTicket("Test Used", "qr_used.png");

must(
    await call("POST", "/checkin", { token, body: { qr_token: used.qr_token, event_id: event.id } }),
    "Checking in the 'used' ticket"
);

console.log(`Saved to ${OUT_DIR}\n`);
console.log("Open the images on your PC screen and scan them with the app");
console.log(`(log in as ${ORGANIZER.email}, open "${event.title}"):\n`);
console.log(`  qr_fresh.png  (ticket #${fresh.id})  -> green VALID, "Test Fresh"; scan again -> ALREADY USED`);
console.log(`  qr_used.png   (ticket #${used.id})  -> ALREADY USED`);
console.log("\nFor the promo-QR check, make any QR of an https:// link with an online QR generator");
console.log("-> NOT A TICKET (rejected on the phone, no server call).");
