import { useState, useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useVehicle } from '../context/VehicleContext';
import { searchChargersByLocation } from '../services/openChargeMap';
import { calculateFullRoute, geocodeAddress } from '../services/routeCalculator';
import type { ChargerStation, ConnectorType, RoutePlan } from '../types';
import { CONNECTOR_LABELS } from '../types';

function MapEvents({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitBounds({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
}

export default function RoutePlanPage() {
  const { selectedVehicle } = useVehicle();
  const [startAddress, setStartAddress] = useState('');
  const [endAddress, setEndAddress] = useState('');
  const [startCoords, setStartCoords] = useState<[number, number] | null>(null);
  const [endCoords, setEndCoords] = useState<[number, number] | null>(null);
  const [speed, setSpeed] = useState(100);
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidHighways, setAvoidHighways] = useState(false);
  const [avoidFerries, setAvoidFerries] = useState(false);
  const [preferredConnectors, setPreferredConnectors] = useState<ConnectorType[]>(['ccs', 'type2']);
  const [stations, setStations] = useState<ChargerStation[]>([]);
  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([48.2, 16.3]);
  const [placing, setPlacing] = useState<'start' | 'end' | null>(null);
  const [bounds, setBounds] = useState<[[number, number], [number, number]] | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setMapCenter([pos.coords.latitude, pos.coords.longitude]),
        () => {}
      );
    }
  }, []);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (placing === 'start') {
      setStartCoords([lat, lng]);
      setStartAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      setPlacing(null);
    } else if (placing === 'end') {
      setEndCoords([lat, lng]);
      setEndAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      setPlacing(null);
    }
  }, [placing]);

  const handleGeocode = async (address: string, type: 'start' | 'end') => {
    if (!address.trim()) return;
    const result = await geocodeAddress(address);
    if (result) {
      if (type === 'start') {
        setStartCoords([result.lat, result.lng]);
        setStartAddress(result.displayName);
      } else {
        setEndCoords([result.lat, result.lng]);
        setEndAddress(result.displayName);
      }
    }
  };

  const loadChargers = useCallback(async (lat: number, lng: number) => {
    const data = await searchChargersByLocation(lat, lng, 100, 200, preferredConnectors);
    setStations(data);
  }, [preferredConnectors]);

  const handlePlanRoute = async () => {
    if (!startCoords || !endCoords || !selectedVehicle) return;
    setLoading(true);

    await loadChargers(
      (startCoords[0] + endCoords[0]) / 2,
      (startCoords[1] + endCoords[1]) / 2
    );

    const routeResult = await calculateFullRoute(
      startCoords[0],
      startCoords[1],
      endCoords[0],
      endCoords[1],
      {
        make: selectedVehicle.make,
        model: selectedVehicle.model,
        year: selectedVehicle.year,
        trim: '',
        batteryKwh: selectedVehicle.batteryCapacityKwh,
        usableBatteryKwh: selectedVehicle.usableBatteryKwh,
        consumptionKwhPer100km: selectedVehicle.consumptionKwhPer100km,
        realWorldConsumptionKwhPer100km: selectedVehicle.consumptionKwhPer100km,
        rangeWltpKm: Math.round((selectedVehicle.usableBatteryKwh / selectedVehicle.consumptionKwhPer100km) * 100),
        maxChargePowerDcKw: selectedVehicle.maxChargePowerKw,
        connectorTypes: selectedVehicle.connectorTypes,
        chargingCurve: [{ soc: 0, power: selectedVehicle.maxChargePowerKw }, { soc: 50, power: selectedVehicle.maxChargePowerKw * 0.7 }, { soc: 80, power: selectedVehicle.maxChargePowerKw * 0.4 }, { soc: 100, power: selectedVehicle.maxChargePowerKw * 0.1 }],
      },
      selectedVehicle.socPercent,
      speed,
      avoidTolls,
      avoidHighways,
      avoidFerries,
      selectedVehicle.sohPercent,
      stations,
      preferredConnectors
    );

    if (routeResult) {
      setRoute(routeResult);
      if (routeResult.polyline.length > 0) {
        const lats = routeResult.polyline.map((p) => p[0]);
        const lngs = routeResult.polyline.map((p) => p[1]);
        setBounds([
          [Math.min(...lats), Math.min(...lngs)],
          [Math.max(...lats), Math.max(...lngs)],
        ]);
      }
    }

    setLoading(false);
  };

  const getMarkerIcon = (_color: string) => {
    return L.divIcon({
      className: '',
      html: `<div style="width:24px;height:24px;background:${_color};border:2px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  const getChargerIcon = (status: string) => {
    return L.divIcon({
      className: '',
      html: `<div class="charger-marker ${status}" style="width:20px;height:20px;font-size:10px;color:white;font-weight:bold;">⚡</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  };

  return (
    <div className="h-full flex flex-col md:flex-row">
      <div className="w-full md:w-96 overflow-y-auto p-4 space-y-3 scrollbar-thin bg-[#0f172a] z-10">
        <h2 className="text-lg font-bold">Route Planner</h2>

        {!selectedVehicle && (
          <div className="p-3 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] text-sm">
            Please select a vehicle first
          </div>
        )}

        <div>
          <label className="block text-sm text-[#94a3b8] mb-1">Start Location</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={startAddress}
              onChange={(e) => setStartAddress(e.target.value)}
              onBlur={() => handleGeocode(startAddress, 'start')}
              placeholder="Enter address or click map"
              className="input-field flex-1"
            />
            <button
              onClick={() => setPlacing(placing === 'start' ? null : 'start')}
              className={`px-3 rounded-lg text-sm font-medium ${placing === 'start' ? 'bg-[#10b981] text-white' : 'bg-[#334155] text-[#94a3b8]'}`}
            >
              📍
            </button>
          </div>
          {startCoords && (
            <p className="text-xs text-[#10b981] mt-1">
              {startCoords[0].toFixed(5)}, {startCoords[1].toFixed(5)}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm text-[#94a3b8] mb-1">End Location</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={endAddress}
              onChange={(e) => setEndAddress(e.target.value)}
              onBlur={() => handleGeocode(endAddress, 'end')}
              placeholder="Enter address or click map"
              className="input-field flex-1"
            />
            <button
              onClick={() => setPlacing(placing === 'end' ? null : 'end')}
              className={`px-3 rounded-lg text-sm font-medium ${placing === 'end' ? 'bg-[#ef4444] text-white' : 'bg-[#334155] text-[#94a3b8]'}`}
            >
              📍
            </button>
          </div>
          {endCoords && (
            <p className="text-xs text-[#10b981] mt-1">
              {endCoords[0].toFixed(5)}, {endCoords[1].toFixed(5)}
            </p>
          )}
        </div>

        {placing && (
          <div className="p-2 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] text-sm text-center">
            Click on the map to set {placing} location
          </div>
        )}

        <div>
          <label className="block text-sm text-[#94a3b8] mb-1">Preferred Speed: {speed} km/h</label>
          <input
            type="range"
            min="40"
            max="180"
            value={speed}
            onChange={(e) => setSpeed(parseInt(e.target.value))}
            className="w-full accent-[#10b981]"
          />
          <div className="flex justify-between text-xs text-[#64748b]">
            <span>40</span>
            <span>100</span>
            <span>180</span>
          </div>
        </div>

        <div>
          <label className="block text-sm text-[#94a3b8] mb-2">Charger Connectors</label>
          <div className="flex flex-wrap gap-2">
            {(['ccs', 'type2', 'chademo', 'tesla'] as ConnectorType[]).map((ct) => (
              <button
                key={ct}
                onClick={() => {
                  setPreferredConnectors((prev) =>
                    prev.includes(ct) ? prev.filter((c) => c !== ct) : [...prev, ct]
                  );
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  preferredConnectors.includes(ct)
                    ? 'bg-[#10b981] text-white'
                    : 'bg-[#334155] text-[#94a3b8]'
                }`}
              >
                {CONNECTOR_LABELS[ct]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={avoidTolls} onChange={(e) => setAvoidTolls(e.target.checked)} className="rounded" />
            Avoid tolls
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={avoidHighways} onChange={(e) => setAvoidHighways(e.target.checked)} className="rounded" />
            Avoid highways
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={avoidFerries} onChange={(e) => setAvoidFerries(e.target.checked)} className="rounded" />
            Avoid ferries
          </label>
        </div>

        <button
          onClick={handlePlanRoute}
          disabled={!startCoords || !endCoords || !selectedVehicle || loading}
          className="btn-primary w-full"
        >
          {loading ? 'Calculating route...' : 'Plan Route'}
        </button>

        {route && (
          <div className="card fade-in">
            <h3 className="font-semibold mb-2">Route Summary</h3>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div>
                <p className="text-[#94a3b8]">Distance</p>
                <p className="font-bold">{route.totalDistanceKm} km</p>
              </div>
              <div>
                <p className="text-[#94a3b8]">Duration</p>
                <p className="font-bold">{Math.floor(route.totalTimeMinutes / 60)}h {route.totalTimeMinutes % 60}m</p>
              </div>
              <div>
                <p className="text-[#94a3b8]">Energy</p>
                <p className="font-bold">{route.totalEnergyKwh} kWh</p>
              </div>
              <div>
                <p className="text-[#94a3b8]">Charging Stops</p>
                <p className="font-bold">{route.stops.length}</p>
              </div>
            </div>

            {route.stops.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-[#94a3b8]">Charging Stops</h4>
                {route.stops.map((stop, i) => (
                  <div key={i} className="p-2 rounded-lg bg-[#0f172a] text-sm">
                    <p className="font-medium">{stop.chargerStation.name}</p>
                    <div className="flex justify-between text-xs text-[#94a3b8] mt-1">
                      <span>Arrive: {stop.arrivalSocPercent}% SoC</span>
                      <span>Depart: {stop.departureSocPercent}% SoC</span>
                    </div>
                    <div className="flex justify-between text-xs text-[#94a3b8]">
                      <span>Charge time: ~{stop.chargeTimeMinutes} min</span>
                      <span>Power: {stop.selectedConnection.powerKw} kW</span>
                    </div>
                    <p className="text-xs text-[#94a3b8] mt-1">
                      {stop.chargerStation.connections.map((c) => CONNECTOR_LABELS[c.type]).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 h-64 md:h-full">
        <MapContainer
          center={mapCenter}
          zoom={8}
          className="h-full w-full"
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapEvents onMapClick={handleMapClick} />
          {bounds && <FitBounds bounds={bounds} />}

          {startCoords && <Marker position={startCoords} icon={getMarkerIcon('#10b981')} />}
          {endCoords && <Marker position={endCoords} icon={getMarkerIcon('#ef4444')} />}

          {route && route.polyline.length > 0 && (
            <Polyline
              positions={route.polyline}
              pathOptions={{ color: '#10b981', weight: 4, dashArray: '8 4' }}
            />
          )}

          {stations.map((station) => (
            <Marker
              key={station.id}
              position={[station.latitude, station.longitude]}
              icon={getChargerIcon(station.status)}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <p className="font-bold text-sm">{station.name}</p>
                  <p className="text-xs text-gray-500">{station.address}, {station.city}</p>
                  <div className="mt-1">
                    {station.connections.map((c, i) => (
                      <p key={i} className="text-xs">
                        {CONNECTOR_LABELS[c.type]} - {c.powerKw} kW
                      </p>
                    ))}
                  </div>
                  <p className="text-xs mt-1">
                    <span className={`font-medium ${
                      station.status === 'available' ? 'text-green-600' :
                      station.status === 'busy' ? 'text-yellow-600' :
                      station.status === 'offline' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {station.status === 'available' ? 'Available' :
                       station.status === 'busy' ? 'Busy' :
                       station.status === 'offline' ? 'Offline' : 'Unknown'}
                    </span>
                    {station.rating > 0 && <span className="ml-2">⭐ {station.rating.toFixed(1)}</span>}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
