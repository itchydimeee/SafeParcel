# SafeDrop: Prototype Plan (Next.js + Firebase + Arduino)

An automatic safe lock box for parcel delivery. When the owner is not home, the owner generates a one-time passcode in the app and shares it with the delivery driver. The driver enters the passcode on the box keypad, leaves the parcel and takes the payment the owner left inside the box. After closing the lid, the driver presses a confirm button on the box and the box locks itself again.

## 1. How the Arduino "receives" requests: it asks, it isn't sent to

The box can't practically receive an incoming HTTPS request. It sits behind a home router with no public address, and running a TLS server on a microcontroller is fragile. So the box makes **outbound** HTTPS calls to the Next.js server on a short timer (polling). This works on any home Wi-Fi with no port forwarding, and a new code reaches the box within about 3 seconds.

```
Owner phone --> Next.js (Vercel) --> Firestore
                     ^
                     |  HTTPS every ~3 s (box asks, server answers)
                     v
                Arduino box
```

Later options for instant delivery are MQTT or long-polling, but polling is the simplest choice for a prototype.

## 2. Code lifecycle (owner-generated, one-time, expiring)

1. The owner taps **Generate code** and picks a validity period (1 h, 6 h or 24 h; default 24 h).
2. The server stores `{ codeId, code, status: active, expiresAt }`. Only one code is active per box, so a new code replaces any unused one.
3. The box syncs and receives `{ codeId, code, ttlSeconds }`. The box has no reliable clock, so it counts `ttlSeconds` down with `millis()`.
4. The driver types the code and presses `#`. On a match, the box **wipes the code from RAM and writes the used `codeId` to EEPROM**, then unlocks (green LED, servo).
5. The box reports `used` to the server and retries until it succeeds.
6. The box stays unlocked while the driver leaves the parcel and takes the payment. When the driver presses the confirm button, the box locks again and reports `closed` to the server.
7. At expiry the box clears the code, and the server marks it `expired`. Any later sync returns `none`.

The one-time rule is enforced in three places:

- The box deletes its local code on success, so a second entry has nothing to match.
- EEPROM remembers the used `codeId`, so a reboot before the report can't bring the code back. The box ignores that `codeId` even if the server still lists it as active.
- The server accepts `used` only once per `codeId` (repeat calls are safe).

Matching happens on the box, not on the server, so the driver still gets in if the Wi-Fi drops after sync.

## 3. Components

| Part | Notes |
|---|---|
| Arduino UNO R4 WiFi | Built-in Wi-Fi with HTTPS via `WiFiS3`. An ESP32 also works. |
| 3x4 membrane keypad | Driver enters the code |
| 16x2 I2C LCD (address 0x27) | Shows "Enter passcode", "Correct!" or "Incorrect!" |
| Red LED, green LED, 2x 220 ohm resistors | Wrong / correct indicators |
| Servo motor | MG996R or MG90S for the lock |
| Push button | Driver confirms the delivery is complete and the box locks again |
| Passive buzzer (optional) | Key beep and alarm |
| 5V 3A power supply | Powers the servo separately |
| 1000 uF capacitor | Across the servo supply to smooth spikes |
| Box, latch bolt and hinge | Lock servo drives the bolt |
| Breadboard and jumper wires | For prototyping |

## 4. Wiring

| Item | Pins |
|---|---|
| Keypad rows | D9, D8, D7, D6 |
| Keypad columns | D5, D4, D3 |
| LCD | SDA and SCL (A4, A5), 5V, GND |
| Green LED | D10 through 220 ohm to GND |
| Red LED | D11 through 220 ohm to GND |
| Lock servo signal | D12 |
| Confirm button | A0 (`INPUT_PULLUP`) to GND |
| Buzzer | A1 |
| Servo power | External 5V supply, **GND shared with the Arduino** |

Never power the servo from the Arduino's 5V pin.

## 5. Firmware plan

