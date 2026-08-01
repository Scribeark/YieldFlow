import os
import sys
import json
import time
import random
import requests
from datetime import datetime, timezone

# ─── Environment Configuration ────────────────────────────────────────────────
# Sanitize the URL in case it contains accidental quotes, spaces, or newlines
raw_url = os.environ.get('IOT_INGEST_URL', 'http://localhost:3000/api/iot/ingest/readings')
INGEST_URL = raw_url.strip().strip("'").strip('"')

DEVICE_KEYS_JSON = os.environ.get('IOT_DEVICE_KEYS_JSON', '[]')
VERCEL_PROTECTION_BYPASS = os.environ.get('VERCEL_PROTECTION_BYPASS')
# LOOP_INTERVAL: seconds between runs in loop mode (0 = one-shot, used for local dev)
LOOP_INTERVAL = int(os.environ.get('IOT_LOOP_INTERVAL', '0'))

# ─── Key Loader ───────────────────────────────────────────────────────────────
def load_keys():
    try:
        keys = json.loads(DEVICE_KEYS_JSON)
        if not isinstance(keys, list) or len(keys) == 0:
            print("[Error] IOT_DEVICE_KEYS_JSON must be a non-empty JSON array of raw device keys.")
            print("[Error] Example: [\"ydf_abc123...\"]")
            print("[Error] Ensure you copied the RAW key from the Farm & Devices UI (not the hashed value from Supabase).")
            return []
        return keys
    except json.JSONDecodeError as e:
        print(f"[Error] Failed to parse IOT_DEVICE_KEYS_JSON: {e}")
        print("[Error] Ensure the GitHub secret value is valid JSON, e.g.: [\"your_raw_key\"]")
        return []

# ─── Reading Generator ────────────────────────────────────────────────────────
def generate_reading():
    """Generate a single realistic sensor reading."""
    return {
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "soil_moisture": round(random.uniform(30.0, 55.0), 1),      # 30-55%
        "ambient_temperature": round(random.uniform(22.0, 32.0), 1), # 22-32°C
        "ambient_humidity": round(random.uniform(50.0, 85.0), 1),    # 50-85%
        "rainfall_mm": round(random.uniform(0.0, 5.0), 1) if random.random() > 0.8 else 0.0
    }

# ─── POST Handler ─────────────────────────────────────────────────────────────
def post_readings(device_key, readings):
    headers = {
        'Content-Type': 'application/json',
        'x-device-key': device_key
    }

    if VERCEL_PROTECTION_BYPASS:
        headers['x-vercel-protection-bypass'] = VERCEL_PROTECTION_BYPASS
    else:
        print("[Warn] VERCEL_PROTECTION_BYPASS not set. Request may be blocked if deployment protection is enabled.")

    payload = {"readings": readings}
    masked_key = device_key[:8] + "..." if len(device_key) > 8 else "***"

    print(f"[Info] Posting {len(readings)} reading(s) for device key {masked_key}...")
    print(f"==================================================")
    print(f"[Info] Target URL: {INGEST_URL}")
    print(f"==================================================")

    if not INGEST_URL.startswith("http"):
        print("[Error] IOT_INGEST_URL does not start with http/https. It might be malformed.")

    try:
        response = requests.post(INGEST_URL, json=payload, headers=headers, timeout=15)
        status = response.status_code

        if status == 201:
            print(f"[Success] HTTP {status} - Inserted {len(readings)} reading(s). Response: {response.text}")
        elif status == 404:
            print(f"[Error] HTTP {status} - Not Found (404).")
            print("[Error] The URL may be malformed or pointing to the wrong domain.")
            print(f"[Error] The exact URL requested was: {INGEST_URL}")
            print(f"  Response body: {response.text}")
            sys.exit(1)
        elif status == 401:
            print(f"[Error] HTTP {status} - Unauthorized.")
            print("[Error] Possible causes:")
            print("  1. x-device-key is wrong. Check IOT_DEVICE_KEYS_JSON contains the current RAW key (not the hash).")
            print("  2. Vercel deployment protection is blocking the request. Check VERCEL_PROTECTION_BYPASS is the actual bypass token.")
            print(f"  Response body: {response.text}")
            sys.exit(1)
        elif status == 403:
            print(f"[Error] HTTP {status} - Forbidden. Device may be RETIRED or INACTIVE.")
            print(f"  Response body: {response.text}")
            sys.exit(1)
        elif status == 500:
            print(f"[Error] HTTP {status} - Server error. SUPABASE_SERVICE_ROLE_KEY may be missing in Vercel env vars.")
            print(f"  Response body: {response.text}")
            sys.exit(1)
        else:
            print(f"[Error] HTTP {status} - Unexpected response: {response.text}")
            sys.exit(1)

    except requests.exceptions.Timeout:
        print(f"[Error] Request timed out after 15s. Check if {INGEST_URL} is reachable.")
        sys.exit(1)
    except Exception as e:
        print(f"[Error] Request failed: {str(e)}")
        sys.exit(1)

# ─── Main Simulation Loop ─────────────────────────────────────────────────────
def run_simulation():
    keys = load_keys()
    if not keys:
        print("[Warning] No valid device keys found. Exiting without posting.")
        sys.exit(1)

    print(f"[Info] Starting simulation for {len(keys)} device(s) at {datetime.now(timezone.utc).isoformat()}")

    for key in keys:
        # Generate a batch of 1-5 realistic readings per device
        num_readings = random.randint(1, 5)
        readings = [generate_reading() for _ in range(num_readings)]
        post_readings(key, readings)

    print(f"[Info] Simulation complete.")

if __name__ == '__main__':
    if LOOP_INTERVAL > 0:
        print(f"[Info] Running in Loop Mode (interval: {LOOP_INTERVAL}s)")
        while True:
            run_simulation()
            time.sleep(LOOP_INTERVAL)
    else:
        print("[Info] Running in One-Shot Mode")
        run_simulation()
