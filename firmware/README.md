# SafeDrop firmware

Arduino sketch for the SafeDrop parcel lock box. Designed for the **Arduino UNO R4 WiFi** (an ESP32 also works with small changes).

## Setup

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
2. Power the box and **hold the confirm button for 5 s**. It opens the `SafeDrop-Setup` Wi-Fi hotspot (password `safedrop123`).
3. Join that hotspot from your phone and open **http://192.168.4.1**.
4. Enter your home Wi-Fi name, password and the claim code → **Save and pair**.
5. The box stores the config in EEPROM, reboots, claims its device key from `POST /api/device/claim` and shows "Box paired!". It then behaves normally — no reflashing ever again.

To re-provision a box (new Wi-Fi or a new claim), hold the confirm button for 5 s at power-on.

### Prototype — hard-coded

Pair a box in the app and paste the **Box ID** and **device key** into `secrets.h` (they're shown once at pairing time). Flash the sketch. Optionally pre-fill `WIFI_SSID`/`WIFI_PASS` too. Use this when you just want the box running without the setup portal.

## Wiring

| Item | Pins |
|---|---|
| Keypad rows | D9, D8, D7, D6 |
| Keypad columns | D5, D4, D3 |
| LCD 16x2 I2C (0x27) | SDA (A4), SCL (A5), 5V, GND |
| Green LED | D10 → 220 Ω → GND |
| Red LED | D11 → 220 Ω → GND |
| Lock servo signal | D12 |
| Confirm button | A0 (`INPUT_PULLUP`) → GND |
| Buzzer (optional) | A1 |
| Servo power | External 5 V supply, **GND shared with the Arduino** |

Never power the servo from the Arduino's 5V pin — use the external supply with a 1000 µF capacitor across it.

## Behavior

- Polls `/api/device/sync` every 3 s while idle (paused for 5 s after any keypress so the keypad stays responsive), with the `x-device-key` header on every request.
- On a correct passcode: the used `codeId` is written to EEPROM (survives reboot), the code is wiped from RAM, the bolt unlocks and the green LED lights.
- The box stays unlocked while the driver leaves the parcel and takes the payment. When the driver presses the confirm button (A0), the box locks and reports `closed`.
- Reports (`used`, `wrong`, `closed`) are queued and retried until the server accepts them.
- Three wrong entries trigger a 30-second lockout with the red LED.
- Test without hardware using the `/simulator` page in the web app — it implements the same state machine against the same API.
