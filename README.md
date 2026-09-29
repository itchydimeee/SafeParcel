# SafeDrop

An automatic safe lock box for parcel delivery. The owner generates a one-time passcode in the app and shares it with the delivery driver; the driver enters it on the box keypad, leaves the parcel, takes the payment the owner left inside, closes the lid and presses the confirm button — the box locks itself again.

Built with Next.js (App Router) + Firebase, plus an Arduino UNO R4 WiFi firmware for the physical box. Mobile-first UI with a bottom tab bar.

## Project layout

```
app/            pages + API routes (dashboard, activity, settings, simulator, device/owner APIs)
components/     CodeCard, StatusChip, EventList, TabBar, AuthProvider
lib/            Firebase client/admin, auth verification, code generation
firmware/       Arduino sketch + secrets.h.example + wiring docs
docs/plan.md    full prototype plan
firestore.rules Firestore security rules
```

## Setup

1. **Create a Firebase project** at https://console.firebase.google.com:
   - Enable **Authentication** → Email/Password and Google providers.
   - Create a **Firestore** database.
   - Project settings → Your apps → **Web app**: copy the config values.
   - Project settings → Service accounts → **Generate new private key**.
2. **Configure environment**: copy `.env.example` to `.env.local` and fill in
   - `NEXT_PUBLIC_FIREBASE_*` (client SDK config), and
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (service account; keep the `\n` escapes on one line).
3. **Deploy the rules**: `firebase deploy --only firestore:rules` (or paste `firestore.rules` in the console).
4. **Run**:

```bash
npm install
npm run dev
```

Open http://localhost:3000 on your phone (or DevTools mobile view).

## First run

1. Sign up at `/login` (email/password or Google).
2. **Settings → Pair a new box** — copy the Box ID, device key and claim code (all shown once; the claim code is valid for 15 minutes).
3. Open `/simulator` and connect it either by **claiming with the claim code** (the production path — same endpoint real hardware uses) or by pasting the Box ID + device key (the prototype path).
4. Back on the dashboard, **Generate code** (1/6/24 h). The simulator's LCD should show it arriving within ~3 s.
5. Test the full cycle in the simulator: wrong codes → lockout, correct code → unlock (status flips to *Used*), confirm button → locked, Reboot → used code never returns.

## Pairing & provisioning

- **Prototype (hard-coded):** paste the Box ID + device key into `firmware/SafeDrop/secrets.h` and flash the sketch.
- **Production (dynamic):** leave `BOX_ID`/`DEVICE_KEY` empty in `secrets.h`, flash once, then per box: pair in the app → hold the box's confirm button 5 s at power-on → join its `SafeDrop-Setup` Wi-Fi → enter home Wi-Fi + claim code at `http://192.168.4.1`. The box claims its key from `POST /api/device/claim` and stores everything in EEPROM — no reflashing per box.

Multiple boxes per account and multiple accounts are supported out of the box (each box record stores its owner; the dashboard has a box selector).

## Hardware

See `firmware/README.md` for wiring, libraries, HTTPS certificate setup, and `secrets.h` configuration.

## Deploying

Deploy to Vercel and add the same environment variables there. Set the firmware's `SERVER_HOST` to your Vercel domain and load its root CA certificate onto the Arduino Wi-Fi module (Arduino IDE Firmware Updater).

## Test checklist

See `docs/plan.md` §11 — code arrival within ~3 s, one-time use, reboot protection, expiry, code replacement, lockout, offline tolerance, and owner isolation.
