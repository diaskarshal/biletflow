# BiletFlow demo guide

How to present the project to the instructor: what to prepare, what to say, and what to click, in order. The full run takes about 20 minutes plus questions. Split the parts between team members, for example one person presents the web app, one the mobile app and one the backend and tests.

## 1. The day before

1. Pull the latest code and rebuild:
   ```bash
   cd infra
   docker compose up -d --build -V
   docker compose exec api uv run alembic upgrade head
   ```
2. Start from clean demo data (this deletes everything in the local database):
   ```bash
   docker compose down -v
   docker compose up -d
   docker compose exec api uv run alembic upgrade head
   docker compose exec api uv run python -m app.db.seed
   ```
3. Run the tests once so you know they are green:
   ```bash
   docker compose exec api uv run pytest
   docker compose exec web npm run test
   ```
4. Put one nice event photo (JPEG or PNG) on the desktop for the "create event" step.
5. Phone: install the latest Expo Go. Set `EXPO_PUBLIC_API_URL` in `mobile/.env` to the laptop's LAN IP, run `npx expo start`, open the app and log in as `alice@biletflow.kz`.
6. Decide where emails go. MailHog (the default) is the safe choice because it needs no internet. Real email (see the README) looks better but depends on the room's Wi-Fi.
7. Record a short screen video of the phone scanning a ticket. If the Wi-Fi fails during the demo, play the video instead.

## 2. Thirty minutes before

Use the phone's hotspot if the room Wi-Fi is unreliable: connect the laptop to it, update `EXPO_PUBLIC_API_URL` with the new LAN IP and restart Expo.

Open these windows and log in, so you never type passwords during the demo. All passwords are `password123`.

| Window | Account | Use |
|--------|---------|-----|
| Browser, normal window | alice@biletflow.kz | Organizer |
| Browser, private window | a new attendee you register live | Attendee |
| Second browser | admin@biletflow.kz | Platform admin |
| Tab | http://localhost:8025 | MailHog, all emails |
| Tab | http://localhost:8000/docs | API documentation |
| Phone | alice@biletflow.kz | Check-in app |

Set the browser zoom to 125% so the projector shows text clearly.

## 3. The presentation

### Introduction (1 minute)

Say: Organizers in Kazakhstan need a simple way to sell tickets in KZT, send QR tickets and check people in at the door. BiletFlow is a self-service platform for that, with four roles: attendee, organizer, door staff and platform admin.

### Architecture (2 minutes)

Show the API docs tab and explain:
- **Backend:** FastAPI (Python) with PostgreSQL, one module per feature (events, orders, payments, check-in, promos, support, analytics, admin).
- **Web app:** React and TypeScript. The API client is generated from the backend's OpenAPI schema, so the frontend and backend cannot drift apart.
- **Mobile check-in app:** Expo and React Native, using the phone camera.
- **Everything runs in Docker Compose** with one command. Emails go through SMTP, caught locally by MailHog.
- **Payments are simulated,** which the SRS allows. The payment page plays the role of the provider.

### Step 1: Organizer creates an event (3 minutes)

In Alice's window: Organizer, then "+ New event".
1. Fill in a title and description, upload the photo from the desktop, set the date and time.
2. Add two ticket types: a free one and a paid one (for example 3000 KZT).
3. Choose a refund policy and create the event.
4. Open the main page and show the new event with its photo.

Say: Events are published right away. The organizer dashboard groups them as upcoming, active, completed, cancelled and drafts.

### Step 2: Attendee registers and gets a free ticket (3 minutes)

In the private window:
1. Click Register. Type a short password and point out the live rule "At least 8 characters". Then use a proper password.
2. In MailHog, open the confirmation email and click the link.
3. Log in, open "Astana Startup Pitch Day" and register for the free ticket.
4. In MailHog, open the ticket email: the QR code is attached as an image and as a printable PDF.
5. Open My tickets, show the QR and click "Download PDF".

### Step 3: Paid sales activation (2 minutes)

In Alice's window, open "Student Tech Meetup" and scroll to Paid sales.

Say: Before an organizer can take money, they must pass a checklist: a paid ticket type, verified identity, a payout account, accepted terms and a one-time activation fee.

1. On Profile, fill in a payout account and save.
2. Back on the event, accept the terms and click "Pay activation fee".
3. On the payment page click Success. Paid sales are now active.

### Step 4: Promo code and paid checkout (3 minutes)

