# SafeDrop firmware

Arduino sketches for the SafeDrop parcel lock box. Two supported boards:

- **Arduino UNO R4 WiFi** — `SafeDrop/` (the original)
- **ESP32 DevKit (WROOM-32, 30 pins)** — `SafeDrop_ESP32/`

Both sketches implement the identical state machine and device API. The ESP32 implementation plan is `docs/ESP32_Plan.md`; wiring is in `docs/SafeDrop_Wiring_Guide_2.md` (UNO) and `docs/SafeDrop_Wiring_Guide_3_ESP32.md` (ESP32).

## Setup (UNO R4 WiFi)

1. Open `SafeDrop.ino` in the Arduino IDE.
2. Install the libraries (Library Manager):
   - ArduinoHttpClient
   - ArduinoJson (v7)
   - Keypad (by Mark Stanley, Alexander Brevig)
   - LiquidCrystal I2C (by Frank de Brabander)
   - Servo (built in)
3. Copy `secrets.h.example` to `secrets.h` and set `SERVER_HOST` to your deployed app. Choose a provisioning path (below), then select the board **Arduino UNO R4 WiFi** and upload.
4. Load the root CA certificate for your server host: **Tools → WiFi101/WiFiNINA Firmware Updater → Add certificate**. Without it, `WiFiSSLClient` connections will fail.

## Provisioning paths

### Production — dynamic (no reflashing)

1. In the app: **Settings → Pair a new box** → copy the **claim code** (valid 15 min).
2. Power the box and **hold the `*` key for 5 s**. It opens the `SafeDrop-Setup` Wi-Fi hotspot (password `safedrop123`).
3. Join that hotspot from your phone and open **http://192.168.4.1**.
4. Enter your home Wi-Fi name, password and the claim code → **Save and pair**.
5. The box stores the config in EEPROM, reboots, claims its device key from `POST /api/device/claim` and shows "Box paired!". It then behaves normally — no reflashing ever again.

To re-provision a box (new Wi-Fi or a new claim), hold the `*` key for 5 s at power-on.

### Prototype — hard-coded

Pair a box in the app and paste the **Box ID** and **device key** into `secrets.h` (they're shown once at pairing time). Flash the sketch. Optionally pre-fill `WIFI_SSID`/`WIFI_PASS` too. Use this when you just want the box running without the setup portal.

## ESP32 variant (`SafeDrop_ESP32/`)

Same behavior and provisioning (including the `*`-hold setup portal); the board-specific differences:

- **Board**: Tools → Board → **ESP32 Dev Module** (install **esp32 by Espressif Systems** in Boards Manager). Target: 30-pin DevKit, WROOM-32.
- **Libraries**: `WiFi`/`WiFiClientSecure`/`EEPROM` are built into the ESP32 core; install `ArduinoHttpClient`, `ArduinoJson` (v7), `Keypad`, `LiquidCrystal I2C`, and **`ESP32Servo`** (replaces `Servo`).
- **HTTPS certificate**: the ESP32 has no module-side certificate store, so the root CA is compiled in from `server_root_ca.h`. The default is ISRG Root X1 (Let's Encrypt — what Vercel serves); replace it if your host uses another CA. `ALLOW_INSECURE_TLS` (commented at the top of the sketch) disables the check for bench tests only — never ship it enabled.
- **Storage**: the used-codeId buffer and provisioning config live in NVS flash via the core's EEPROM emulation — writes buffer until an explicit `EEPROM.commit()` after each write batch.
- **Pin map**: all "safe" GPIOs (no strapping pins 0/2/5/12/15) — see the sketch header and `docs/SafeDrop_Wiring_Guide_3_ESP32.md`. The LCD connects directly to GPIO 21/22 with the backpack at 5 V (see the note in the guide — a level shifter or an SSD1306 OLED is the in-spec alternative).

## Wiring (UNO R4 WiFi)

| Item | Pins |
|---|---|
| Keypad rows (4x4 HX-543) | D9, D8, D7, D6 |
| Keypad columns | D5, D4, D3, D2 |
| LCD 16x2 I2C (0x27) | SDA (A4), SCL (A5), 5V, GND |
| Green LED | D10 → 220 Ω → GND |
| Red LED | D11 → 220 Ω → GND |
| Lock servo signal | D12 |
| Buzzer (optional) | A1 |
| Servo power | External 5 V supply, **GND shared with the Arduino** |

The keypad is a 4x4 membrane (HX-543, 8-pin ribbon). The firmware uses only `0`–`9`, `*` (clear) and `#` (enter / lock); the `A`, `B`, `C`, `D` keys are ignored. There is no confirm button — `#` both submits the code and locks the box.

Never power the servo from the Arduino's 5V pin — use the external supply with a 1000 µF capacitor across it.

## Behavior

- Polls `/api/device/sync` every 3 s while idle (paused for 5 s after any keypress so the keypad stays responsive), with the `x-device-key` header on every request.
- On a correct passcode: the used `codeId` is written to EEPROM (survives reboot), the code is wiped from RAM, the bolt unlocks and the green LED lights.
- The box stays unlocked while the driver leaves the parcel and takes the payment. When the driver closes the lid and presses `#` again (ignored for the first 1.5 s after unlocking), the box locks and reports `closed`.
- Reports (`used`, `wrong`, `closed`) are queued and retried until the server accepts them.
- Three wrong entries trigger a 30-second lockout with the red LED.
- Test without hardware using the `/simulator` page in the web app — it implements the same state machine against the same API.
