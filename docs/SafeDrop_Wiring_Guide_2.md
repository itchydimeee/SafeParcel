# **SafeDrop Wiring Guide** 

#### Arduino UNO R4 WiFi + breadboard | Final revised version (keypad only, no confirm button) 

###### **What changed from the original plan file:** 

1. The keypad is a **4x4 HX-543** (8 pins). Column 4 uses **D2** . 

2. The **LEDs** sit outside the box and connect with **male-to-female jumper wires** . 

3. The **confirm button is removed** . The **#** key now submits the code and also locks the box. A0 is free. 

4. The code is a **6-digit** passcode, and the servo opens only on a correct code. 

**Safety rules:** Keep the Arduino unplugged (no USB, no external supply) while wiring. Never power the servo from the Arduino 5V pin. Always share GND between the Arduino and the servo supply. 

## **1. How the box works** 

1. The LCD shows **"Enter Code"** . 

2. The driver types the **6-digit** code from the owner. The LCD shows ***** for each digit typed. The ***** key clears the entry. 

3. The driver presses **#** (the key below 9) as Enter. 

4. **Correct code:** the green LED turns on, the LCD says "Correct passcode", and the servo unlocks. The code is wiped so it cannot be reused. 

5. **Wrong code:** the servo stays locked, the red LED turns on and the LCD says "Wrong passcode". Three wrong entries trigger a 30-second lockout. 

6. The driver places the package and takes the payment. The LCD says "Press # to lock". 

7. The driver closes the lid and presses **#** again. The servo locks, the green LED turns off, and the LCD returns to "Enter Code". 

##### **How # behaves** 

|**Box state**|**What # does**|
|---|---|
|Locked, 6 digits typed|Submits the code. The servo opens only if it matches the active code.|
|Locked, fewer than 6 digits or nothing<br>typed|Nothing opens. The LCD says "Enter 6 digits" and clears the entry.|
|Unlocked|Locks the box. It can never open anything. Ignored for the first 1.5 seconds<br>after unlocking.|
|Lockout (30 s)|Ignored. The keypad is disabled.|



## **2. Parts checklist** 

|**Part**|**Quantity / notes**|
|---|---|
|Arduino UNO R4 WiFi|1|
|Breadboard|1 full size|
|16x2 I2C LCD|Address 0x27|
|4x4 membrane keypad (HX-543)|8-pin ribbon; A to D keys are ignored by the firmware|
|Green LED and red LED|1 each|
|220 ohm resistors|2 (one per LED)|
|Male-to-female jumper wires|At least 4 for the LEDs, plus more for the keypad|



SafeDrop - Wiring Guide (final) 

Page 1 

|**Part**|**Quantity / notes**|
|---|---|
|Passive buzzer|1 (optional)|
|Servo (MG996R or MG90S)|1|
|5V 3A power supply|Powers the servo only|
|1000 uF capacitor|1 (polarity matters)|
|Jumper wires, tape or heat shrink|Assorted|



The push button from earlier versions is no longer needed. 

SafeDrop - Wiring Guide (final) 

Page 2 

## **3. Master connection table** 

|**Part**|**Pin / wire**|**Connects to**|
|---|---|---|
|Rails|Arduino 5V|Top red (+) rail|
|Rails|Arduino GND|Top blue (-) rail|
|LCD|GND|Top blue rail|
|LCD|VCC|Top red rail|
|LCD|SDA|A4|
|LCD|SCL|A5|
|Green LED|Long leg (+)|220 ohm resistor, then D10|
|Green LED|Short leg (-)|GND rail|
|Red LED|Long leg (+)|220 ohm resistor, then D11|
|Red LED|Short leg (-)|GND rail|
|Keypad|R1, R2, R3, R4|D9, D8, D7, D6|
|Keypad|C1, C2, C3, C4|D5, D4, D3, D2|
|Buzzer|+|A1|
|Buzzer|-|GND rail|
|Servo|Signal (orange/yellow)|D12|
|Servo|Red|+ of the 5V 3A supply|
|Servo|Brown/black|- of the 5V 3A supply|
|Capacitor 1000 uF|Long leg|Supply +|
|Capacitor 1000 uF|Striped leg|Supply -|
|Common ground|Supply -|Arduino GND (or top blue rail)|



