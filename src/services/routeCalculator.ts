import type { ChargerStation, ConnectorType, RouteStop, RoutePlan } from '../types';
import type { VehicleSpec } from '../data/vehicles';

const OSRM_BASE = 'https://router.project-osrm.org';

interface RouteSegment {
  distance: number;
  duration: number;
  geometry: [number, number][];
  legs: any[];
}

export async function getOSRMRoute(
  coords: [number, number][],
  avoidTolls: boolean,
  avoidHighways: boolean,
  avoidFerries: boolean
): Promise<RouteSegment | null> {
  const coordsStr = coords.map((c) => `${c[1]},${c[0]}`).join(';');
  const steps = 'true';
  const overview = 'full';
  const geometries = 'geojson';

  const annotations = 'duration,distance,speed';

  let exclude: string[] = [];
  if (avoidTolls) exclude.push('toll');
  if (avoidHighways) exclude.push('motorway');
  if (avoidFerries) exclude.push('ferry');

  let url = `${OSRM_BASE}/route/v1/driving/${coordsStr}?steps=${steps}&overview=${overview}&geometries=${geometries}&annotations=${annotations}`;
  if (exclude.length > 0) {
    url += `&exclude=${exclude.join(',')}`;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`OSRM API error: ${response.status}`);
    const data = await response.json();

    if (!data.routes || data.routes.length === 0) return null;

    const route = data.routes[0];
    // GeoJSON returns [lng, lat] but Leaflet expects [lat, lng]
    const coords: [number, number][] = route.geometry.coordinates.map(
      (c: [number, number]) => [c[1], c[0]]
    );

    return {
      distance: route.distance / 1000,
      duration: route.duration / 60,
      geometry: coords,
      legs: route.legs,
    };
  } catch (err) {
    console.error('OSRM route error:', err);
    return null;
  }
}

function calculateEnergyForSegment(
  distanceKm: number,
  consumptionPer100km: number,
  speedKmh: number
): number {
  const baseConsumption = consumptionPer100km;

  const speedFactor = calculateSpeedFactor(speedKmh);

  return (distanceKm * baseConsumption * speedFactor) / 100;
}

function calculateSpeedFactor(speedKmh: number): number {
  if (speedKmh <= 60) return 0.8;
  if (speedKmh <= 80) return 0.85;
  if (speedKmh <= 100) return 1.0;
  if (speedKmh <= 120) return 1.15;
  if (speedKmh <= 140) return 1.35;
  return 1.6;
}

function estimateChargeTime(
  currentSocPercent: number,
  targetSocPercent: number,
  maxPowerKw: number,
  batteryKwh: number,
  chargingCurve: { soc: number; power: number }[]
): number {
  if (targetSocPercent <= currentSocPercent) return 0;

  let totalMinutes = 0;
  const stepPercent = 1;

  for (let soc = currentSocPercent; soc < targetSocPercent; soc += stepPercent) {
    const power = getChargingPowerAtSoc(soc, maxPowerKw, chargingCurve);
    const energyForStep = (stepPercent / 100) * batteryKwh;
    const timeForStepHours = energyForStep / Math.max(power, 1);
    totalMinutes += timeForStepHours * 60;
  }

  return Math.ceil(totalMinutes);
}

function getChargingPowerAtSoc(
  soc: number,
  maxPowerKw: number,
  chargingCurve: { soc: number; power: number }[]
): number {
  if (!chargingCurve || chargingCurve.length === 0) return maxPowerKw * 0.8;

  for (let i = 0; i < chargingCurve.length - 1; i++) {
    const curr = chargingCurve[i];
    const next = chargingCurve[i + 1];

    if (soc >= curr.soc && soc <= next.soc) {
      const ratio = (soc - curr.soc) / (next.soc - curr.soc);
      return curr.power + (next.power - curr.power) * ratio;
    }
  }

  return chargingCurve[chargingCurve.length - 1].power;
}

