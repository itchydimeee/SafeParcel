# **SafeDrop Wiring Guide — ESP32** 

#### 30-pin ESP32 DevKit (WROOM-32) + breadboard | Keypad only, no confirm button 

This is the ESP32 version of the wiring guide. The UNO R4 WiFi guide lives in `docs/SafeDrop_Wiring_Guide_2.md`. The box behaves identically on both boards; only the pins, the voltage logic, and the LCD connection change. The firmware is `firmware/SafeDrop_ESP32/SafeDrop_ESP32.ino`; the implementation plan is `docs/ESP32_Plan.md`.

**What changes from the UNO guide:**

1. The board is a **30-pin ESP32 DevKit** (module silk reads ESP-32 / "WIFI + BT SoC"). All pins are named by GPIO number (GPIO 32 is labeled D32 or 32 on the board).
2. The ESP32 runs at **3.3 V** — LED resistors drop to **100–150 ohm**, and the LCD connects **directly** to GPIO 21/22 (no level shifter; see the note in Step 1).
3. The root CA certificate is **embedded in the sketch** (`server_root_ca.h`), not loaded onto a Wi-Fi module with the Firmware Updater.
4. Everything else — 4x4 keypad, `#` submits and locks, 6-digit code, LEDs, servo, external supply, `*`-hold setup portal — is the same as the UNO build.

**Safety rules:** Keep the board unplugged (no USB, no external supply) while wiring. Never power the servo from the ESP32's 5V/VIN pin. Always share GND between the ESP32 and the servo supply. Do not wire anything to GPIO 0, 2, 5, 12, or 15 (boot-strap pins) — the pin map below already avoids them.

## **1. How the box works** 

Identical to the UNO build (see `SafeDrop_Wiring_Guide_2.md` §1):

1. The LCD shows **"Enter Code"**. 
2. The driver types the **6-digit** code; each digit shows as *****. The ***** key clears the entry. 
3. The driver presses **#** as Enter. 
4. **Correct code:** green LED on, LCD says "Correct passcode" then "Press # to lock", the servo unlocks. The code is wiped so it cannot be reused. 
5. **Wrong code:** servo stays locked, red LED on, LCD says "Wrong passcode". Three wrong entries trigger a 30-second lockout. 
6. The driver places the package and takes the payment. 
7. The driver closes the lid and presses **#** again. The servo locks, the green LED turns off, and the LCD returns to "Enter Code" (presses within 1.5 s of unlocking are ignored). 

A, B, C and D do nothing. 

## **2. Parts checklist** 

|**Part**|**Quantity / notes**|
|---|---|
|ESP32 DevKit, 30 pins (WROOM-32)|1 — silk reads ESP-32, "WIFI + BT SoC"|
|Breadboard|1 full size|
|16x2 I2C LCD|Address 0x27|
|4x4 membrane keypad (HX-543)|8-pin ribbon; A to D keys are ignored by the firmware|
|Green LED and red LED|1 each|
|100–150 ohm resistors|2 (one per LED, 3.3 V logic)|
|Male-to-female jumper wires|At least 4 for the LEDs, plus more for the keypad|
|Passive buzzer|1 (optional)|
|Servo (MG996R or MG90S)|1|
|5V 3A power supply|Powers the servo only|
|1000 uF capacitor|1 (polarity matters)|
|Jumper wires, tape or heat shrink|Assorted|

The push button does not exist in this design. 

## **3. Master connection table** 

|**Part**|**Pin / wire**|**Connects to**|
|---|---|---|
|Rails|ESP32 VIN|Top red (+) rail (5 V from USB or a 5 V supply)|
|Rails|ESP32 GND|Top blue (-) rail|
|LCD|GND|Top blue rail|
|LCD|VCC|Top red rail (5 V — needed for contrast and backlight)|
|LCD|SDA|**GPIO 21**|
|LCD|SCL|**GPIO 22**|
|Green LED|Long leg (+)|100–150 ohm resistor, then **GPIO 18**|
|Green LED|Short leg (-)|GND rail|
|Red LED|Long leg (+)|100–150 ohm resistor, then **GPIO 19**|
|Red LED|Short leg (-)|GND rail|
|Keypad|R1, R2, R3, R4|**32, 33, 25, 26**|
|Keypad|C1, C2, C3, C4|**27, 14, 13, 16**|
|Buzzer|+|**GPIO 17**|
|Buzzer|-|GND rail|
|Servo|Signal (orange/yellow)|**GPIO 23**|
|Servo|Red|+ of the 5V 3A supply|
|Servo|Brown/black|- of the 5V 3A supply|
|Capacitor 1000 uF|Long leg|Supply +|
|Capacitor 1000 uF|Striped leg|Supply -|
|Common ground|Supply -|ESP32 GND (or top blue rail)|

