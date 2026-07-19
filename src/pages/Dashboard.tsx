import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVehicle } from '../context/VehicleContext';
import VehicleSelector from '../components/VehicleSelector';

export default function Dashboard() {
  const { userData } = useAuth();
  const { selectedVehicle } = useVehicle();

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 max-w-7xl mx-auto">
      <div className="fade-in">
        <h1 className="text-2xl font-bold mb-1">Welcome back, {userData?.displayName || 'Driver'}!</h1>
        <p className="text-[#94a3b8] mb-6">Plan your next EV journey with real-time charger data</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Link to="/plan" className="card hover:border-[#10b981] transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#10b981]/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                🗺️
              </div>
              <div>
                <h3 className="font-semibold">Plan Route</h3>
                <p className="text-sm text-[#94a3b8]">Get the best charging route</p>
              </div>
            </div>
          </Link>

          <Link to="/chargers" className="card hover:border-[#3b82f6] transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                ⚡
              </div>
              <div>
                <h3 className="font-semibold">Find Chargers</h3>
                <p className="text-sm text-[#94a3b8]">Nearby charging stations</p>
              </div>
            </div>
          </Link>

          <Link to="/share" className="card hover:border-[#f59e0b] transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#f59e0b]/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                📍
              </div>
              <div>
                <h3 className="font-semibold">Share Location</h3>
                <p className="text-sm text-[#94a3b8]">Let others track you</p>
              </div>
            </div>
          </Link>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Your Vehicle</h2>
            {selectedVehicle && (
              <span className="badge badge-green">Selected</span>
            )}
          </div>
          <VehicleSelector />
        </div>

        {selectedVehicle && (
          <div className="card mb-6">
            <h2 className="text-lg font-semibold mb-3">Vehicle Status</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-[#94a3b8]">Battery (SoC)</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-[#334155] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#10b981] rounded-full transition-all"
                      style={{ width: `${selectedVehicle.socPercent}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold">{selectedVehicle.socPercent}%</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-[#94a3b8]">Health (SoH)</p>
                <p className="text-lg font-bold">{selectedVehicle.sohPercent}%</p>
              </div>
              <div>
                <p className="text-sm text-[#94a3b8]">Battery</p>
                <p className="text-lg font-bold">{selectedVehicle.batteryCapacityKwh} kWh</p>
              </div>
              <div>
                <p className="text-sm text-[#94a3b8]">Est. Range</p>
                <p className="text-lg font-bold">
                  {Math.round((selectedVehicle.usableBatteryKwh * (selectedVehicle.sohPercent / 100) * (selectedVehicle.socPercent / 100)) / (selectedVehicle.consumptionKwhPer100km / 100))} km
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="font-semibold mb-2">OVMS Integration</h3>
            <p className="text-sm text-[#94a3b8] mb-3">
              Connect your Open Vehicle Monitoring System for real-time data
            </p>
            <Link to="/ovms" className="btn-secondary text-sm inline-block">
              Setup OVMS
            </Link>
          </div>
          <div className="card">
            <h3 className="font-semibold mb-2">EV Community Chat</h3>
            <p className="text-sm text-[#94a3b8] mb-3">
              Talk with other EV drivers on your route
            </p>
            <Link to="/chat" className="btn-secondary text-sm inline-block">
              Open Chat
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