export function findOptimalChargingStops(
  stations: ChargerStation[],
  routeCoords: [number, number][],
  vehicle: VehicleSpec,
  currentSocPercent: number,
  preferredSpeedKmh: number,
  sohPercent: number = 100,
  minSocAtCharger: number = 10,
  targetSocAtCharger: number = 80,
  preferredConnectors?: ConnectorType[]
): RouteStop[] {
  const usableCapacity = vehicle.usableBatteryKwh * (sohPercent / 100);
  const stops: RouteStop[] = [];
  let currentSoc = currentSocPercent;
  let accumulatedDistance = 0;

  const totalDistance = calculateTotalRouteDistance(routeCoords);
  const totalRangeKm = (usableCapacity / vehicle.realWorldConsumptionKwhPer100km) * 100;

  if (totalDistance <= totalRangeKm * (currentSocPercent / 100)) {
    return stops;
  }

  const reachableStations = findReachableStations(
    stations,
    routeCoords,
    vehicle,
    currentSoc,
    preferredSpeedKmh,
    usableCapacity,
    sohPercent,
    preferredConnectors
  );

  if (reachableStations.length === 0 && totalDistance > totalRangeKm * (currentSocPercent / 100)) {
    return stops;
  }

  let currentIdx = 0;
  let currentSocVar = currentSocPercent;

  while (currentIdx < routeCoords.length - 1) {
    const distToNext = haversineDistance(
      routeCoords[currentIdx][0],
      routeCoords[currentIdx][1],
      routeCoords[currentIdx + 1][0],
      routeCoords[currentIdx + 1][1]
    );
    accumulatedDistance += distToNext;

    const energyUsed = calculateEnergyForSegment(distToNext, vehicle.realWorldConsumptionKwhPer100km, preferredSpeedKmh);
    const socUsed = (energyUsed / usableCapacity) * 100;
    currentSocVar -= socUsed;

    if (currentSocVar <= minSocAtCharger) {
      const nearbyCharger = findBestChargerAlongRoute(
        stations,
        routeCoords,
        currentIdx,
        currentSocVar,
        vehicle,
        preferredSpeedKmh,
        usableCapacity,
        sohPercent,
        preferredConnectors
      );

      if (nearbyCharger) {
        const distFromPrev = stops.length > 0
          ? accumulatedDistance - stops.reduce((sum, s) => sum + s.distanceFromPreviousKm, 0)
          : accumulatedDistance;

        const arrivalSoc = Math.max(currentSocVar, 5);
        const chargeTime = estimateChargeTime(
          arrivalSoc,
          targetSocAtCharger,
          vehicle.maxChargePowerDcKw,
          usableCapacity,
          vehicle.chargingCurve
        );

        const bestConnection = nearbyCharger.connections.reduce((best, c) => {
          if (c.powerKw > best.powerKw) return c;
          return best;
        }, nearbyCharger.connections[0]);

        stops.push({
          chargerStation: nearbyCharger,
          arrivalSocPercent: Math.round(arrivalSoc),
          chargeTimeMinutes: chargeTime,
          departureSocPercent: targetSocAtCharger,
          distanceFromPreviousKm: Math.round(distFromPrev),
          distanceToNextKm: 0,
          energyConsumedKwh: Math.round(energyUsed * 10) / 10,
          selectedConnection: bestConnection,
        });

        currentSocVar = targetSocAtCharger;
      }
    }

    currentIdx++;
  }

  for (let i = 0; i < stops.length; i++) {
    if (i === 0) {
      stops[i].distanceToNextKm = stops[i + 1]
        ? accumulatedDistance - stops[i].distanceFromPreviousKm - stops[i + 1].distanceFromPreviousKm
        : accumulatedDistance - stops[i].distanceFromPreviousKm;
    } else {
      stops[i].distanceToNextKm = accumulatedDistance - stops.reduce((sum, s, idx) =>
        idx <= i ? sum + s.distanceFromPreviousKm : sum, 0
      );
    }
  }

  return stops;
}

function calculateTotalRouteDistance(coords: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += haversineDistance(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
  }
  return total;
}

function findReachableStations(
  stations: ChargerStation[],
  routeCoords: [number, number][],
  vehicle: VehicleSpec,
  currentSoc: number,
  _speed: number,
  usableCapacity: number,
  _soh: number,
  preferredConnectors?: ConnectorType[]
): ChargerStation[] {
  const rangeKm = (usableCapacity * (currentSoc / 100)) / (vehicle.realWorldConsumptionKwhPer100km / 100);

  return stations.filter((station) => {
    const closestPoint = findClosestPointOnRoute(routeCoords, station.latitude, station.longitude);
    if (!closestPoint) return false;
    const distToRoute = haversineDistance(
      station.latitude, station.longitude,
      routeCoords[closestPoint.index][0], routeCoords[closestPoint.index][1]
    );
    if (distToRoute > 5) return false;

    if (preferredConnectors && preferredConnectors.length > 0) {
      const hasPreferred = station.connections.some((c) => preferredConnectors.includes(c.type));
      if (!hasPreferred) return false;
    }

    const stationDist = closestPoint.distanceFromStart;
    return stationDist <= rangeKm;
  });
}

