# IoT Ingestion API

The IoT Ingestion API provides a secure, server-side endpoint for physical IoT devices and simulators to push telemetry data (soil moisture, temperature, humidity, rainfall) directly into the platform.

## Endpoint

**POST** `/api/iot/ingest/readings`

## Authentication

Authentication is handled via a secure device key. The key must be passed in the headers.
Raw keys are never stored in the database. Instead, the server hashes the incoming key using SHA-256 and compares it against `ingest_key_hash` in the `iot_devices` table.

**Required Header:**
`x-device-key`: `<RAW_DEVICE_KEY>`

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

A python simulator is available at `scripts/iot_simulator.py`.

### Local Testing
```bash
export IOT_INGEST_URL="http://localhost:3000/api/iot/ingest/readings"
export IOT_DEVICE_KEYS_JSON='["ydf_rawkeyhere"]'
export IOT_LOOP_INTERVAL=60 # Run every 60s
python scripts/iot_simulator.py
```

### GitHub Actions (Production/Staging)
A GitHub Action automatically runs the simulator every 15 minutes. 
To configure this on a new repository or environment, add the following GitHub Secrets:
1. `IOT_INGEST_URL`: `https://your-production-url.com/api/iot/ingest/readings`
2. `IOT_DEVICE_KEYS_JSON`: `["ydf_key1", "ydf_key2"]`
