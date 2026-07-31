import os
import sys
import json
import time
import random
import requests
from datetime import datetime, timezone

# Environment Configuration
INGEST_URL = os.environ.get('IOT_INGEST_URL', 'http://localhost:3000/api/iot/ingest/readings')
DEVICE_KEYS_JSON = os.environ.get('IOT_DEVICE_KEYS_JSON', '[]')
VERCEL_PROTECTION_BYPASS = os.environ.get('VERCEL_PROTECTION_BYPASS')
# LOOP_INTERVAL defines the sleep time in seconds if running in loop mode
LOOP_INTERVAL = int(os.environ.get('IOT_LOOP_INTERVAL', '0'))

def load_keys():
    try:
        keys = json.loads(DEVICE_KEYS_JSON)
        if not isinstance(keys, list):
            print("[Error] IOT_DEVICE_KEYS_JSON must be a JSON array of strings.")
            return []
        return keys
    except json.JSONDecodeError:
        print("[Error] Failed to parse IOT_DEVICE_KEYS_JSON. Please ensure it is valid JSON.")
        return []

def generate_reading():
    # Base realistic values
    # Soil moisture: 20-60%
    # Temp: 20-35 C
    # Humidity: 40-90%
    # Rainfall: 0 most times, occasionally small spikes
    return {
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "soil_moisture": round(random.uniform(30.0, 55.0), 1),
        "ambient_temperature": round(random.uniform(22.0, 32.0), 1),
        "ambient_humidity": round(random.uniform(50.0, 85.0), 1),
        "rainfall_mm": round(random.uniform(0.0, 5.0), 1) if random.random() > 0.8 else 0.0
    }

def post_readings(device_key, readings):
    headers = {
        'Content-Type': 'application/json',
        'x-device-key': device_key
    }
    
    if VERCEL_PROTECTION_BYPASS:
        headers['x-vercel-protection-bypass'] = VERCEL_PROTECTION_BYPASS
    payload = {
        "readings": readings
    }
    try:
        response = requests.post(INGEST_URL, json=payload, headers=headers, timeout=10)
        # Log partial key for security
        masked_key = device_key[:7] + "..." if len(device_key) > 7 else "***"
        if response.status_code == 201:
            print(f"[Success] Device {masked_key} - Inserted {len(readings)} readings.")
        else:
            print(f"[Error] Device {masked_key} - Status {response.status_code}: {response.text}")
            sys.exit(1)
    except Exception as e:
        print(f"[Request Failed] Error connecting to {INGEST_URL}: {str(e)}")
        sys.exit(1)

def run_simulation():
    keys = load_keys()
    if not keys:
        print("[Warning] No device keys found. Exiting.")
        return

    print(f"Starting simulation for {len(keys)} device(s)...")

    # Generate 1-5 readings per device to simulate a batch
    for key in keys:
        num_readings = random.randint(1, 5)
        readings = [generate_reading() for _ in range(num_readings)]
        post_readings(key, readings)

if __name__ == '__main__':
    if LOOP_INTERVAL > 0:
        print(f"Running in Loop Mode (Interval: {LOOP_INTERVAL}s)")
        while True:
            run_simulation()
            time.sleep(LOOP_INTERVAL)
    else:
        print("Running in One-Shot Mode")
        run_simulation()