Pins in use: **13, 14, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33**. No pin is used twice, and no boot-strap pin (0, 2, 5, 12, 15) is touched. 

## **4. Step-by-step wiring** 

### **Step 0: Power rails** 

1. Jumper from the ESP32 **VIN** pin to the breadboard **top red (+) rail** (VIN is 5 V when the board is USB-powered). 
2. Jumper from **GND** to the **top blue (-) rail**. 
3. The ESP32's **3V3** pin stays free (nothing in this build needs it). Never power the servo from 3V3, 5V/VIN, or the red rail. 

### **Step 1: LCD (I2C, address 0x27)** 

1. LCD **GND** to the top blue rail. 
2. LCD **VCC** to the top red rail (5 V — the contrast and backlight need it). 
3. LCD **SDA** to **GPIO 21**. 
4. LCD **SCL** to **GPIO 22**. 

**Test:** Plug in USB and upload the sketch (or a LiquidCrystal_I2C "Hello" sketch). If the screen is lit but blank, turn the contrast screw on the back of the I2C backpack. 

**Note:** this wires the ESP32's I2C pins straight to a 5 V-powered backpack, which is slightly out of spec for the ESP32 (its pins are not 5 V tolerant). It is the common hobbyist shortcut and typically works. A 2-channel I2C level shifter — or a 3.3 V-native SSD1306 OLED instead of this LCD — removes the concern entirely. 

### **Step 2: LEDs** 

Same construction as the UNO guide (long leg = +, short leg = -, resistor in series), but with **100–150 ohm** resistors because the GPIO outputs 3.3 V: 

- **Green LED:** resistor from **GPIO 18** to the long leg, short leg to the GND rail. 
- **Red LED:** resistor from **GPIO 19** to the long leg, short leg to the GND rail. 

**Test:** upload a blink sketch on 18 and 19. If an LED stays dark, swap its two connectors — that will not damage it. Fit them in panel-mount holders from inside the box like in the UNO guide. 

### **Step 3: 4x4 keypad (HX-543, all 8 pins)** 

Hold the keypad face-up with the ribbon at the bottom. Reading the pins **left to right**: R1, R2, R3, R4, C1, C2, C3, C4. 

