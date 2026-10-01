# SafeDrop: ESP32 Implementation Plan

The SafeDrop box runs on two supported boards. This document plans the **ESP32** variant: a 30-pin ESP32 DevKit (ESP32-WROOM-32 module, "WiFi + BT SoC" silk) running `firmware/SafeDrop_ESP32/SafeDrop_ESP32.ino` alongside the original UNO R4 WiFi sketch. Everything the driver or owner experiences is identical — only the board, its pins, and the ESP32-specific library calls change.

## 1. What stays the same

- **Protocol and server**: the device API (`/sync`, `/used`, `/attempt`, `/closed`, `/claim`), the `x-device-key` header, polling every ~3 s while idle, and the event queue with retry. The Next.js app, Firestore model, and simulator are untouched.
- **Behavior**: same state machine (`IDLE / KEYPAD / OPEN / LOCKOUT`), 6-digit one-time passcodes, the 4x4 keypad with `#` submitting and re-locking (1.5 s guard after unlocking), `*` clearing, 3 wrong entries → 30 s lockout.
- **Provisioning**: both paths work unchanged — hard-coded `secrets.h` for the prototype, and the production claim flow (hold `*` for 5 s at power-on → `SafeDrop-Setup` hotspot → `http://192.168.4.1` → claim code → no reflash).
- **Used-codeId memory**: the codeId ring buffer still survives reboots, and the claimed identity is persisted the same way — the storage backend just moves from real EEPROM to NVS flash (section 3d).

## 2. Board and pin map

Target: **30-pin ESP32 DevKit V1** (ESP32-WROOM-32). Every pin below is a "safe" GPIO on this board — none are strapping pins (0, 2, 5, 12, 15), flash pins (6–11), or input-only pins (34–39), so nothing interferes with boot.

| Function | GPIO | Notes |
|---|---|---|
| Keypad rows R1–R4 | 32, 33, 25, 26 | 4x4 HX-543; A–D ignored by firmware |
| Keypad cols C1–C4 | 27, 14, 13, 16 | |
| LCD I2C (0x27) | SDA 21, SCL 22 | Direct to GPIO 21/22, backpack at 5 V (see section 5) |
| Green LED | 18 | 100–150 Ω resistor |
| Red LED | 19 | 100–150 Ω resistor |
| Servo signal | 23 | `ESP32Servo`, 50 Hz, 500–2400 µs |
| Buzzer (optional) | 17 | `tone()` (LEDC-backed in the ESP32 core) |

Full wiring: `docs/SafeDrop_Wiring_Guide_3_ESP32.md`.

## 3. Firmware deltas from the UNO sketch

The sketch is a verbatim copy of `SafeDrop.ino`'s logic with these substitutions:

**a. Wi-Fi stack.** `WiFiS3.h` → `WiFi.h` + `WiFiClientSecure.h`; `WiFiSSLClient` → `WiFiClientSecure`. `ArduinoHttpClient` sits on top unchanged (`Client&` is board-agnostic).

**b. TLS certificate.** The UNO loads its root CA onto the Wi-Fi module with the Arduino IDE Firmware Updater. The ESP32 has no module-side certificate store, so the root CA is compiled in: `server_root_ca.h` embeds **ISRG Root X1** (Let's Encrypt — Vercel's default) and `setup()` calls `wifiClient.setCACert(ROOT_CA)`. A commented `ALLOW_INSECURE_TLS` define switches to `setInsecure()` for bench testing only — it must never ship enabled. If a host uses a different CA, swap the PEM.

**c. Access-point portal.** `WiFi.beginAP()` / `WL_AP_LISTENING` (WiFiS3 API) → `WiFi.mode(WIFI_AP)` + `WiFi.softAP(AP_SSID, AP_PASS)` (returns `bool`). `WiFiServer(80)`, `accept()`, and the whole portal flow are otherwise identical. `NVIC_SystemReset()` → `ESP.restart()`.

