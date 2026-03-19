# SchoolSync Pi Agent — RFID Attendance Device Specification

## Overview

The Pi Agent is an offline-first application that runs on a Raspberry Pi at each school gate. It reads RFID card taps from a USB HID reader, identifies students from a local database, records attendance locally, displays the student name on a 16x2 LCD, and syncs data to the SchoolSync API when internet is available.

---

## Hardware Bill of Materials (Per Gate)

| Component | Model | Approx Cost (INR) | Notes |
|-----------|-------|-------------------|-------|
| Raspberry Pi | Pi 4 Model B (2GB RAM) or Pi Zero 2 W | ₹3,500 - ₹5,500 | Pi Zero 2 W is cheaper but has 1 USB port |
| RFID Reader | Chinese USB HID Mifare reader | ₹500 - ₹1,500 | Keyboard emulator type, reads Mifare Classic 1K/4K |
| LCD Display | 16x2 I2C LCD (HD44780 + PCF8574 backpack) | ₹150 - ₹300 | I2C reduces wiring to 4 pins (VCC, GND, SDA, SCL) |
| MicroSD Card | 16GB Class 10 | ₹300 | Holds OS + SQLite DB + agent app |
| Power Supply | 5V 3A USB-C (for Pi 4) or Micro-USB (for Pi Zero) | ₹300 | Must be reliable — use a UPS if power is unstable |
| Enclosure | 3D printed or off-the-shelf Pi case with LCD cutout | ₹200 - ₹500 | Weather-resistant if mounted outdoors |
| Cables | USB extension (for reader), I2C jumper wires (for LCD) | ₹100 | |
| **Total per gate** | | **₹5,050 - ₹8,200** | |

Optional additions:
- Buzzer (₹30) — audible feedback on tap
- LED (₹10) — green/red status indicator
- UPS HAT (₹1,500) — battery backup for power outages
- Ethernet cable — more reliable than WiFi for schools with LAN

---

## Software Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    RASPBERRY PI                              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                Python Agent App                       │   │
│  │                                                       │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │   │
│  │  │ Card Reader  │  │ Attendance   │  │ Sync       │  │   │
│  │  │ Module       │  │ Processor    │  │ Manager    │  │   │
│  │  │              │  │              │  │            │  │   │
│  │  │ evdev/stdin  │  │ Local lookup │  │ Push queue │  │   │
│  │  │ → card UID   │  │ Debounce 5m  │  │ Pull students│ │   │
│  │  │              │  │ Check in/out │  │ Health check│  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬─────┘  │   │
│  │         │                 │                  │        │   │
│  │  ┌──────▼─────────────────▼──────────────────▼─────┐  │   │
│  │  │              SQLite Database                     │  │   │
│  │  │                                                  │  │   │
│  │  │  students        attendance_queue    sync_log    │  │   │
│  │  │  - id            - id               - timestamp │  │   │
│  │  │  - rfid_card     - student_id       - type      │  │   │
│  │  │  - first_name    - card_number      - status    │  │   │
│  │  │  - last_name     - timestamp        - records   │  │   │
│  │  │  - class_name    - action (IN/OUT)              │  │   │
│  │  │  - section_name  - synced (bool)                │  │   │
│  │  │  - status        - synced_at                    │  │   │
│  │  └─────────────────────────────────────────────────┘  │   │
│  │                                                       │   │
│  │  ┌─────────────┐  ┌──────────────┐                   │   │
│  │  │ LCD Driver   │  │ Config File  │                   │   │
│  │  │ 16x2 I2C     │  │ config.yaml  │                   │   │
│  │  └─────────────┘  └──────────────┘                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Config File (config.yaml)

```yaml
# SchoolSync Pi Agent Configuration
# Place at /home/pi/schoolsync/config.yaml

server:
  api_url: "https://api.schoolsync.app"   # SchoolSync API base URL
  tenant_slug: "addis-international"        # School's tenant slug
  reader_secret: "your-reader-secret-here"  # X-Reader-Secret for RFID auth
  reader_id: "gate-01"                      # Unique ID for this reader/gate

hardware:
  reader_device: "/dev/input/event0"        # USB HID device path (auto-detect on startup)
  lcd_i2c_address: 0x27                     # I2C address of LCD (common: 0x27 or 0x3F)
  lcd_cols: 16                              # LCD columns
  lcd_rows: 2                               # LCD rows

timing:
  debounce_seconds: 300                     # 5 minutes — ignore duplicate taps within this window
  sync_interval_seconds: 300                # 5 minutes — how often to push queue and pull updates
  health_check_seconds: 60                  # 1 minute — how often to check internet connectivity
  lcd_display_seconds: 3                    # How long to show student name on LCD after tap

school:
  start_time: "08:00"                       # School start time (for late detection)
  grace_minutes: 15                         # Grace period before marking LATE
  timezone: "Africa/Addis_Ababa"            # Timezone for timestamp generation

storage:
  db_path: "/home/pi/schoolsync/data/attendance.db"  # SQLite database path
  log_path: "/home/pi/schoolsync/logs/"               # Log files directory
  max_queue_age_days: 30                              # Delete synced records older than 30 days
```