Pins in use: **D2 to D12, A1, A4, A5** . A0 is free. No pin is used twice. 

## **4. Step-by-step wiring** 

### **Step 0: Power rails** 

1. Jumper from Arduino **5V** to the breadboard **top red (+) rail** . 

2. Jumper from Arduino **GND** to the **top blue (-) rail** . 

3. Keep the **bottom rails** free for the servo's external supply. Do not connect them to the Arduino 5V. 

### **Step 1: LCD (I2C, address 0x27)** 

1. LCD **GND** to the top blue rail. 

2. LCD **VCC** to the top red rail. 

3. LCD **SDA** to **A4** . 

4. LCD **SCL** to **A5** . 

**Test:** Plug in USB and upload a LiquidCrystal_I2C "Hello" sketch. If the screen is lit but blank, turn the small contrast screw on the back of the I2C backpack. 

On the UNO R4 WiFi, A4 and A5 are the same as the dedicated SDA and SCL header pins near the USB connector, so either location works. 

SafeDrop - Wiring Guide (final) 

Page 3 

### **Step 2: LEDs on male-to-female wires** 

You need 4 male-to-female jumpers (2 per LED) and 2 resistors (220 ohm). Use **red** wires for the long legs and **black** wires for the short legs. 

##### **Prepare each LED** 

1. Find the **long leg** (positive, anode) and the **short leg** (negative, cathode, next to the flat edge on the base). 

2. Push the **female end of a red wire onto the long leg** . 

3. Push the **female end of a black wire onto the short leg** . 

4. Wrap tape or heat shrink around the connectors so the two metal sleeves cannot touch. If a connector is loose, bend the tips of the LED legs slightly so they grip. 

##### **Green LED** 

1. Jumper from **D10** to breadboard **row 10** . 

2. 220 ohm resistor from **row 10** to **row 12** . A resistor has no polarity, so either way around works. Its two legs must be in different rows. 

3. **Male end of the red wire** (long leg) to **row 12** . 

4. **Male end of the black wire** (short leg) to the **GND rail** . 

##### **Red LED** 

1. Jumper from **D11** to breadboard **row 15** . 

2. 220 ohm resistor from **row 15** to **row 17** . 

3. **Male end of the red wire** (long leg) to **row 17** . 

4. **Male end of the black wire** (short leg) to the **GND rail** . 

**Path for each LED:** Arduino pin, then resistor, then long leg (+), through the LED, then short leg (-), then GND. The long leg never goes to GND and the short leg never goes to the Arduino pin. 

**Test:** Upload a blink sketch on pins 10 and 11. If an LED stays dark, swap its two connectors. This will not damage the LED. 

**Mounting:** Fit each LED in a panel-mount LED holder (or a drilled hole) in the box wall. Plug the female connectors onto the legs from the inside, so all wiring stays inside the box. 

**Step 3: 4x4 keypad (HX-543, all 8 pins)** 

Hold the keypad **face-up with the ribbon at the bottom** , as in the photo you sent. Reading the pins **left to right** , they are R1, R2, R3, R4, C1, C2, C3, C4. 

