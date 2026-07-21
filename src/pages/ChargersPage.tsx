import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { searchChargersByBounds } from '../services/openChargeMap';
import type { ChargerStation, ConnectorType, ChargerStatus } from '../types';
import { CONNECTOR_LABELS, STATUS_LABELS } from '../types';

function MapLoader({ onReady }: { onReady: (bounds: any) => void }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      const b = map.getBounds();
      onReady({
        sw: [b.getSouthWest().lat, b.getSouthWest().lng],
        ne: [b.getNorthEast().lat, b.getNorthEast().lng],
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [map, onReady]);
  return null;
}

function MapEvents({ onMoveEnd }: { onMoveEnd: (bounds: any) => void }) {
  useMapEvents({
    moveend(e) {
      const map = e.target;
      const b = map.getBounds();
      onMoveEnd({
        sw: [b.getSouthWest().lat, b.getSouthWest().lng],
        ne: [b.getNorthEast().lat, b.getNorthEast().lng],
      });
    },
  });
  return null;
}

export default function ChargersPage() {
  const [stations, setStations] = useState<ChargerStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStation, setSelectedStation] = useState<ChargerStation | null>(null);
  const [filterStatus, setFilterStatus] = useState<ChargerStatus | 'all'>('all');
  const [filterConnectors, setFilterConnectors] = useState<ConnectorType[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([45.81, 15.98]); // Zagreb, Croatia
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setMapCenter([pos.coords.latitude, pos.coords.longitude]),
        () => {}
      );
    }
  }, []);

  const loadChargers = useCallback(async (bounds: any) => {
    setLoading(true);
    try {
      const data = await searchChargersByBounds(
        bounds.sw[0], bounds.sw[1],
        bounds.ne[0], bounds.ne[1],
        200,
        filterConnectors.length > 0 ? filterConnectors : undefined
      );
      setStations(data);
    } catch (err) {
      console.error('Failed to load chargers:', err);
      // Retry with location-based search as fallback
      try {
        const centerLat = (bounds.sw[0] + bounds.ne[0]) / 2;
        const centerLng = (bounds.sw[1] + bounds.ne[1]) / 2;
        const { searchChargersByLocation } = await import('../services/openChargeMap');
        const data = await searchChargersByLocation(centerLat, centerLng, 50, 200, filterConnectors.length > 0 ? filterConnectors : undefined);
        setStations(data);
      } catch (retryErr) {
        console.error('Retry also failed:', retryErr);
      }
    }
    setLoading(false);
    setInitialLoad(false);
  }, [filterConnectors]);

  const handleMapReady = useCallback((bounds: any) => {
    loadChargers(bounds);
  }, [loadChargers]);

  const handleMoveEnd = useCallback((bounds: any) => {
    loadChargers(bounds);
  }, [loadChargers]);

  const filteredStations = stations.filter((s) => {
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    return true;
  });

  const getChargerIcon = (status: string) => {
    const color = status === 'available' ? '#22c55e' : status === 'busy' ? '#f59e0b' : status === 'offline' ? '#ef4444' : '#6b7280';
    return L.divIcon({
      className: '',
      html: `<div class="charger-marker ${status}" style="width:22px;height:22px;font-size:11px;color:white;font-weight:bold;display:flex;align-items:center;justify-content:center;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);background:${color};">⚡</div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  };

  return (
    <div className="h-full flex flex-col md:flex-row relative">
      <div className="w-full md:w-80 overflow-y-auto p-4 space-y-3 scrollbar-thin bg-[#0f172a] z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Find Chargers</h2>
          <span className="text-sm text-[#94a3b8]">{filteredStations.length} found</span>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-[#94a3b8]">
            <div className="w-4 h-4 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin" />
            Loading chargers...
          </div>
        )}

        {!loading && initialLoad && (
          <div className="p-3 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] text-sm">
            Loading chargers for your area... Move the map to explore more.
          </div>
        )}

        <div>
          <label className="block text-sm text-[#94a3b8] mb-2">Status Filter</label>
          <div className="flex flex-wrap gap-1">
            {(['all', 'available', 'busy', 'offline', 'unknown'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                  filterStatus === status
                    ? 'bg-[#10b981] text-white'
                    : 'bg-[#334155] text-[#94a3b8]'
                }`}
              >
                {status === 'all' ? 'All' : STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-[#94a3b8] mb-2">Connector Types</label>
          <div className="flex flex-wrap gap-1">
            {(['ccs', 'type2', 'chademo', 'tesla'] as ConnectorType[]).map((ct) => (
              <button
                key={ct}
                onClick={() => {
                  setFilterConnectors((prev) =>
                    prev.includes(ct) ? prev.filter((c) => c !== ct) : [...prev, ct]
                  );
                }}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                  filterConnectors.includes(ct)
                    ? 'bg-[#3b82f6] text-white'
                    : 'bg-[#334155] text-[#94a3b8]'
                }`}
              >
                {CONNECTOR_LABELS[ct]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 max-h-[40vh] overflow-y-auto scrollbar-thin">
          {filteredStations.slice(0, 50).map((station) => {
            const dcConns = station.connections.filter((c) => c.level === 3 || c.powerKw >= 20);
            const maxDcPower = dcConns.length > 0 ? Math.max(...dcConns.map((c) => c.powerKw)) : 0;
            return (
              <div
                key={station.id}
                className={`card cursor-pointer transition-all ${
                  selectedStation?.id === station.id ? 'border-[#10b981]' : 'hover:border-[#64748b]'
                }`}
                onClick={() => setSelectedStation(station)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{station.name}</p>
                    <p className="text-xs text-[#64748b] truncate">{station.operators[0] || 'Unknown operator'}</p>
                    <p className="text-xs text-[#94a3b8] truncate">{station.city}, {station.country}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {maxDcPower > 0 && (
                        <span className="badge badge-yellow text-[10px]">DC {maxDcPower}kW</span>
                      )}
                      {station.connections.filter((c) => c.level !== 3 && c.powerKw < 20).length > 0 && (
                        <span className="badge badge-blue text-[10px]">AC</span>
                      )}
                      {station.connections.slice(0, 2).map((c, i) => (
                        <span key={i} className="badge badge-blue text-[10px]">
                          {CONNECTOR_LABELS[c.type]} {c.powerKw}kW
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className={`badge ${
                    station.status === 'available' ? 'badge-green' :
                    station.status === 'busy' ? 'badge-yellow' :
                    station.status === 'offline' ? 'badge-red' : 'badge-gray'
                  }`}>
                    {STATUS_LABELS[station.status]}
                  </span>
                </div>
                {station.rating > 0 && (
                  <p className="text-xs text-[#94a3b8] mt-1">
                    ⭐ {station.rating.toFixed(1)} ({station.reviewCount} reviews)
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 h-64 md:h-full relative">
        <MapContainer
          center={mapCenter}
          zoom={12}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapLoader onReady={handleMapReady} />
          <MapEvents onMoveEnd={handleMoveEnd} />

          {filteredStations.map((station) => (
            <Marker
              key={station.id}
              position={[station.latitude, station.longitude]}
              icon={getChargerIcon(station.status)}
              eventHandlers={{
                click: () => setSelectedStation(station),
              }}
            >
              <Popup>
                <div className="min-w-[240px]">
                  <p className="font-bold text-sm">{station.name}</p>
                  <p className="text-xs text-gray-500">{station.address}</p>
                  <p className="text-xs text-gray-500">{station.city}, {station.country}</p>

                  {station.operators[0] && (
                    <p className="text-xs font-medium text-blue-600 mt-1">{station.operators[0]}</p>
                  )}

                  <div className="mt-2 space-y-0.5">
                    {station.connections.map((c, i) => {
                      const levelLabel = c.level === 3 ? 'DC' : c.level === 2 ? 'AC' : '';
                      return (
                        <p key={i} className="text-xs">
                          <span className={`font-medium ${c.level === 3 ? 'text-orange-600' : 'text-blue-600'}`}>
                            {levelLabel}
                          </span>{' '}
                          {CONNECTOR_LABELS[c.type]} - {c.powerKw} kW
                          {c.current > 0 && <span className="text-gray-400"> ({c.current}A)</span>}
                        </p>
                      );
                    })}
                  </div>

                  <div className="mt-2 text-xs">
                    <span className={`font-medium ${
                      station.status === 'available' ? 'text-green-600' :
                      station.status === 'busy' ? 'text-yellow-600' :
                      station.status === 'offline' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {STATUS_LABELS[station.status]}
                    </span>
                    {station.rating > 0 && <span className="ml-2">⭐ {station.rating.toFixed(1)}</span>}
                  </div>

                  {station.costInfo && (
                    <p className="text-xs text-gray-400 mt-1">{station.costInfo}</p>
                  )}

                  <div className="flex flex-wrap gap-1 mt-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                    >
                      Navigate
                    </a>
                    {station.ocmId && (
                      <>
                        <a
                          href={`https://www.plugshare.com/location/${station.ocmId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] bg-orange-500 text-white px-2 py-1 rounded hover:bg-orange-600"
                        >
                          PlugShare
                        </a>
                        <a
                          href={`https://abetterrouteplanner.com/?plugs=${station.ocmId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600"
                        >
                          ABRP
                        </a>
                      </>
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