---

## SQLite Schema

```sql
-- Students table (synced from server)
CREATE TABLE students (
    id TEXT PRIMARY KEY,              -- UUID from server
    tenant_id TEXT NOT NULL,
    rfid_card_number TEXT NOT NULL,   -- Decrypted card number for local matching
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    class_name TEXT NOT NULL,         -- "Grade 1"
    section_name TEXT NOT NULL,       -- "A"
    admission_number TEXT NOT NULL,   -- "AIS-2026-001"
    status TEXT DEFAULT 'ACTIVE',     -- ACTIVE or INACTIVE
    photo_url TEXT,                   -- Optional, for future LCD upgrade to screen
    updated_at TEXT NOT NULL
);
CREATE INDEX idx_students_rfid ON students(rfid_card_number);

-- Attendance queue (local records, synced to server when online)
CREATE TABLE attendance_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    card_number TEXT NOT NULL,
    reader_id TEXT NOT NULL,
    tap_timestamp TEXT NOT NULL,       -- ISO 8601 with timezone
    action TEXT NOT NULL,              -- 'CHECK_IN' or 'CHECK_OUT'
    status TEXT NOT NULL,              -- 'PRESENT', 'LATE', 'ABSENT'
    synced INTEGER DEFAULT 0,          -- 0 = pending, 1 = synced
    synced_at TEXT,                     -- When it was synced to server
    server_response TEXT,              -- JSON response from server (for debugging)
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_queue_synced ON attendance_queue(synced);
CREATE INDEX idx_queue_student_date ON attendance_queue(student_id, tap_timestamp);

-- Debounce tracking (prevents duplicate taps)
CREATE TABLE last_tap (
    card_number TEXT PRIMARY KEY,
    tap_timestamp TEXT NOT NULL
);

-- Sync log (tracks sync history)
CREATE TABLE sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_type TEXT NOT NULL,           -- 'push_attendance', 'pull_students', 'health_check'
    status TEXT NOT NULL,              -- 'success', 'failed', 'partial'
    records_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
```

---

## Application Flow

### Card Tap Processing

```
1. USB HID reader sends card number as keyboard input
2. Agent captures the full card number (terminated by Enter key)
3. DEBOUNCE CHECK:
   - Query last_tap WHERE card_number = ? AND tap_timestamp > (now - 5 minutes)
   - If found → ignore, show "Already scanned" on LCD for 1 second
   - If not found → proceed
4. STUDENT LOOKUP:
   - Query students WHERE rfid_card_number = ? AND status = 'ACTIVE'
   - If not found → show "Unknown Card" on LCD, log to attendance_queue with student_id = NULL
   - If found → proceed
5. DETERMINE ACTION:
   - Query attendance_queue WHERE student_id = ? AND date(tap_timestamp) = today AND synced IN (0, 1)
   - No record today → CHECK_IN
     - If current_time > school_start + grace_minutes → status = LATE
     - Else → status = PRESENT
   - Has CHECK_IN but no CHECK_OUT → CHECK_OUT, status = PRESENT
   - Has both → ignore (already fully recorded)
6. SAVE LOCALLY:
   - INSERT into attendance_queue
   - UPDATE last_tap (upsert card_number → current timestamp)
7. DISPLAY ON LCD:
   - Line 1: student first_name + last_name (truncated to 16 chars)
   - Line 2: class_name + section_name + action (e.g., "Grade 2-A  IN")
   - Hold for 3 seconds, then return to idle display
8. IF ONLINE:
   - Immediately POST to /v1/attendance/rfid-event
   - Mark as synced if server responds 200
   - If server errors or timeout → stays in queue for next sync cycle
```

### LCD Display States

```
IDLE (no recent tap):
┌────────────────┐
│  SchoolSync     │
│  ✓ Online  08:15│
└────────────────┘

IDLE (offline):
┌────────────────┐
│  SchoolSync     │
│  ✗ Offline 08:15│
└────────────────┘

CARD TAP (recognized, check-in):
┌────────────────┐
│Dawit Bekele    │
│Grade 2-A    IN │
└────────────────┘

CARD TAP (recognized, check-out):
┌────────────────┐
│Dawit Bekele    │
│Grade 2-A   OUT │
└────────────────┘

CARD TAP (late):
┌────────────────┐
│Dawit Bekele    │
│Grade 2-A  LATE │
└────────────────┘

CARD TAP (unknown):
┌────────────────┐
│Unknown Card    │
│AA:BB:CC:DD     │
└────────────────┘

CARD TAP (debounce):
┌────────────────┐
│Already Scanned │
│Wait 5 minutes  │
└────────────────┘

SYNCING:
┌────────────────┐
│  Syncing...    │
│  47 records    │
└────────────────┘
```

