import { useState, useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useVehicle } from '../context/VehicleContext';
import { searchChargersByLocation } from '../services/openChargeMap';
import { calculateFullRoute, getOSRMRoute } from '../services/routeCalculator';
import type { ChargerStation, ConnectorType, RoutePlan } from '../types';
import { CONNECTOR_LABELS, STATUS_LABELS } from '../types';

interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

function LocationSearch({
  label,
  value,
  onChange,
  onSelect,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSelect: (coords: [number, number], address: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (query: string) => {
    onChange(query);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        // Try regional search first (Croatia and neighbors), then fallback
        const urls = [
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1&countrycodes=hr,si,ba,rs,me,mk,al`,
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
        ];

        let results: GeocodeResult[] = [];
        for (const url of urls) {
          const response = await fetch(url);
          if (!response.ok) continue;
          const data = await response.json();
          if (data.length > 0) {
            results = data.map((item: any) => ({
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              displayName: item.display_name,
            }));
            break;
          }
        }
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (err) {
        console.error('Autocomplete error:', err);
      }
      setSearching(false);
    }, 400);
  };

  const handleSelect = (result: GeocodeResult) => {
    onChange(result.displayName);
    onSelect([result.lat, result.lng], result.displayName);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        // Reverse geocode to get address
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords[0]}&lon=${coords[1]}`)
          .then((r) => r.json())
          .then((data) => {
            const addr = data.display_name || 'My current location';
            onChange(addr);
            onSelect(coords, addr);
          })
          .catch(() => {
            onChange('My current location');
            onSelect(coords, 'My current location');
          });
      },
      (err) => {
        console.error('Geolocation error:', err);
        if (err.code === 1) {
          alert('Location access denied. Please allow location access in your browser settings and try again.');
        } else if (err.code === 2) {
          alert('Unable to determine your location. Please enter an address manually.');
        } else {
          alert('Location request timed out. Please enter an address manually.');
        }
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm text-[#94a3b8] mb-1">{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Search address..."
            className="input-field pr-6"
          />
          {searching && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <div className="w-3 h-3 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <button
          onClick={handleUseMyLocation}
          className="px-3 rounded-lg bg-[#334155] text-[#94a3b8] hover:bg-[#475569] hover:text-white transition-colors text-sm font-medium"
          title="Use my current location"
        >
          📍
        </button>
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-[#1e293b] border border-[#334155] rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSelect(s)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-[#334155] transition-colors border-b border-[#334155] last:border-b-0"
            >
              <p className="text-[#f1f5f9] truncate">{s.displayName.split(',').slice(0, 3).join(',')}</p>
              <p className="text-[10px] text-[#64748b]">{s.lat.toFixed(5)}, {s.lng.toFixed(5)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MapEventsHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
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
  const [mapCenter, setMapCenter] = useState<[number, number]>([45.81, 15.98]);
  const [placing, setPlacing] = useState<'start' | 'end' | null>(null);
  const [bounds, setBounds] = useState<[[number, number], [number, number]] | null>(null);
  const [error, setError] = useState('');
  const [waypoints, setWaypoints] = useState<ChargerStation[]>([]);

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

  const handleStartSelect = (coords: [number, number], address: string) => {
    setStartCoords(coords);
    setStartAddress(address);
  };

  const handleEndSelect = (coords: [number, number], address: string) => {
    setEndCoords(coords);
    setEndAddress(address);
  };

  const handleAddWaypoint = useCallback((station: ChargerStation) => {
    setWaypoints((prev) => {
      if (prev.some((w) => w.id === station.id)) return prev;
      return [...prev, station];
    });
  }, []);

  const handleRemoveWaypoint = useCallback((stationId: string) => {
    setWaypoints((prev) => prev.filter((w) => w.id !== stationId));
  }, []);

  const handlePlanRoute = async () => {
    if (!startCoords || !endCoords || !selectedVehicle) {
      setError('Please set both start and end locations and select a vehicle.');
      return;
    }
    setError('');
    setLoading(true);

    // Build route coordinates: start → waypoints → end
    const allCoords: [number, number][] = [startCoords, ...waypoints.map((w) => [w.latitude, w.longitude] as [number, number]), endCoords];

    // First get the route to know the path
    const rawRoute = await getOSRMRoute(
      allCoords,
      avoidTolls,
      avoidHighways,
      avoidFerries
    );

    if (!rawRoute) {
      setError('Could not calculate route. Please check your start and end locations.');
      setLoading(false);
      return;
    }

    // Load chargers along the ENTIRE route
    const loadedStations = await loadChargersAlongRoute(rawRoute.geometry);

    // Merge manual waypoints with auto-found chargers
    const allStations = [...loadedStations];
    for (const wp of waypoints) {
      if (!allStations.some((s) => s.id === wp.id)) {
        allStations.push(wp);
      }
    }

    // Now calculate the full route with charging stops
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
        chargingCurve: [
          { soc: 0, power: selectedVehicle.maxChargePowerKw },
          { soc: 50, power: selectedVehicle.maxChargePowerKw * 0.7 },
          { soc: 80, power: selectedVehicle.maxChargePowerKw * 0.4 },
          { soc: 100, power: selectedVehicle.maxChargePowerKw * 0.1 },
        ],
      },
      selectedVehicle.socPercent,
      speed,
      avoidTolls,
      avoidHighways,
      avoidFerries,
      selectedVehicle.sohPercent,
      allStations,
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
    } else {
      setError('Could not calculate route. Please check your start and end locations.');
    }

    setLoading(false);
  };

  const loadChargersAlongRoute = useCallback(async (routeCoords: [number, number][]): Promise<ChargerStation[]> => {
    // Sample points every ~50km along the route
    const SAMPLE_INTERVAL_KM = 50;
    const SEARCH_RADIUS_KM = 30;
    const allStations = new Map<string, ChargerStation>();

    let accumulatedKm = 0;

    for (let i = 0; i < routeCoords.length - 1; i++) {
      const lat1 = routeCoords[i][0], lng1 = routeCoords[i][1];
      const lat2 = routeCoords[i + 1][0], lng2 = routeCoords[i + 1][1];

      const segDist = haversine(lat1, lng1, lat2, lng2);
      accumulatedKm += segDist;

      if (accumulatedKm >= SAMPLE_INTERVAL_KM || i === 0 || i === routeCoords.length - 2) {
        accumulatedKm = 0;
        try {
          const stations = await searchChargersByLocation(lat1, lng1, SEARCH_RADIUS_KM, 100, preferredConnectors);
          for (const s of stations) {
            if (!allStations.has(s.id)) {
              allStations.set(s.id, s);
            }
          }
        } catch {
          // Continue on error
        }
      }
    }

    const result = Array.from(allStations.values());
    setStations(result);
    return result;
  }, [preferredConnectors]);

  function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const getMarkerIcon = (color: string) => {
    return L.divIcon({
      className: '',
      html: `<div style="width:24px;height:24px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
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
            Please select a vehicle first from Dashboard
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] text-sm">
            {error}
          </div>
        )}

        <LocationSearch
          label="Start Location"
          value={startAddress}
          onChange={setStartAddress}
          onSelect={handleStartSelect}
        />

        {placing && (
          <div className="p-2 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] text-sm text-center">
            Click on the map to set {placing} location
          </div>
        )}

        {!placing && (
          <div className="flex gap-2">
            <button
              onClick={() => setPlacing('start')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                startCoords ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'bg-[#334155] text-[#94a3b8]'
              }`}
            >
              🟢 Set Start on Map
            </button>
            <button
              onClick={() => setPlacing('end')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                endCoords ? 'bg-[#ef4444]/20 text-[#ef4444]' : 'bg-[#334155] text-[#94a3b8]'
              }`}
            >
              🔴 Set End on Map
            </button>
          </div>
        )}

        <LocationSearch
          label="End Location"
          value={endAddress}
          onChange={setEndAddress}
          onSelect={handleEndSelect}
        />

        {startCoords && (
          <p className="text-xs text-[#10b981]">
            Start: {startCoords[0].toFixed(5)}, {startCoords[1].toFixed(5)}
          </p>
        )}
        {endCoords && (
          <p className="text-xs text-[#ef4444]">
            End: {endCoords[0].toFixed(5)}, {endCoords[1].toFixed(5)}
          </p>
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

        {waypoints.length > 0 && (
          <div className="card">
            <h3 className="text-sm font-semibold mb-2 text-[#f59e0b]">Charging Stops ({waypoints.length})</h3>
            <p className="text-[10px] text-[#64748b] mb-2">Click chargers on map and "Add to Route" to plan charging stops</p>
            <div className="space-y-1.5">
              {waypoints.map((wp, i) => (
                <div key={wp.id} className="flex items-center justify-between p-2 rounded bg-[#1e293b] text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[#f59e0b] font-bold">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="font-medium truncate text-[#f1f5f9]">{wp.name}</p>
                      <p className="text-[10px] text-[#64748b] truncate">
                        {wp.connections.filter((c) => c.level === 3).map((c) => `${CONNECTOR_LABELS[c.type]} ${c.powerKw}kW`).join(', ') || 'AC'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveWaypoint(wp.id)}
                    className="text-[#ef4444] hover:text-[#f87171] text-sm shrink-0 ml-2"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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

            {/* Cross-app links */}
            <div className="flex flex-wrap gap-1.5 mb-3 pt-1 border-t border-[#334155]">
              {startCoords && endCoords && (
                <a
                  href={`https://abetterrouteplanner.com/?plan_uuid=new&lat_o=${startCoords[0]}&lng_o=${startCoords[1]}&lat_d=${endCoords[0]}&lng_d=${endCoords[1]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 font-medium"
                  title="Cross-check this route in ABRP"
                >
                  Open in ABRP ↗
                </a>
              )}
              {startCoords && (
                <a
                  href={`https://www.plugshare.com/?latitude=${startCoords[0]}&longitude=${startCoords[1]}&zoom=10`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 font-medium"
                  title="Browse chargers along route on PlugShare"
                >
                  PlugShare Map ↗
                </a>
              )}
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
                    <div className="flex gap-1.5 mt-1.5">
                      <a
                        href={`https://www.plugshare.com/?latitude=${stop.chargerStation.latitude}&longitude=${stop.chargerStation.longitude}&zoom=16`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded hover:bg-orange-500/30"
                        title="Reviews on PlugShare"
                      >
                        PlugShare ↗
                      </a>
                      {stop.chargerStation.ocmId && (
                        <a
                          href={`https://abetterrouteplanner.com/?charger=${stop.chargerStation.ocmId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded hover:bg-purple-500/30"
                          title="View in ABRP"
                        >
                          ABRP ↗
                        </a>
                      )}
                    </div>
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
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapEventsHandler onMapClick={handleMapClick} />
          {bounds && <FitBounds bounds={bounds} />}

          {startCoords && <Marker position={startCoords} icon={getMarkerIcon('#10b981')} />}
          {endCoords && <Marker position={endCoords} icon={getMarkerIcon('#ef4444')} />}

          {waypoints.map((wp) => (
            <Marker
              key={`wp-${wp.id}`}
              position={[wp.latitude, wp.longitude]}
              icon={L.divIcon({
                className: '',
                html: `<div style="width:28px;height:28px;background:#f59e0b;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;">⚡</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
              })}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <p className="font-bold text-sm">{wp.name}</p>
                  <p className="text-xs text-gray-500">{wp.city}</p>
                  <p className="text-xs text-orange-600 font-medium mt-1">Charging Stop #{waypoints.indexOf(wp) + 1}</p>
                  <button
                    onClick={() => handleRemoveWaypoint(wp.id)}
                    className="mt-2 text-[10px] bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                  >
                    Remove from Route
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

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
                <div className="min-w-[220px]">
                  <p className="font-bold text-sm">{station.name}</p>
                  <p className="text-xs text-gray-500">{station.address}, {station.city}</p>
                  {station.operators[0] && (
                    <p className="text-xs font-medium text-blue-600 mt-0.5">{station.operators[0]}</p>
                  )}
                  <div className="mt-1 space-y-0.5">
                    {station.connections.map((c, i) => {
                      const levelLabel = c.level === 3 ? 'DC' : c.level === 2 ? 'AC' : '';
                      return (
                        <p key={i} className="text-xs">
                          <span className={`font-medium ${c.level === 3 ? 'text-orange-600' : 'text-blue-600'}`}>
                            {levelLabel}
                          </span>{' '}
                          {CONNECTOR_LABELS[c.type]} - {c.powerKw} kW
                        </p>
                      );
                    })}
                  </div>
                  <p className="text-xs mt-1">
                    <span className={`font-medium ${
                      station.status === 'available' ? 'text-green-600' :
                      station.status === 'busy' ? 'text-yellow-600' :
                      station.status === 'offline' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {STATUS_LABELS[station.status]}
                    </span>
                    {station.rating > 0 && <span className="ml-2">⭐ {station.rating.toFixed(1)}</span>}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <button
                      onClick={() => {
                        if (waypoints.some((w) => w.id === station.id)) {
                          handleRemoveWaypoint(station.id);
                        } else {
                          handleAddWaypoint(station);
                        }
                      }}
                      className={`text-[10px] px-2 py-1 rounded font-medium ${
                        waypoints.some((w) => w.id === station.id)
                          ? 'bg-[#f59e0b] text-white hover:bg-[#d97706]'
                          : 'bg-[#22c55e] text-white hover:bg-[#16a34a]'
                      }`}
                    >
                      {waypoints.some((w) => w.id === station.id) ? '✓ In Route' : '+ Add to Route'}
                    </button>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                    >
                      Navigate
                    </a>
                    <a
                      href={`https://www.plugshare.com/?latitude=${station.latitude}&longitude=${station.longitude}&zoom=16`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] bg-orange-500 text-white px-2 py-1 rounded hover:bg-orange-600"
                      title="Reviews & check-ins on PlugShare"
                    >
                      PlugShare ↗
                    </a>
                    {station.ocmId && (
                      <a
                        href={`https://abetterrouteplanner.com/?charger=${station.ocmId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600"
                        title="View charger in ABRP"
                      >
                        ABRP ↗
                      </a>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
