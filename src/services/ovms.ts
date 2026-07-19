import type { OVMSConfig } from '../types';

export interface OVMSData {
  batterySoc: number;
  batterySoh: number;
  batteryTemperature: number;
  batteryVoltage: number;
  batteryCurrent: number;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  odometer: number;
  estimatedRange: number;
  isCharging: boolean;
  chargeCurrent: number;
  chargeVoltage: number;
  chargePower: number;
  ambientTemperature: number;
  tirePressure: { fl: number; fr: number; rl: number; rr: number };
  lastUpdate: number;
}

export async function connectToOVMS(config: OVMSConfig): Promise<boolean> {
  try {
    const url = `http://${config.ip}:${config.port}/api/status`;
    const response = await fetch(url, {
      method: 'GET',
      headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getOVMSData(config: OVMSConfig): Promise<OVMSData | null> {
  try {
    const url = `http://${config.ip}:${config.port}/api/status`;
    const response = await fetch(url, {
      method: 'GET',
      headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return parseOVMSData(data);
  } catch {
    return null;
  }
}

function parseOVMSData(raw: any): OVMSData {
  return {
    batterySoc: parseFloat(raw.battery?.soc) || 0,
    batterySoh: parseFloat(raw.battery?.soh) || 100,
    batteryTemperature: parseFloat(raw.battery?.temperature) || 0,
    batteryVoltage: parseFloat(raw.battery?.voltage) || 0,
    batteryCurrent: parseFloat(raw.battery?.current) || 0,
    latitude: parseFloat(raw.location?.latitude) || 0,
    longitude: parseFloat(raw.location?.longitude) || 0,
    speed: parseFloat(raw.location?.speed) || 0,
    heading: parseFloat(raw.location?.heading) || 0,
    odometer: parseFloat(raw.vehicle?.odometer) || 0,
    estimatedRange: parseFloat(raw.vehicle?.estimated_range) || 0,
    isCharging: raw.charge?.state === 'charging',
    chargeCurrent: parseFloat(raw.charge?.current) || 0,
    chargeVoltage: parseFloat(raw.charge?.voltage) || 0,
    chargePower: parseFloat(raw.charge?.power) || 0,
    ambientTemperature: parseFloat(raw.climate?.ambient_temperature) || 0,
    tirePressure: {
      fl: parseFloat(raw.tires?.fl) || 0,
      fr: parseFloat(raw.tires?.fr) || 0,
      rl: parseFloat(raw.tires?.rl) || 0,
      rr: parseFloat(raw.tires?.rr) || 0,
    },
    lastUpdate: Date.now(),
  };
}

export function getOVMSInstallScript(): string {
  return `#!/bin/bash
# EV Route Planner - OVMS Add-on Installer
# This script installs the EV Route Planner addon on your OVMS module

OVMS_HOST=\${1:-192.168.4.1}
OVMS_PORT=\${2:-80}

echo "=== EV Route Planner - OVMS Add-on Installer ==="
echo ""
echo "Connecting to OVMS at $OVMS_HOST:$OVMS_PORT..."

# Check if OVMS is reachable
if ! curl -s -o /dev/null -w "%{http_code}" "http://$OVMS_HOST:$OVMS_PORT" | grep -q "200"; then
    echo "ERROR: Cannot connect to OVMS module at $OVMS_HOST:$OVMS_PORT"
    echo "Make sure you are connected to OVMS WiFi network."
    exit 1
fi

echo "Connected successfully!"

# Install OVMS API extension
echo "Installing EV Route Planner API extension..."

mkdir -p /data/evrp

# Create the API endpoint configuration
cat > /data/evrp/config.json << 'ENDCONFIG'
{
  "enabled": true,
  "api_port": 8080,
  "poll_interval_ms": 5000,
  "endpoints": {
    "status": true,
    "location": true,
    "battery": true,
    "charging": true,
    "vehicle": true
  }
}
ENDCONFIG

# Create the addon script
cat > /data/evrp/addon.py << 'ENDADDON'
#!/usr/bin/env python3
"""
EV Route Planner - OVMS Data Extension
Provides real-time vehicle data via HTTP API
"""

import json
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

try:
    import ovms_info
except ImportError:
    class ovms_info:
        @staticmethod
        def get(key, default=""):
            return default

config = {}
vehicle_data = {}

class OVMSHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(vehicle_data).encode())

        elif path == "/api/battery":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            battery = {
                "soc": vehicle_data.get("battery", {}).get("soc", 0),
                "soh": vehicle_data.get("battery", {}).get("soh", 100),
                "temperature": vehicle_data.get("battery", {}).get("temperature", 0),
                "voltage": vehicle_data.get("battery", {}).get("voltage", 0),
                "current": vehicle_data.get("battery", {}).get("current", 0),
                "is_charging": vehicle_data.get("charge", {}).get("state") == "charging",
            }
            self.wfile.write(json.dumps(battery).encode())

        elif path == "/api/location":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            location = vehicle_data.get("location", {})
            self.wfile.write(json.dumps(location).encode())

        elif path == "/api/vehicle":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            vehicle = {
                "odometer": vehicle_data.get("vehicle", {}).get("odometer", 0),
                "estimated_range": vehicle_data.get("vehicle", {}).get("estimated_range", 0),
                "speed": vehicle_data.get("vehicle", {}).get("speed", 0),
            }
            self.wfile.write(json.dumps(vehicle).encode())

        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass

def poll_vehicle_data():
    global vehicle_data
    while True:
        try:
            vehicle_data = {
                "battery": {
                    "soc": ovms_info.get("xbs.batt.soc", "0"),
                    "soh": ovms_info.get("xbs.batt.soh", "100"),
                    "temperature": ovms_info.get("xbs.batt.temp", "0"),
                    "voltage": ovms_info.get("xbs.batt.voltage", "0"),
                    "current": ovms_info.get("xbs.batt.current", "0"),
                },
                "location": {
                    "latitude": ovms_info.get("xbs.loc.latitude", "0"),
                    "longitude": ovms_info.get("xbs.loc.longitude", "0"),
                    "speed": ovms_info.get("xbs.loc.speed", "0"),
                    "heading": ovms_info.get("xbs.loc.heading", "0"),
                },
                "vehicle": {
                    "odometer": ovms_info.get("xbs.vehicle.odometer", "0"),
                    "estimated_range": ovms_info.get("xbs.vehicle.estimated_range", "0"),
                    "speed": ovms_info.get("xbs.vehicle.speed", "0"),
                },
                "charge": {
                    "state": ovms_info.get("xbs.charge.state", "done"),
                    "current": ovms_info.get("xbs.charge.current", "0"),
                    "voltage": ovms_info.get("xbs.charge.voltage", "0"),
                    "power": ovms_info.get("xbs.charge.power", "0"),
                },
                "climate": {
                    "ambient_temperature": ovms_info.get("xbs.climate.ambient_temp", "0"),
                },
                "tires": {
                    "fl": ovms_info.get("xbs.tires.fl", "0"),
                    "fr": ovms_info.get("xbs.tires.fr", "0"),
                    "rl": ovms_info.get("xbs.tires.rl", "0"),
                    "rr": ovms_info.get("xbs.tires.rr", "0"),
                },
                "timestamp": int(time.time()),
            }
        except Exception as e:
            print(f"Error polling OVMS: {e}")

        time.sleep(config.get("poll_interval_ms", 5000) / 1000)

def main():
    global config

    try:
        with open("/data/evrp/config.json") as f:
            config = json.load(f)
    except:
        config = {"api_port": 8080, "poll_interval_ms": 5000}

    poll_thread = threading.Thread(target=poll_vehicle_data, daemon=True)
    poll_thread.start()

    port = config.get("api_port", 8080)
    server = HTTPServer(("0.0.0.0", port), OVMSHandler)
    print(f"EV Route Planner API running on port {port}")
    server.serve_forever()

if __name__ == "__main__":
    main()
ENDADDON

echo "Installation complete!"
echo "The EV Route Planner API is now running on port 8080."
echo "You can connect to http://$OVMS_HOST:8080/api/status"
echo ""
echo "Restart OVMS to activate the addon."
`;
}