**d. Persistent storage.** The ESP32 has no real EEPROM; its built-in `EEPROM.h` emulates one over NVS flash. Two additions: `EEPROM.begin(1024)` in `setup()` (highest used address is 602), and an explicit flush — writes buffer in RAM until `EEPROM.commit()`. The sketch tracks a dirty flag in `eeUpdate()` and commits after each logical write batch (`writeClaimConfig`, `eepromAddCodeId`, `tryClaim`'s persist block, first-boot init in `eepromInit`). All address-based logic is untouched.

**e. Servo.** `Servo.h` → `ESP32Servo.h`; call `setPeriodHertz(50)` and then `attach(PIN_SERVO, 500, 2400)`. The locked/unlocked angle constants and `lockBolt()`/`unlockBolt()` are unchanged.

**f. Buzzer.** `tone()` exists in the ESP32 Arduino core (LEDC-backed). If an older core lacks it, replace `beep()` with a small LEDC helper — the only call site.

**g. I2C.** Explicit `Wire.begin(21, 22)` before `lcd.init()` (matches the ESP32 defaults; keeps the intent obvious).

## 4. Libraries and IDE setup

- Arduino IDE → Boards Manager: install **esp32 by Espressif Systems**; select **ESP32 Dev Module**.
- Library Manager: `ArduinoHttpClient`, `ArduinoJson` (v7), `Keypad`, `LiquidCrystal I2C`, `ESP32Servo`. `WiFi`, `WiFiClientSecure`, and `EEPROM` ship with the core.
- `secrets.h` from `secrets.h.example` — same five fields as the UNO sketch; each sketch folder keeps its own copy (gitignored).

## 5. Electrical notes (3.3 V logic)

- The ESP32 is a **3.3 V board and not 5 V tolerant**. The LCD connects directly to GPIO 21/22 with the backpack powered at 5 V — the common hobbyist shortcut and slightly out of spec for the ESP32. A 2-channel I2C level shifter, or a 3.3 V-native SSD1306 OLED instead of the LCD, removes the concern.
- LEDs are driven from 3.3 V: use 100–150 Ω (220 Ω works but is dim).
- The passive membrane keypad is fine at 3.3 V. The servo signal at 3.3 V is accepted by MG90S/MG996R.
- Power the board via USB or its VIN pin (5 V); the servo still runs on its own 5 V 3 A supply with the 1000 µF capacitor, **GND shared with the ESP32**.

## 6. Build and test phases

1. **Compile** both sketches (UNO R4 WiFi board and ESP32 Dev Module) — no errors.
2. **Bench, no Wi-Fi**: LCD "Hello", LED blink, keypad serial test, servo sweep — mirrors `SafeDrop_Wiring_Guide_2.md` §6.
3. **Bench, full sketch**: with `ALLOW_INSECURE_TLS` and fake secrets pointing at a local server, run the whole cycle (correct code → open → `#` → lock → `closed` event).
4. **TLS on**: remove `ALLOW_INSECURE_TLS`, verify `/sync` delivers a code against the deployed Vercel app with the embedded ISRG Root X1.
5. **Portal**: hold `*` at power-on → join `SafeDrop-Setup` → claim a box → reboots paired, no reflash.
6. **Enclosure**: same lock mechanism and mounting rules as the UNO build.

## 7. Test checklist (ESP32-specific additions)

Everything in `docs/plan.md` §11 applies. On top of that:

- The used-codeId ring buffer and claimed identity survive `ESP.restart()` (commit path works — check by rebooting right after a successful entry).
- TLS fails closed: with a CA that doesn't match the host, requests fail (no silent fallback).
- The `*`-hold setup portal works over `WiFi.softAP`, and the box reboots cleanly into normal mode after a save.
- No boot problems with the chosen GPIOs (nothing on strapping pins), and no brownout with the servo on its own supply.

## 8. Known risks

- `tone()` availability depends on the ESP32 core version (fallback: LEDC helper).
- The 5 V LCD backpack wired directly to the ESP32 is slightly out of spec — acceptable for bench use, but a level shifter or an SSD1306 OLED is the clean long-term fix.
- A reversed electrolytic capacitor or a missing common ground resets the board when the servo moves (brownout detector) — same mitigation as the UNO build: external supply, capacitor, shared GND.