Libraries: `WiFiS3`, `ArduinoHttpClient`, `ArduinoJson`, `Keypad`, `LiquidCrystal_I2C`, `Servo`, `EEPROM`.

Files: `secrets.h` (Wi-Fi name and password, server host, `BOX_ID`, `DEVICE_KEY`) and one sketch, in `firmware/SafeDrop/`.

State machine:

- `IDLE`: poll `/sync` and show "Enter passcode".
- `KEYPAD`: driver is typing. `*` clears, `#` submits.
- `OPEN`: green LED, unlocked, code wiped. The LCD asks the driver to leave the parcel, take the payment and press the confirm button when done.
- `CONFIRM`: the driver presses the confirm button, so the lock engages and the box reports `closed`.
- `LOCKOUT`: after 3 wrong entries, red LED and a 30-second wait.

Behavior details:

- Poll `/sync` every 3 seconds, but only when no key has been pressed for about 5 seconds. An HTTPS call blocks for 1 to 2 seconds, and this keeps the keypad responsive.
- Keep a small event queue (`used`, `wrong`, `closed`) and flush it when Wi-Fi is up.
- Send the `x-device-key` header on every request.
- Certificates: HTTPS on the UNO R4 WiFi needs the root certificate for your host loaded onto its Wi-Fi module. Use the Arduino IDE Firmware Updater to add it. On an ESP32, use `WiFiClientSecure` with a CA certificate.

## 6. Server API contract

### Device routes (header `x-device-key`, rate limited)

| Route | Request | Response |
|---|---|---|
| `GET /api/device/sync?boxId=` | | `{ codeId, code, ttlSeconds }` or `{ none: true }`. Also updates `lastSeen` and lazy-expires past-due codes. |
| `POST /api/device/claim` | `{ claimCode }` | `{ boxId, deviceKey }` — one-time provisioning; no header needed (the box has no key yet). IP rate limited. |
| `POST /api/device/used` | `{ boxId, codeId }` | `{ ok: true }` (safe to repeat; marks the code used once) |
| `POST /api/device/attempt` | `{ boxId, result: "wrong" }` | `{ ok, lockedSeconds }` — `30` when three wrong entries trigger a lockout |
| `POST /api/device/closed` | `{ boxId }` | `{ ok }` — driver pressed the confirm button, box locked |

### Owner routes (Firebase ID token in `Authorization: Bearer`)

| Route | Purpose |
|---|---|
| `POST /api/boxes` | Pair a new box; returns its device key and a 15-minute claim code once |
| `PATCH /api/boxes/[id]` | Rename a box |
| `POST /api/boxes/[id]/code` | Generate a code with `{ validHours }`, replacing any active one |
| `DELETE /api/boxes/[id]/code` | Cancel the active code |

### Provisioning (two paths)

- **Production (dynamic):** pairing issues a hashed, 15-minute claim code. A fresh box opens a `SafeDrop-Setup` Wi-Fi hotspot (confirm button held 5 s at power-on), the owner enters home Wi-Fi + claim code at `http://192.168.4.1`, and the box calls `/api/device/claim` to receive its `boxId` + device key, storing them in EEPROM. No reflashing.
- **Prototype (hard-coded):** the device key returned at pairing time is pasted into `secrets.h` and the sketch is flashed.

## 7. Firestore data model

- `users/{uid}`: name, email, `boxIds[]`, `defaultValidity`
- `boxes/{boxId}`: `ownerUid`, `name`, `status` (`locked | open | lockout`), `codeStatus` (`none | active | used | expired`), `lastSeen`, `deviceKeyHash`, plus `pendingDeviceKey` / `claimCodeHash` / `claimExpiresAt` only while a claim is pending
- `boxes/{boxId}/private/code`: `codeId`, `code`, `createdAt`, `expiresAt`, `usedAt`, `syncedAt`
- `boxes/{boxId}/events/{id}`: `code_generated`, `code_synced`, `code_ok`, `code_wrong`, `lockout`, `opened`, `closed`, `code_expired`, each with a timestamp