|**Keypad pin (left to right)**|**Function**|**Arduino**|
|---|---|---|
|1st|R1 (keys 1 2 3 A)|D9|
|2nd|R2 (keys 4 5 6 B)|D8|
|3rd|R3 (keys 7 8 9 C)|D7|
|4th|R4 (keys * 0 # D)|D6|
|5th|C1|D5|
|6th|C2|D4|
|7th|C3|D3|
|8th|C4|D2|



Use female-to-male jumpers from the keypad header to the Arduino pins, or plug the header into the breadboard and jumper from there. 

SafeDrop - Wiring Guide (final) 

Page 4 

**Test:** Upload the Keypad example that prints to Serial, using the key map from the firmware sketch in section 5. Press every key. Each should print its own label. 

- Pressing 1 prints **D** : the connector order is reversed, so flip the wiring order. 

- Pressing 1 prints **4** or **A** : rows and columns are swapped. 

- Some HX-543 units differ from the photo, so this test is the real check. 

The firmware uses only 0 to 9, ***** (clear) and **#** (enter / lock). A, B, C and D are ignored. 

### **Step 4: Buzzer (optional)** 

1. Buzzer **+** to **A1** . 

2. Buzzer **-** to the **GND rail** . 

### **Step 5: Servo and external power** 

1. Servo **signal** wire (orange or yellow) to **D12** . 

2. Servo **red** wire to the **+ output of the 5V 3A supply** . 

3. Servo **brown or black** wire to the **- output of the supply** . 

4. Place the **1000 uF capacitor** across the supply's + and - lines, close to the servo. **Long leg to +** , **striped side to -** . A reversed electrolytic capacitor can fail or pop. 

5. **Common ground:** jumper from the **supply's -** to the **Arduino GND** (or the top blue rail). 

6. **Never** connect the supply's + or the servo's red wire to the Arduino 5V pin. 

**Test:** Upload the Servo "Sweep" example. Plug in the Arduino USB first, then switch on the servo supply. The servo should move smoothly. If the Arduino resets or the servo jitters, check the common ground and the capacitor direction. 

### **Step 6: Final check** 

- All grounds are joined: Arduino GND, top blue rail, LED short legs, buzzer and the supply's -. 

- Only the LCD is powered from the Arduino's 5V rail. 

- The servo is powered only by the external supply. 

- No pin is used twice. Pins in use: D2 to D12, A1, A4, A5. 

- LED connectors cannot short against each other. 

- Only the LEDs, LCD and keypad are reachable from outside. The servo, lock and wiring stay inside the box. 

SafeDrop - Wiring Guide (final) 

Page 5 

## **5. Firmware: bench-test sketch (fake code, no Wi-Fi yet)** 

State machine: **IDLE** (locked, collecting digits), **OPEN** (unlocked, # locks), **LOCKOUT** (30 s after 3 wrong entries). The old CONFIRM state is gone, since # in OPEN replaces it. Calibrate LOCKED_ANGLE and OPEN_ANGLE to your latch. 

```
#include <Keypad.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>
const byte ROWS = 4, COLS = 4;
char keys[ROWS][COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};
byte rowPins[ROWS] = {9, 8, 7, 6};
byte colPins[COLS] = {5, 4, 3, 2};
Keypad keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);
LiquidCrystal_I2C lcd(0x27, 16, 2);
Servo lockServo;
const int GREEN_LED = 10, RED_LED = 11, SERVO_PIN = 12;
const int LOCKED_ANGLE = 0, OPEN_ANGLE = 90;   // calibrate to your latch
const byte CODE_LEN = 6;
enum State { IDLE, OPEN, LOCKOUT };
State state = IDLE;
String entry = "";
String activeCode = "123456";   // fake code; later comes from /sync
byte wrongCount = 0;
unsigned long lockoutStart = 0, openedAt = 0;
void showEnterCode() {
  lcd.clear();
  lcd.print("Enter Code");
  lcd.setCursor(0, 1);
  for (byte i = 0; i < entry.length(); i++) lcd.print('*');
}
void openBox() {
  lockServo.write(OPEN_ANGLE);
  digitalWrite(GREEN_LED, HIGH);
  activeCode = "";            // one-time: wipe the code
  entry = "";
  lcd.clear();
  lcd.print("Correct passcode");
  lcd.setCursor(0, 1);
  lcd.print("Press # to lock");
  openedAt = millis();
  state = OPEN;
}
void lockBox() {
  lockServo.write(LOCKED_ANGLE);
  digitalWrite(GREEN_LED, LOW);
  lcd.clear();
  lcd.print("Box locked");
  delay(2000);
  state = IDLE;
  showEnterCode();
}
void wrongEntry() {
  entry = "";
  wrongCount++;
  digitalWrite(RED_LED, HIGH);
  lcd.clear();
  lcd.print("Wrong passcode");
  delay(1500);
  if (wrongCount >= 3) {
    lcd.clear();
    lcd.print("Locked 30 sec");
    lockoutStart = millis();
    state = LOCKOUT;
```

SafeDrop - Wiring Guide (final) 

Page 6 

```
  } else {
    digitalWrite(RED_LED, LOW);
    showEnterCode();
  }
}
void setup() {
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  lcd.init();
  lcd.backlight();
  lockServo.attach(SERVO_PIN);
  lockServo.write(LOCKED_ANGLE);
  showEnterCode();
}
void loop() {
  if (state == LOCKOUT) {
    if (millis() - lockoutStart >= 30000UL) {
      wrongCount = 0;
      digitalWrite(RED_LED, LOW);
      state = IDLE;
      showEnterCode();
    }
    return;                      // keypad ignored during lockout
  }
  char k = keypad.getKey();
  if (!k) return;
  if (state == OPEN) {
    // # only LOCKS here. Ignored for 1.5 s after unlocking.
    if (k == '#' && millis() - openedAt > 1500) lockBox();
    return;
  }
  // state == IDLE (locked)
  if (k >= '0' && k <= '9' && entry.length() < CODE_LEN) {
    entry += k;
    showEnterCode();
  } else if (k == '*') {
    entry = "";
    showEnterCode();
  } else if (k == '#') {
    if (entry.length() < CODE_LEN) {
      entry = "";
      lcd.clear();
      lcd.print("Enter 6 digits");
      delay(1200);
      showEnterCode();
    } else if (activeCode.length() == CODE_LEN && entry == activeCode) {
      openBox();
    } else {
      wrongEntry();
    }
  }
}
```

Later, **activeCode** is filled by the **/sync** call instead of the fake value, and openBox() and lockBox() queue the **used** and **closed** events for the server. 

## **6. Recommended test order** 

1. LCD "Hello" 

2. LEDs blinking on D10 and D11 

3. Keypad printing to Serial 

4. Servo sweep with the external supply 

5. Full bench sketch above with the fake code 123456 

6. Add Wi-Fi and the server /sync, /used, /attempt and /closed calls 

SafeDrop - Wiring Guide (final) 

Page 7 

## **7. Test checklist** 

- The correct 6-digit code opens the servo and turns on the green LED. The LCD says "Correct passcode". 

- A wrong code keeps the servo locked, turns on the red LED and shows "Wrong passcode". 

- Pressing # alone, or with fewer than 6 digits, never opens the servo. 

- Pressing # while the box is unlocked locks it and the LCD returns to "Enter Code". 

- The same code fails a second time, because it was wiped. 

- Three wrong codes trigger a 30-second lockout. 

- A, B, C and D do nothing. 

- A new code reaches the box within about 3 seconds once Wi-Fi is added. 

## **8. Troubleshooting** 

|**Symptom**|**Likely cause and fix**|
|---|---|
|LCD is lit but blank|Turn the contrast screw on the I2C backpack. Check that the address is 0x27 and<br>SDA/SCL are on A4/A5.|
|LED does not light|Long and short legs reversed. Swap the two connectors.|
|LED connector keeps slipping|Bend the LED leg tips slightly, or fix with tape, heat shrink or a dab of hot glue<br>after testing.|
|Wrong keys print|Reversed or swapped keypad pin order. See the tests in Step 3.|
|Servo jitters or Arduino resets|Missing common ground, capacitor reversed, or servo powered from the Arduino<br>5V.|
|Servo moves the wrong way or hits<br>the end|Adjust LOCKED_ANGLE and OPEN_ANGLE in the sketch.|



## **9. Optional upgrade** 

With no button or sensor, the box locks whenever # is pressed, even if the lid is not fully closed, and the latch could jam against an open lid. A small reed switch or micro-switch on the lid would let the firmware refuse to lock until the lid is shut. 

SafeDrop - Wiring Guide (final) 

Page 8 