### Sync Manager (Background Thread)

```
Every sync_interval_seconds (default 5 minutes):

1. HEALTH CHECK:
   - GET /v1/sync/health
   - If fails → mark as offline, skip sync, retry next cycle
   - If succeeds → mark as online, proceed

2. PUSH ATTENDANCE QUEUE:
   - SELECT * FROM attendance_queue WHERE synced = 0 ORDER BY tap_timestamp ASC LIMIT 100
   - POST /v1/sync/attendance-bulk with array of records
   - For each successfully synced record: UPDATE synced = 1, synced_at = now
   - Log result to sync_log

3. PULL STUDENT UPDATES:
   - GET /v1/sync/students?updatedSince={last_sync_timestamp}
   - Upsert each student into local SQLite students table
   - This handles: new enrollments, name changes, class transfers, deactivated cards
   - Update last_sync_timestamp

4. CLEANUP:
   - DELETE FROM attendance_queue WHERE synced = 1 AND synced_at < (now - 30 days)
   - DELETE FROM sync_log WHERE created_at < (now - 30 days)
```

---

## Required API Endpoints (Backend)

These endpoints need to be added to the SchoolSync backend:

```
GET  /v1/sync/health
  → Response: { "status": "ok", "timestamp": "2026-03-19T08:00:00Z" }
  → Auth: X-Reader-Secret
  → Purpose: Pi checks if server is reachable

GET  /v1/sync/students?updatedSince={ISO_DATE}
  → Response: { "data": [{ id, rfidCardNumber, firstName, lastName, className, sectionName, admissionNumber, status }] }
  → Auth: X-Reader-Secret + X-Tenant-ID
  → Purpose: Pi downloads/refreshes its local student database
  → If updatedSince is omitted, returns ALL active students (initial sync)
  → If updatedSince is provided, returns only students modified after that date

POST /v1/sync/attendance-bulk
  → Body: { "records": [{ studentId, cardNumber, readerId, timestamp, action, status }] }
  → Response: { "synced": 47, "failed": 0, "errors": [] }
  → Auth: X-Reader-Secret + X-Tenant-ID
  → Purpose: Pi pushes its offline attendance queue in bulk
  → Server should be idempotent — if a record already exists for that student+date+action, skip it
  → Server processes each record through the same logic as /v1/attendance/rfid-event (debounce, late detection, Socket.IO emit, parent notification)
```

---

## Tech Stack (Pi Agent)

| Component | Technology | Reason |
|-----------|-----------|--------|
| Language | Python 3.11+ | Pre-installed on Raspberry Pi OS, best hardware library support |
| Card Reader | `evdev` library | Reads USB HID input events, handles keyboard emulator readers |
| Database | SQLite3 (built-in) | Zero setup, file-based, handles thousands of students easily |
| LCD | `RPLCD` library + `smbus2` | Standard I2C LCD driver for Raspberry Pi |
| HTTP | `requests` library | Simple, reliable HTTP client for API calls |
| Config | `pyyaml` | Human-readable config file |
| Scheduling | `threading.Timer` or `schedule` | Background sync thread |
| Logging | `logging` (built-in) | File-based logging with rotation |
| Process Manager | `systemd` service | Auto-start on boot, auto-restart on crash |

### Python Dependencies (requirements.txt)

```
evdev>=1.7.0
requests>=2.31.0
pyyaml>=6.0
RPLCD>=1.3.1
smbus2>=0.4.3
schedule>=1.2.0
```

---

## Deployment to Raspberry Pi

### Initial Setup (One-time per Pi)

```bash
# 1. Flash Raspberry Pi OS Lite (64-bit) to SD card
# 2. Enable SSH, configure WiFi (or use Ethernet)
# 3. SSH into the Pi

# 4. Install system dependencies
sudo apt update && sudo apt install -y python3-pip python3-venv i2c-tools

# 5. Enable I2C for LCD
sudo raspi-config  # Interface Options → I2C → Enable

# 6. Create app directory
mkdir -p /home/pi/schoolsync/{data,logs}
cd /home/pi/schoolsync

# 7. Clone or copy the agent app
git clone https://github.com/Thinkbotic2017/school_sync.git --sparse --filter=blob:none
cd school_sync && git sparse-checkout set packages/pi-agent
cp -r packages/pi-agent/* /home/pi/schoolsync/

# 8. Install Python dependencies
cd /home/pi/schoolsync
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 9. Configure
cp config.example.yaml config.yaml
nano config.yaml  # Set API URL, tenant slug, reader secret, reader ID

# 10. Test the reader
python3 test_reader.py  # Should print card numbers when cards are tapped

# 11. Test LCD
python3 test_lcd.py  # Should display "SchoolSync" on LCD

# 12. Initial student sync
python3 sync.py --initial  # Downloads all students from server

# 13. Install as systemd service (auto-start on boot)
sudo cp schoolsync-agent.service /etc/systemd/system/
sudo systemctl enable schoolsync-agent
sudo systemctl start schoolsync-agent

# 14. Verify
sudo systemctl status schoolsync-agent  # Should show "active (running)"
```