function findBestChargerAlongRoute(
  stations: ChargerStation[],
  routeCoords: [number, number][],
  currentIdx: number,
  currentSoc: number,
  vehicle: VehicleSpec,
  _speed: number,
  usableCapacity: number,
  _soh: number,
  _preferredConnectors?: ConnectorType[]
): ChargerStation | null {
  const rangeKm = (usableCapacity * (currentSoc / 100)) / (vehicle.realWorldConsumptionKwhPer100km / 100);

  const candidates = stations
    .map((station) => {
      const closestPoint = findClosestPointOnRoute(routeCoords, station.latitude, station.longitude);
      if (!closestPoint) return null;
      if (closestPoint.index <= currentIdx) return null;

      const distToStation = haversineDistance(
        routeCoords[currentIdx][0], routeCoords[currentIdx][1],
        station.latitude, station.longitude
      );
      if (distToStation > rangeKm * 1.1) return null;

      const maxPower = Math.max(...station.connections.map((c) => c.powerKw));
      const score = maxPower * 0.3 + station.rating * 0.3 + (station.reviewCount > 0 ? 2 : 0) * 0.2 + (station.status === 'available' ? 3 : 0) * 0.2;

      return { station, distToStation, score, closestPoint };
    })
    .filter(Boolean) as { station: ChargerStation; distToStation: number; score: number; closestPoint: any }[];

  candidates.sort((a, b) => b.score - a.score);

  return candidates.length > 0 ? candidates[0].station : null;
}

function findClosestPointOnRoute(
  routeCoords: [number, number][],
  lat: number,
  lng: number
): { index: number; distance: number; distanceFromStart: number } | null {
  if (routeCoords.length === 0) return null;

  let minDist = Infinity;
  let closestIdx = 0;
  let distanceFromStart = 0;
  let accumulated = 0;

  for (let i = 0; i < routeCoords.length; i++) {
    const dist = haversineDistance(lat, lng, routeCoords[i][0], routeCoords[i][1]);
    if (i > 0) {
      accumulated += haversineDistance(
        routeCoords[i - 1][0], routeCoords[i - 1][1],
        routeCoords[i][0], routeCoords[i][1]
      );
    }
    if (dist < minDist) {
      minDist = dist;
      closestIdx = i;
      distanceFromStart = accumulated;
    }
  }

  return { index: closestIdx, distance: minDist, distanceFromStart };
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function calculateFullRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  vehicle: VehicleSpec,
  currentSocPercent: number,
  preferredSpeedKmh: number,
  avoidTolls: boolean,
  avoidHighways: boolean,
  avoidFerries: boolean,
  sohPercent: number = 100,
  stations: ChargerStation[] = [],
  preferredConnectors?: ConnectorType[]
): Promise<RoutePlan | null> {
  const route = await getOSRMRoute(
    [[startLat, startLng], [endLat, endLng]],
    avoidTolls,
    avoidHighways,
    avoidFerries
  );

  if (!route) return null;

  const stops = findOptimalChargingStops(
    stations,
    route.geometry,
    vehicle,
    currentSocPercent,
    preferredSpeedKmh,
    sohPercent,
    10,
    80,
    preferredConnectors
  );

  const totalEnergy = calculateEnergyForSegment(
    route.distance,
    vehicle.realWorldConsumptionKwhPer100km,
    preferredSpeedKmh
  );

  return {
    id: `route-${Date.now()}`,
    startLat,
    startLng,
    startAddress: '',
    endLat,
    endLng,
    endAddress: '',
    totalDistanceKm: Math.round(route.distance),
    totalTimeMinutes: Math.round(route.duration + stops.reduce((sum, s) => sum + s.chargeTimeMinutes, 0)),
    totalEnergyKwh: Math.round(totalEnergy * 10) / 10,
    stops,
    polyline: route.geometry,
    avoidTolls,
    avoidHighways,
    avoidFerries,
    preferredSpeedKmh,
    createdAt: Date.now(),
  };
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  try {
    // Try with countrycodes first (hr for Croatia), then fallback without
    const queries = [
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=hr,si,ba,rs,me,mk,al&addressdetails=1`,
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`,
    ];

    for (const url of queries) {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      if (data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          displayName: data[0].display_name,
        };
      }
    }
    return null;
  } catch (err) {
    console.error('Geocoding error:', err);
    return null;
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
    );
    if (!response.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const data = await response.json();
    return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch (err) {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}
