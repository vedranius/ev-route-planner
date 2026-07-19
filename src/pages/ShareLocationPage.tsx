import { useState, useEffect } from 'react';
import { db, isFirebaseConfigured } from '../config/firebase';
import { ref, set, onValue, update } from 'firebase/database';
import { useAuth } from '../context/AuthContext';
import { useVehicle } from '../context/VehicleContext';
import { QRCodeSVG } from 'qrcode.react';
import type { LocationShare } from '../types';

const DEMO_SHARE_KEY = 'evrp_demo_share';

export default function ShareLocationPage() {
  const { currentUser, userData } = useAuth();
  const { selectedVehicle } = useVehicle();
  const [isSharing, setIsSharing] = useState(false);
  const [shareId, setShareId] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [speed, setSpeed] = useState(0);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [expiresIn, setExpiresIn] = useState(60);
  const [viewingShareId, setViewingShareId] = useState('');
  const [sharedLocation, setSharedLocation] = useState<LocationShare | null>(null);
  const [mode, setMode] = useState<'share' | 'view'>('share');

  useEffect(() => {
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [watchId]);

  const startSharing = async () => {
    if (!currentUser) return;

    const id = `share-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const url = `${window.location.origin}${window.location.pathname}#/view/${id}`;

    setShareId(id);
    setShareUrl(url);

    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc);
        setSpeed(pos.coords.speed || 0);

        const shareData: LocationShare = {
          id,
          userId: currentUser.uid,
          userName: userData?.displayName || 'Anonymous',
          vehicleName: selectedVehicle?.name,
          latitude: loc.lat,
          longitude: loc.lng,
          speed: pos.coords.speed || 0,
          heading: pos.coords.heading || 0,
          batteryPercent: selectedVehicle?.socPercent || 0,
          estimatedRangeKm: selectedVehicle
            ? Math.round((selectedVehicle.usableBatteryKwh * (selectedVehicle.sohPercent / 100) * (selectedVehicle.socPercent / 100)) / (selectedVehicle.consumptionKwhPer100km / 100))
            : 0,
          timestamp: Date.now(),
          isActive: true,
          expiresAt: Date.now() + expiresIn * 60 * 1000,
        };

        if (isFirebaseConfigured && db) {
          set(ref(db, `locationShares/${id}`), shareData);
        } else {
          localStorage.setItem(`${DEMO_SHARE_KEY}_${id}`, JSON.stringify(shareData));
        }
      },
      (err) => {
        console.error('Geolocation error:', err);
        // Fallback: use a default location for demo
        const demoLoc = { lat: 45.815, lng: 15.982 }; // Zagreb
        setLocation(demoLoc);

        const shareData: LocationShare = {
          id,
          userId: currentUser.uid,
          userName: userData?.displayName || 'Anonymous',
          vehicleName: selectedVehicle?.name,
          latitude: demoLoc.lat,
          longitude: demoLoc.lng,
          speed: 0,
          heading: 0,
          batteryPercent: selectedVehicle?.socPercent || 0,
          estimatedRangeKm: selectedVehicle
            ? Math.round((selectedVehicle.usableBatteryKwh * (selectedVehicle.sohPercent / 100) * (selectedVehicle.socPercent / 100)) / (selectedVehicle.consumptionKwhPer100km / 100))
            : 0,
          timestamp: Date.now(),
          isActive: true,
          expiresAt: Date.now() + expiresIn * 60 * 1000,
        };

        if (isFirebaseConfigured && db) {
          set(ref(db, `locationShares/${id}`), shareData);
        } else {
          localStorage.setItem(`${DEMO_SHARE_KEY}_${id}`, JSON.stringify(shareData));
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    setWatchId(watch);
    setIsSharing(true);
  };

  const stopSharing = async () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    if (shareId) {
      if (isFirebaseConfigured && db) {
        await update(ref(db, `locationShares/${shareId}`), { isActive: false });
      } else {
        const stored = localStorage.getItem(`${DEMO_SHARE_KEY}_${shareId}`);
        if (stored) {
          const data = JSON.parse(stored);
          data.isActive = false;
          localStorage.setItem(`${DEMO_SHARE_KEY}_${shareId}`, JSON.stringify(data));
        }
      }
    }
    setIsSharing(false);
    setShareId('');
    setShareUrl('');
    setLocation(null);
  };

  const viewSharedLocation = (id: string) => {
    if (isFirebaseConfigured && db) {
      const locRef = ref(db, `locationShares/${id}`);
      onValue(locRef, (snapshot) => {
        if (snapshot.exists()) {
          setSharedLocation(snapshot.val() as LocationShare);
        } else {
          setSharedLocation(null);
        }
      });
    } else {
      const stored = localStorage.getItem(`${DEMO_SHARE_KEY}_${id}`);
      if (stored) {
        setSharedLocation(JSON.parse(stored));
      } else {
        setSharedLocation(null);
      }
    }
  };

  const shareToWhatsApp = () => {
    const text = encodeURIComponent(`Track my EV location: ${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareToTelegram = () => {
    const text = encodeURIComponent(`Track my EV location: ${shareUrl}`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${text}`, '_blank');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-1">Share Location</h2>
      <p className="text-[#94a3b8] mb-6">
        Share your real-time location with friends and family
        {!isFirebaseConfigured && <span className="text-[#f59e0b]"> (Demo Mode)</span>}
      </p>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('share')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            mode === 'share' ? 'bg-[#10b981] text-white' : 'bg-[#334155] text-[#94a3b8]'
          }`}
        >
          Share My Location
        </button>
        <button
          onClick={() => setMode('view')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            mode === 'view' ? 'bg-[#10b981] text-white' : 'bg-[#334155] text-[#94a3b8]'
          }`}
        >
          View Shared Location
        </button>
      </div>

      {mode === 'share' && (
        <div className="space-y-4">
          {!isSharing ? (
            <div className="card">
              <h3 className="font-semibold mb-3">Start Sharing</h3>
              <div className="mb-3">
                <label className="block text-sm text-[#94a3b8] mb-1">
                  Share expires in: {expiresIn} minutes
                </label>
                <input
                  type="range"
                  min="15"
                  max="480"
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(parseInt(e.target.value))}
                  className="w-full accent-[#10b981]"
                />
                <div className="flex justify-between text-xs text-[#64748b]">
                  <span>15 min</span>
                  <span>8 hours</span>
                </div>
              </div>
              <button onClick={startSharing} className="btn-primary w-full">
                Start Sharing Location
              </button>
            </div>
          ) : (
            <div className="card fade-in">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 bg-[#22c55e] rounded-full pulse-green" />
                <h3 className="font-semibold">Sharing Active</h3>
              </div>

              {location && (
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div>
                    <p className="text-[#94a3b8]">Latitude</p>
                    <p className="font-mono">{location.lat.toFixed(5)}</p>
                  </div>
                  <div>
                    <p className="text-[#94a3b8]">Longitude</p>
                    <p className="font-mono">{location.lng.toFixed(5)}</p>
                  </div>
                  <div>
                    <p className="text-[#94a3b8]">Speed</p>
                    <p className="font-bold">{Math.round(speed * 3.6)} km/h</p>
                  </div>
                  <div>
                    <p className="text-[#94a3b8]">Battery</p>
                    <p className="font-bold">{selectedVehicle?.socPercent || 0}%</p>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm text-[#94a3b8] mb-2">Share Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="input-field text-xs"
                  />
                  <button onClick={copyLink} className="btn-secondary text-xs px-3">
                    Copy
                  </button>
                </div>
              </div>

              <div className="flex justify-center mb-4">
                <QRCodeSVG value={shareUrl} size={150} bgColor="#1e293b" fgColor="#10b981" />
              </div>

              <div className="flex gap-2 mb-4">
                <button onClick={shareToWhatsApp} className="btn-secondary flex-1 text-xs">
                  WhatsApp
                </button>
                <button onClick={shareToTelegram} className="btn-secondary flex-1 text-xs">
                  Telegram
                </button>
              </div>

              <button onClick={stopSharing} className="btn-danger w-full">
                Stop Sharing
              </button>
            </div>
          )}
        </div>
      )}

      {mode === 'view' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold mb-3">View Shared Location</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={viewingShareId}
                onChange={(e) => setViewingShareId(e.target.value)}
                placeholder="Paste share ID or URL..."
                className="input-field flex-1"
              />
              <button
                onClick={() => viewSharedLocation(viewingShareId)}
                className="btn-primary text-sm"
              >
                Track
              </button>
            </div>
          </div>

          {sharedLocation && sharedLocation.isActive && (
            <div className="card fade-in">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 bg-[#22c55e] rounded-full pulse-green" />
                <h3 className="font-semibold">{sharedLocation.userName}</h3>
                {sharedLocation.vehicleName && (
                  <span className="badge badge-blue">{sharedLocation.vehicleName}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div>
                  <p className="text-[#94a3b8]">Speed</p>
                  <p className="font-bold">{Math.round(sharedLocation.speed * 3.6)} km/h</p>
                </div>
                <div>
                  <p className="text-[#94a3b8]">Battery</p>
                  <p className="font-bold">{sharedLocation.batteryPercent}%</p>
                </div>
                <div>
                  <p className="text-[#94a3b8]">Est. Range</p>
                  <p className="font-bold">{sharedLocation.estimatedRangeKm} km</p>
                </div>
                <div>
                  <p className="text-[#94a3b8]">Last Update</p>
                  <p className="font-bold">{new Date(sharedLocation.timestamp).toLocaleTimeString()}</p>
                </div>
              </div>

              <a
                href={`https://www.openstreetmap.org/?mlat=${sharedLocation.latitude}&mlon=${sharedLocation.longitude}#map=14/${sharedLocation.latitude}/${sharedLocation.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary w-full text-center text-sm"
              >
                View on Map
              </a>
            </div>
          )}

          {sharedLocation && !sharedLocation.isActive && (
            <div className="card">
              <p className="text-[#94a3b8] text-center">This location share has expired or is no longer active.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