Security rules: a user can read and write only their own `users/{uid}` doc; owners can read their own boxes, code and events but **clients can never write** to boxes. Only API routes write, through the Firebase Admin SDK.

A box counts as offline if `lastSeen` is older than about 15 seconds. Expiry is evaluated whenever the code is read or synced, so no scheduled job is needed.

## 8. Next.js app

Stack: App Router, TypeScript, Tailwind, `firebase` on the client, `firebase-admin` inside API routes, and Firestore `onSnapshot` so the phone updates live. The layout is mobile first with a bottom tab bar and thumb-sized buttons.

Screens:

- **/login**: email/password and Google sign-in.
- **/ (dashboard)**: Generate code button with a validity picker, the code in large type with copy/share, a countdown to expiry, a status chip (Waiting for box, Synced, Used, Expired) and an online/offline indicator.
- **/activity**: live event timeline.
- **/settings**: box name, pairing (device key + 15-minute claim code), default validity, sign out.
- **/simulator**: a virtual box (keypad, LCD, LEDs, servo, confirm button) that uses the same device API, so the full cycle can be tested, including the used-code failure, without hardware.

Project structure:

```
app/
  (auth)/login/page.tsx
  (app)/page.tsx              dashboard
  (app)/activity/page.tsx
  (app)/settings/page.tsx
  simulator/page.tsx
  api/device/{sync,used,attempt,closed}/route.ts
  api/boxes/route.ts
  api/boxes/[id]/route.ts     rename
  api/boxes/[id]/code/route.ts
lib/
  firebase-client.ts          auth + Firestore for the browser
  firebase-admin.ts           server only
  codes.ts                    generate, expire, mark used
  auth.ts                     verify ID token / device key
components/                   CodeCard, StatusChip, EventList, TabBar
firmware/SafeDrop/            Arduino sketch + secrets.h.example
firestore.rules
.env.local                    Firebase keys and admin credentials
```

## 9. Security

- HTTPS only. Device keys are stored hashed (scrypt), and each box has its own key.
- Three wrong codes trigger a 30-second lockout and an event alert to the owner.
- Device routes are rate limited.
- Mount the lock mechanism and wiring inside the box so they can't be reached from outside.
- A physical key override is a good backup for power or Wi-Fi failure.

## 10. Build phases

1. **Web foundation:** Firebase project, Next.js scaffold, auth, box pairing.
2. **Code logic:** generate with expiry, and the `/sync`, `/used`, `/attempt` and `/closed` routes.
3. **Live dashboard and activity feed.**
4. **Simulator:** prove the full cycle in the browser.
5. **Bench hardware:** wire the LCD, keypad and LEDs, and run the state machine with a fake code.
6. **Servo, confirm button and mechanism:** test the lock with the external supply.
7. **Connect the box to the deployed server:** load certificates, then run the end-to-end test.
8. **Polish:** rules, rate limits, offline handling, enclosure.

## 11. Test checklist

- A new code reaches the box within about 3 seconds.
- The correct code opens the box once, and entering it again fails.
- After a correct code the box stays unlocked until the driver presses the confirm button, then locks and reports `closed`.
- Rebooting the box right after a successful entry doesn't bring the code back.
- An expired code fails on the box and shows as `expired` in the app.
- Generating a new code replaces the old one.
- Three wrong codes trigger the lockout and an alert.
- If Wi-Fi drops after sync, the code still works once, and `used` is reported when the connection returns.
- One owner can't see another owner's box or code.
- A claim code works once, expires after 15 minutes, and a claimed box can't be claimed again.

## 12. Later upgrades

- Push notifications with Firebase Cloud Messaging.
- Multiple boxes per owner.
- A camera photo of each delivery.
- Instant sync with MQTT instead of polling.
