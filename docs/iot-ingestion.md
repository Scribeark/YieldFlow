# IoT Ingestion API

The IoT Ingestion API provides a secure, server-side endpoint for physical IoT devices and simulators to push telemetry data (soil moisture, temperature, humidity, rainfall) directly into the platform.

## Endpoint

**POST** `/api/iot/ingest/readings`

## Authentication

Authentication is handled via a secure device key. The key must be passed in the headers.
Raw keys are never stored in the database. Instead, the server hashes the incoming key using SHA-256 and compares it against `ingest_key_hash` in the `iot_devices` table.

**Required Header:**
`x-device-key`: `<RAW_DEVICE_KEY>`

**Optional Header (for Vercel Protected Deployments):**
`x-vercel-protection-bypass`: `<VERCEL_PROTECTION_BYPASS_SECRET>`

## Key Management (Farm & Devices Dashboard)

Sellers can manage device keys directly in the **Farm & Devices** dashboard.
1. Navigate to **Farm & Devices**.
2. Select a connected device.
3. Click **Generate Key** (or **Rotate Key**).
4. **Copy the key immediately**. For security, the raw key is never stored in the database and cannot be viewed again.
5. If a key is rotated, the previous key will immediately stop working.

## Payload Contracts

The endpoint supports both single readings and batch readings.

### 1. Single Reading Payload

```json
{
  "recorded_at": "2026-07-30T16:00:00Z",
  "soil_moisture": 41.2,
  "ambient_temperature": 29.8,
  "ambient_humidity": 68.5,
  "rainfall_mm": 0.0
}
```

### 2. Batch Reading Payload

```json
{
  "readings": [
    {
      "recorded_at": "2026-07-30T16:00:00Z",
      "soil_moisture": 41.2,
      "ambient_temperature": 29.8,
      "ambient_humidity": 68.5,
      "rainfall_mm": 0.0
    },
    {
      "recorded_at": "2026-07-30T16:15:00Z",
      "soil_moisture": 40.5,
      "ambient_temperature": 28.5,
      "ambient_humidity": 69.2,
      "rainfall_mm": 0.0
    }
  ]
}
```

### Validation Rules
- `recorded_at`: (Optional) ISO 8601 timestamp string. Defaults to the server's current timestamp if omitted.
- `soil_moisture`: (Required) Numeric.
- `ambient_temperature`: (Required) Numeric.
- `ambient_humidity`: (Required) Numeric.
- `rainfall_mm`: (Optional) Numeric. Defaults to `0.0`.

## Responses

### Success (201 Created)
```json
{
  "success": true,
  "inserted": 2,
  "device_id": "uuid-here",
  "farm_id": "uuid-here"
}
```

### Errors
- **401 Unauthorized**: Missing `x-device-key` header, or the key did not match any active device.
- **403 Forbidden**: Device is found but its status is not `ACTIVE`.
- **400 Bad Request**: Invalid JSON shape or missing required numeric fields.
- **500 Internal Server Error**: Database insertion failure or server misconfiguration.

## Prediction Trigger Continuity
When readings are successfully inserted into `iot_sensor_streams` via this API, the existing Supabase triggers and RPC functions (like the `hybrid_score` engine) will automatically execute to update `harvest_predictions`.

## Simulator & Automation

A Python simulator is available at `scripts/iot_simulator.py`.

### Local Testing
```bash
export IOT_INGEST_URL="http://localhost:3000/api/iot/ingest/readings"
export IOT_DEVICE_KEYS_JSON='["ydf_rawkeyhere"]'
export IOT_LOOP_INTERVAL=60  # Optional: run every 60s in loop mode
python scripts/iot_simulator.py
```

For a protected Vercel deployment:
```bash
export VERCEL_PROTECTION_BYPASS="your_actual_bypass_token_from_vercel_dashboard"
```

### cURL Test (production)

**Standard:**
```bash
curl -i -X POST "https://YOUR_DOMAIN/api/iot/ingest/readings" \
  -H "Content-Type: application/json" \
  -H "x-device-key: RAW_DEVICE_KEY_FROM_UI" \
  --data '{"soil_moisture":45.2,"ambient_temperature":27.5,"ambient_humidity":65.0,"rainfall_mm":0}'
```

**With Vercel Protection Bypass:**
```bash
curl -i -X POST "https://YOUR_DOMAIN/api/iot/ingest/readings" \
  -H "Content-Type: application/json" \
  -H "x-device-key: RAW_DEVICE_KEY_FROM_UI" \
  -H "x-vercel-protection-bypass: YOUR_ACTUAL_BYPASS_TOKEN" \
  --data '{"soil_moisture":45.2,"ambient_temperature":27.5,"ambient_humidity":65.0,"rainfall_mm":0}'
```

Expected success response (HTTP 201):
```json
{"success":true,"inserted":1,"device_id":"...","farm_id":"..."}
```

### GitHub Actions (Production)

The workflow is at `.github/workflows/iot-simulator.yml`.

**Current interval:** Every 15 minutes UTC (`*/15 * * * *`).

> ⚠️ GitHub Free/Team tier cron jobs can be delayed by up to 10–15 minutes beyond the scheduled time.
> GitHub may also skip or delay runs if the repository has been inactive. This is a GitHub platform limitation, not a code bug.

**To change the interval:** Edit the `cron:` line in the workflow file:
```yaml
- cron: '*/30 * * * *'  # Every 30 minutes
- cron: '0 * * * *'      # Every hour
```

**To run manually:**
1. Go to your GitHub repository.
2. Click the **Actions** tab.
3. Select **IoT Telemetry Simulator** from the left sidebar.
4. Click **Run workflow** → **Run workflow** (green button).
5. Watch the run's logs in real time.

**Required GitHub Secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `IOT_INGEST_URL` | `https://your-vercel-domain.vercel.app/api/iot/ingest/readings` |
| `IOT_DEVICE_KEYS_JSON` | `["raw_key_copied_from_farm_devices_ui"]` |
| `VERCEL_PROTECTION_BYPASS` | The actual bypass token from Vercel Dashboard → Settings → Deployment Protection → Protection Bypass for Automation |

> ⚠️ `IOT_DEVICE_KEYS_JSON` must contain the **raw** key shown in the UI immediately after generating/rotating — not the hash value from the Supabase `iot_devices` table.
> If you rotate a device key, update this secret with the new raw key.

### How to Verify the Simulator Worked

After a manual or scheduled run:

**In GitHub Actions:**
- Open the run's logs and look for `[Success] HTTP 201`.
- The "Validate secrets" step will clearly state if any secret is missing.
- Any error (401, 403, 500) will show the exact cause and fail the action.

**In Supabase:**
```sql
-- Check latest readings
SELECT recorded_at, soil_moisture, ambient_temperature, ambient_humidity
FROM iot_sensor_streams
ORDER BY recorded_at DESC
LIMIT 10;

-- Check device last seen
SELECT device_name, last_seen_at, ingest_key_last_used_at
FROM iot_devices;
```

**In the Farm & Devices UI:**
- Refresh the page.
- "Active Readings" counter should increase.
- "Last Recorded" timestamp should update.
- The chart should show new data points.
- If "Harvest Analysis" is started, `readiness_score` should change after new readings arrive.