|**Keypad pin (left to right)**|**Function**|**ESP32**|
|---|---|---|
|1st|R1 (keys 1 2 3 A)|GPIO 32|
|2nd|R2 (keys 4 5 6 B)|GPIO 33|
|3rd|R3 (keys 7 8 9 C)|GPIO 25|
|4th|R4 (keys * 0 # D)|GPIO 26|
|5th|C1|GPIO 27|
|6th|C2|GPIO 14|
|7th|C3|GPIO 13|
|8th|C4|GPIO 16|

Use female-to-male jumpers from the keypad header to the board pins. 

**Test:** the sketch prints keypad keys to Serial. Press every key. 

- Pressing 1 prints **D**: the connector order is reversed — flip the wiring order. 
- Pressing 1 prints **4** or **A**: rows and columns are swapped. 
- Some HX-543 units differ from the photo, so this test is the real check. 

The firmware uses only 0 to 9, ***** (clear) and **#** (enter / lock). A, B, C and D are ignored. 

### **Step 4: Buzzer (optional)** 

1. Buzzer **+** to **GPIO 17**. 
2. Buzzer **-** to the **GND rail**. 

### **Step 5: Servo and external power** 

1. Servo **signal** wire (orange or yellow) to **GPIO 23** (3.3 V signal is fine for MG90S/MG996R). 
2. Servo **red** wire to the **+ output of the 5V 3A supply**. 
3. Servo **brown or black** wire to the **- output of the supply**. 
4. Place the **1000 uF capacitor** across the supply's + and - lines, close to the servo. **Long leg to +**, **striped side to -**. A reversed electrolytic capacitor can fail or pop. 
5. **Common ground:** jumper from the **supply's -** to the **ESP32 GND** (or the top blue rail). 
6. **Never** connect the supply's + or the servo's red wire to the ESP32. 

**Test:** upload the Servo "Sweep" example (ESP32Servo version). Plug in the ESP32 USB first, then switch on the servo supply. If the board resets or the servo jitters, check the common ground and the capacitor direction — the ESP32's brownout detector resets the board when the supply sags. 

### **Step 6: Final check** 

- All grounds are joined: ESP32 GND, top blue rail, LED short legs, buzzer and the supply's -. 
- The servo is powered only by the external supply. 
- No pin is used twice; nothing is on GPIO 0, 2, 5, 12 or 15. 
- LED connectors cannot short against each other. 
- Only the LEDs, LCD and keypad are reachable from outside. The servo, lock and wiring stay inside the box. 

## **5. Firmware** 

Sketch: `firmware/SafeDrop_ESP32/SafeDrop_ESP32.ino` — same state machine and behavior as the UNO sketch. 

**IDE setup:** 

1. Boards Manager → install **esp32 by Espressif Systems** → select **ESP32 Dev Module**. 
2. Library Manager → `ArduinoHttpClient`, `ArduinoJson` (v7), `Keypad`, `LiquidCrystal I2C`, `ESP32Servo`. 
3. Copy `secrets.h.example` to `secrets.h` and fill in your values. 

**HTTPS certificate:** the UNO variant loads its CA onto the Wi-Fi module with the Firmware Updater. The ESP32 cannot do that — the root CA is compiled in from `server_root_ca.h`. The default is **ISRG Root X1** (Let's Encrypt, what Vercel serves). If your server uses a different CA, replace the PEM in that file. For a quick bench test without the matching CA you can uncomment `ALLOW_INSECURE_TLS` at the top of the sketch — this turns certificate checking off entirely and must never stay enabled on a real box. 

**Bench sketch (fake code, no Wi-Fi yet):** use the same bench-test sketch from `SafeDrop_Wiring_Guide_2.md` §5, changing only the pin numbers to the table in §3 of this guide and using `ESP32Servo` instead of `Servo`. 

## **6. Recommended test order** 

1. LCD "Hello" 
2. LEDs blinking on GPIO 18 and 19 
3. Keypad printing to Serial 
4. Servo sweep with the external supply 
5. Full bench sketch above with the fake code 123456 (no Wi-Fi yet) 
6. Whole cycle over Wi-Fi with `ALLOW_INSECURE_TLS` on and fake secrets pointing at a local server: correct code → open → `#` → lock → `closed` event 
7. Real server with the embedded CA: remove `ALLOW_INSECURE_TLS`, verify /sync delivers a code and the used/attempt/closed events appear in the app 
8. Hold `*` at power-on → `SafeDrop-Setup` hotspot → pair with a claim code 

## **7. Test checklist** 

Same as `SafeDrop_Wiring_Guide_2.md` §7, plus: 

- The correct 6-digit code opens the servo and turns on the green LED. 
- Pressing # while unlocked locks the box; # with fewer than 6 digits never opens it. 
- A, B, C and D do nothing. 
- The same code fails a second time; three wrong codes trigger the 30-second lockout. 
- A reboot right after a successful entry does not bring the used code back (NVS commit works). 
- HTTPS to the deployed server validates against the embedded CA (fails closed if it does not match). 
- The `*`-hold setup portal pairs the box without a reflash. 
- The board does not brown out or reset when the servo moves. 

## **8. Troubleshooting** 

|**Symptom**|**Likely cause and fix**|
|---|---|
|Board reboots when the servo moves|Missing common ground, capacitor reversed, or servo powered from the board. Check §5.|
|Board never boots / boot loop|Something wired to a strapping pin (0, 2, 5, 12, 15) or a short on the 3V3 rail. Check the pin map.|
|LCD is lit but blank|Turn the contrast screw. Check address 0x27 and that SDA/SCL are on GPIO 21/22.|
|HTTPS always fails|Wrong or corrupt CA in `server_root_ca.h`, or `ALLOW_INSECURE_TLS` accidentally left in while pointing at a different host. Replace the CA with your host's root certificate.|
|LED does not light|Long and short legs reversed. Swap the two connectors.|
|Wrong keys print|Reversed or swapped keypad pin order. See the tests in Step 3.|
|Cannot upload / serial port missing|Install the CP210x or CH340 USB driver for your devkit, then select the right COM port.|
|Servo jitters|Same as UNO: external supply, capacitor close to the servo, common ground.|

## **9. Optional upgrade** 

Same as the UNO guide: with no lid sensor, the box locks whenever # is pressed, even if the lid is not fully closed. A small reed switch or micro-switch on the lid would let the firmware refuse to lock until the lid is shut. 