In Alice's window, open "Almaty Jazz Night" (paid sales are already active there) and scroll to Promo codes.
1. Create a 20% code. Click "QR image" and show it: dark red, marked "Not an entry ticket".
2. Copy the link and open it in the attendee window. A banner says the promo is applied.
3. Buy a Standard ticket. The checkout shows price, discount and total.
4. On the payment page click **Failure** first. Say: the seats are released and the buyer gets a "Payment failed" email. Show it in MailHog.
5. Buy again and click **Success**. The ticket arrives by email.

### Step 5: Check-in at the door (3 minutes)

This is the highlight, so take your time.
1. On the phone, open "Almaty Jazz Night". The top bar shows "Checked in 0 of N".
2. Scan the attendee's QR from the laptop screen (My tickets or the PDF). The screen turns green: VALID.
3. Scan the same QR again. Orange: ALREADY USED. Say: two phones scanning at the same moment cannot both admit the ticket, the database guarantees it.
4. Scan the promo QR from step 4. Grey: NOT A TICKET.
5. Show "Undo check-in", then the Search button: find the attendee by name and check them in by hand.

### Step 6: Refund (1 minute)

In Alice's window, open the event's Attendees list and refund an order. Show the "Refund completed" email and that the ticket is now refunded. Scanning it on the phone would now show REFUNDED.

### Step 7: Support chat (1 minute)

1. In the attendee window, open My tickets, click a ticket and then "Get help". Send a message.
2. In Alice's window, open Support, reply, click "Assign to me" and change the status.
3. Show the notification emails in MailHog.

### Step 8: Analytics and history (2 minutes)

In Alice's window, on "Almaty Jazz Night":
1. Open Analytics: tickets sold, revenue, discounts, refunds and net, sales over time, sales by ticket type, check-in rate and the promo campaign results. Change the ticket type filter.
2. Back on the event page, show the Activity section: every action with who and when (the refund, the check-in, the promo code).
3. Click Duplicate to show copying an event into a new draft.

### Step 9: Platform admin (3 minutes)

1. In the attendee window, open any event and use "Report this event".
2. In the admin browser, open Admin:
   - Reported events: click "Suspend event". Refresh the main page in the attendee window and the event is gone. Restore it with Search.
   - Search the attendee's email: users, orders and payments appear.
   - Payments: the failed payment from step 4 is listed.
   - Promo code activity, the activation fee setting, and "Download orders CSV".

### Step 10: Quality (1 minute)

Show the terminal and run `docker compose exec api uv run pytest`. Say: the backend tests cover every feature, from checkout races to admin moderation, on a separate test database. They run on every pull request in GitHub Actions, together with linting, type checks and web tests.

### Closing (1 minute)

Say what is done: every required MVP feature from the SRS, including simulated paid sales, QR and PDF tickets, the mobile check-in app, promo codes with Campaign QR, support chat, analytics, event history and admin moderation.

Say what is next: Kazakh and Russian translations, a real payment provider, and the bonus features (seat map, calendar export).

## 4. If something goes wrong

| Problem | What to do |
|---------|------------|
| Phone says "Cannot reach the server" | Check the phone and the laptop are on the same network and the IP in `mobile/.env` is current. Otherwise play the backup video. |
| An email does not show up | Refresh MailHog. With real email, check `docker compose logs api`. |
| The API stops responding | `docker compose restart api`, wait 10 seconds and refresh. |
| A page shows an old state | Refresh the browser. |

## 5. Questions to expect

- **How do you stop the same ticket being used twice?** Check-in is one API call that validates and records the entry together. A unique index in PostgreSQL rejects a second active check-in for the same ticket, even if two phones scan at the same moment.
- **How do you prevent overselling?** Seats are taken with a single conditional database update, and a database rule forbids sold plus held tickets exceeding capacity.
- **What happens if a buyer never pays?** Seats are held for 15 minutes. After that the order expires and the seats return to sale.
- **Why are payments simulated?** The SRS allows a sandbox for the academic MVP. All provider logic goes through one function that handles the provider's result, so a real provider would replace only the payment page and that callback.
- **How are passwords and sessions secured?** Passwords are hashed with bcrypt. Logins use short-lived access tokens and refresh tokens. Changing the password logs out every other session. Every endpoint checks the user's role and relationship to the event.
- **Can a promo QR be used as a ticket?** No. The scanner rejects anything that is not a ticket code before calling the server, and the server would reject it too.
- **How do you handle time zones?** Everything is stored in UTC and shown in the event's time zone (Almaty by default).
- **What is not done?** Kazakh and Russian translations, real payments and payouts, the seat map, calendar export and offline scanning.