### systemd Service File (schoolsync-agent.service)

```ini
[Unit]
Description=SchoolSync RFID Attendance Agent
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/schoolsync
ExecStart=/home/pi/schoolsync/venv/bin/python3 agent.py
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

---

## Remote Management

For MSquare to manage Pi devices across multiple schools:

### SSH Tunnel (Simple)
- Each Pi opens a reverse SSH tunnel to a central server
- MSquare can SSH in, check logs, update config, restart the agent

### Future: Device Management Dashboard
- Each Pi periodically POSTs a heartbeat to the API: `POST /v1/devices/heartbeat`
- Dashboard shows: device ID, school, last heartbeat, online/offline, queue size, last sync time
- This is a Phase 6+ feature — not needed for initial deployment

---

## Testing Checklist (Before Shipping to Ethiopia)

- [ ] Card tap → LCD shows student name + class within 1 second
- [ ] Unknown card → LCD shows "Unknown Card" + card number
- [ ] Duplicate tap within 5 min → LCD shows "Already Scanned"
- [ ] Disconnect WiFi → taps still work, queue grows
- [ ] Reconnect WiFi → queue syncs within 5 minutes
- [ ] Pull power → on reboot, agent auto-starts, queue is preserved (SQLite is durable)
- [ ] Add a new student on the web app → within 5 minutes, Pi recognizes their card
- [ ] Deactivate a student on the web app → within 5 minutes, Pi shows "Unknown Card" for that student
- [ ] 500+ students in local DB → tap response time still under 1 second
- [ ] Run 24 hours continuously → no memory leaks, no crashes

---

## Cost Estimate for MSquare

### Per School (Single Gate)
| Item | Cost (INR) | Cost (ETB approx) |
|------|-----------|-------------------|
| Raspberry Pi 4 (2GB) | ₹4,500 | ~6,300 ETB |
| USB HID RFID Reader | ₹800 | ~1,100 ETB |
| 16x2 I2C LCD | ₹200 | ~280 ETB |
| MicroSD 16GB | ₹300 | ~420 ETB |
| Power supply + cables | ₹400 | ~560 ETB |
| Enclosure | ₹300 | ~420 ETB |
| **Total hardware** | **₹6,500** | **~9,100 ETB** |

### Per School (Dual Gate — Entry + Exit)
Double the above = ₹13,000 / ~18,200 ETB

### Mifare Cards (Per Student)
| Item | Cost (INR) | Cost (ETB approx) |
|------|-----------|-------------------|
| Mifare Classic 1K card (blank) | ₹15 | ~21 ETB |
| Mifare Classic 1K card (printed with school logo) | ₹25-40 | ~35-56 ETB |
| Mifare keyfob/wristband (for younger students) | ₹20-30 | ~28-42 ETB |

For a school with 500 students: ₹7,500 - ₹20,000 for cards (10,500 - 28,000 ETB)

---

## File Structure (When Built)

```
packages/pi-agent/
├── agent.py                    # Main entry point — card reader loop
├── config.example.yaml         # Example configuration
├── requirements.txt            # Python dependencies
├── schoolsync-agent.service    # systemd service file
├── modules/
│   ├── __init__.py
│   ├── card_reader.py          # USB HID reader interface (evdev)
│   ├── attendance.py           # Attendance processing (debounce, check-in/out, late detection)
│   ├── database.py             # SQLite operations (students, queue, sync log)
│   ├── lcd_display.py          # 16x2 LCD I2C driver
│   ├── sync_manager.py         # Background sync (push queue, pull students, health check)
│   └── config.py               # YAML config loader
├── tests/
│   ├── test_reader.py          # Interactive reader test
│   ├── test_lcd.py             # LCD display test
│   ├── test_attendance.py      # Unit tests for attendance logic
│   └── test_sync.py            # Unit tests for sync logic
└── scripts/
    ├── setup.sh                # One-command Pi setup script
    ├── update.sh               # Pull latest agent code + restart service
    └── reset_db.sh             # Clear local DB and re-sync from server
```
