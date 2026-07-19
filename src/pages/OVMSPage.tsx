import { useState } from 'react';
import { useVehicle } from '../context/VehicleContext';
import { connectToOVMS, getOVMSData, getOVMSInstallScript, type OVMSData } from '../services/ovms';
import type { OVMSConfig } from '../types';

export default function OVMSPage() {
  const { selectedVehicle, updateVehicle } = useVehicle();
  const [config, setConfig] = useState<OVMSConfig>({
    ip: '192.168.4.1',
    port: 80,
    token: '',
    vehicleId: '',
    isConnected: false,
  });
  const [ovmsData, setOvmsData] = useState<OVMSData | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [showInstall, setShowInstall] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    setError('');
    const connected = await connectToOVMS(config);
    if (connected) {
      setConfig((prev) => ({ ...prev, isConnected: true }));
      const data = await getOVMSData(config);
      if (data) {
        setOvmsData(data);
        if (selectedVehicle) {
          updateVehicle(selectedVehicle.id, {
            socPercent: data.batterySoc,
            sohPercent: data.batterySoh,
          });
        }
      }
    } else {
      setError('Cannot connect to OVMS module. Make sure you are connected to OVMS WiFi.');
    }
    setConnecting(false);
  };

  const handleRefresh = async () => {
    if (!config.isConnected) return;
    const data = await getOVMSData(config);
    if (data) {
      setOvmsData(data);
      if (selectedVehicle) {
        updateVehicle(selectedVehicle.id, {
          socPercent: data.batterySoc,
          sohPercent: data.batterySoh,
        });
      }
    }
  };

  const downloadScript = () => {
    const script = getOVMSInstallScript();
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'install-evrp-addon.sh';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-1">OVMS Integration</h2>
      <p className="text-[#94a3b8] mb-6">Connect your Open Vehicle Monitoring System for real-time vehicle data</p>

      <div className="card mb-4">
        <h3 className="font-semibold mb-3">Connection Settings</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-[#94a3b8] mb-1">OVMS IP Address</label>
            <input
              type="text"
              value={config.ip}
              onChange={(e) => setConfig((prev) => ({ ...prev, ip: e.target.value }))}
              className="input-field"
              placeholder="192.168.4.1"
            />
          </div>
          <div>
            <label className="block text-sm text-[#94a3b8] mb-1">Port</label>
            <input
              type="number"
              value={config.port}
              onChange={(e) => setConfig((prev) => ({ ...prev, port: parseInt(e.target.value) || 80 }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm text-[#94a3b8] mb-1">Token (optional)</label>
            <input
              type="password"
              value={config.token}
              onChange={(e) => setConfig((prev) => ({ ...prev, token: e.target.value }))}
              className="input-field"
              placeholder="Optional authentication token"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="btn-primary flex-1"
            >
              {connecting ? 'Connecting...' : config.isConnected ? 'Reconnect' : 'Connect'}
            </button>
            {config.isConnected && (
              <button onClick={handleRefresh} className="btn-secondary">
                Refresh
              </button>
            )}
          </div>

          {config.isConnected && (
            <div className="flex items-center gap-2 text-sm text-[#10b981]">
              <div className="w-2 h-2 bg-[#10b981] rounded-full pulse-green" />
              Connected to OVMS
            </div>
          )}
        </div>
      </div>

      {ovmsData && (
        <div className="card mb-4 fade-in">
          <h3 className="font-semibold mb-3">Vehicle Data</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-[#0f172a]">
              <p className="text-xs text-[#94a3b8]">Battery SoC</p>
              <p className="text-xl font-bold text-[#10b981]">{ovmsData.batterySoc}%</p>
            </div>
            <div className="p-3 rounded-lg bg-[#0f172a]">
              <p className="text-xs text-[#94a3b8]">Battery SoH</p>
              <p className="text-xl font-bold">{ovmsData.batterySoh}%</p>
            </div>
            <div className="p-3 rounded-lg bg-[#0f172a]">
              <p className="text-xs text-[#94a3b8]">Temperature</p>
              <p className="text-xl font-bold">{ovmsData.batteryTemperature}°C</p>
            </div>
            <div className="p-3 rounded-lg bg-[#0f172a]">
              <p className="text-xs text-[#94a3b8]">Voltage</p>
              <p className="text-xl font-bold">{ovmsData.batteryVoltage}V</p>
            </div>
            <div className="p-3 rounded-lg bg-[#0f172a]">
              <p className="text-xs text-[#94a3b8]">Current</p>
              <p className="text-xl font-bold">{ovmsData.batteryCurrent}A</p>
            </div>
            <div className="p-3 rounded-lg bg-[#0f172a]">
              <p className="text-xs text-[#94a3b8]">Speed</p>
              <p className="text-xl font-bold">{Math.round(ovmsData.speed)} km/h</p>
            </div>
            <div className="p-3 rounded-lg bg-[#0f172a]">
              <p className="text-xs text-[#94a3b8]">Odometer</p>
              <p className="text-xl font-bold">{Math.round(ovmsData.odometer)} km</p>
            </div>
            <div className="p-3 rounded-lg bg-[#0f172a]">
              <p className="text-xs text-[#94a3b8]">Est. Range</p>
              <p className="text-xl font-bold text-[#10b981]">{ovmsData.estimatedRange} km</p>
            </div>
            <div className="p-3 rounded-lg bg-[#0f172a]">
              <p className="text-xs text-[#94a3b8]">Charging</p>
              <p className={`text-xl font-bold ${ovmsData.isCharging ? 'text-[#10b981]' : 'text-[#64748b]'}`}>
                {ovmsData.isCharging ? 'Yes' : 'No'}
              </p>
            </div>
          </div>

          {ovmsData.isCharging && (
            <div className="mt-3 p-3 rounded-lg bg-[#10b981]/10 border border-[#10b981]/30">
              <p className="text-sm font-medium text-[#10b981]">Charging Status</p>
              <div className="grid grid-cols-3 gap-2 text-sm mt-1">
                <div>
                  <p className="text-[#94a3b8]">Power</p>
                  <p className="font-bold">{Math.round(ovmsData.chargePower)} kW</p>
                </div>
                <div>
                  <p className="text-[#94a3b8]">Voltage</p>
                  <p className="font-bold">{ovmsData.chargeVoltage}V</p>
                </div>
                <div>
                  <p className="text-[#94a3b8]">Current</p>
                  <p className="font-bold">{ovmsData.chargeCurrent}A</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">OVMS Add-on Installer</h3>
          <button onClick={() => setShowInstall(!showInstall)} className="text-sm text-[#10b981] hover:underline">
            {showInstall ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="text-sm text-[#94a3b8] mb-3">
          Install the EV Route Planner add-on on your OVMS module to get real-time vehicle data.
        </p>
        {showInstall && (
          <div className="space-y-3 fade-in">
            <div className="p-3 rounded-lg bg-[#0f172a] text-sm">
              <p className="font-medium mb-1">Installation Steps:</p>
              <ol className="list-decimal list-inside text-[#94a3b8] space-y-1">
                <li>Connect to your OVMS WiFi network</li>
                <li>Download the install script below</li>
                <li>Run the script: <code className="bg-[#334155] px-1 rounded">bash install-evrp-addon.sh</code></li>
                <li>Restart your OVMS module</li>
                <li>Return to this page and connect</li>
              </ol>
            </div>
            <button onClick={downloadScript} className="btn-primary w-full">
              Download Install Script
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
