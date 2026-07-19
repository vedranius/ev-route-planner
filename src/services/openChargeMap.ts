import type { ConnectorType, ChargerStatus, ChargerConnection, ChargerStation, ChargingLevel } from '../types';

const OCM_API_KEY = import.meta.env.VITE_OCM_API_KEY || 'd8e0e36d-6fe2-4a24-9d29-354bcd5d1923';
const OCM_BASE = 'https://api.openchargemap.io/v3';

async function ocmFetch(url: string, retries: number = 2): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'EVRoutePlanner/1.0 (https://github.com/vedranius/ev-route-planner)',
        },
      });
      clearTimeout(timeout);

      if (response.status === 429) {
        // Rate limited - wait and retry
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
      }

      if (!response.ok) throw new Error(`OCM API error: ${response.status}`);
      return await response.json();
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        console.error('OCM API request timed out');
      }
      if (attempt < retries && (err.name === 'AbortError' || err.message?.includes('5'))) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }
  throw new Error('OCM API: Max retries exceeded');
}

const CONNECTOR_MAP: Record<number, ConnectorType> = {
  1: 'type1',
  2: 'type2',
  3: 'type2',
  4: 'ccs',
  5: 'ccs',
  6: 'chademo',
  7: 'chademo',
  8: 'tesla',
  9: 'tesla',
  10: 'type2',
  11: 'type2',
  12: 'type2',
  13: 'type2',
  14: 'gb_t',
  15: 'gb_t',
  16: 'scame',
  23: 'type2',
  24: 'type2',
  25: 'ccs',
  26: 'ccs',
  27: 'chademo',
  28: 'other',
  29: 'type2',
  30: 'type2',
  31: 'type2',
  32: 'ccs',
  33: 'tesla',
  34: 'tesla',
  35: 'type2',
  36: 'ccs',
  1021: 'ccs',
  1022: 'type2',
  1023: 'chademo',
  1024: 'tesla',
  1025: 'gb_t',
  1026: 'type2',
  1027: 'ccs',
  1035: 'type2',
  1036: 'ccs',
};

const STATUS_MAP: Record<number, ChargerStatus> = {
  0: 'unknown',
  10: 'available',
  20: 'busy',
  30: 'offline',
  40: 'out_of_order',
  50: 'out_of_order',
  75: 'offline',
  99: 'unknown',
  150: 'available',
  200: 'busy',
  210: 'busy',
  220: 'offline',
  230: 'out_of_order',
};

function mapConnectorType(connectionTypeId: number): ConnectorType {
  return CONNECTOR_MAP[connectionTypeId] || 'other';
}

function mapStatus(statusId: number): ChargerStatus {
  return STATUS_MAP[statusId] || 'unknown';
}

function estimateLevel(connections: any[]): ChargingLevel {
  const maxPower = Math.max(...connections.map((c) => c.PowerKW || c.powerKw || 0));
  if (maxPower >= 50) return 3;
  if (maxPower >= 7) return 2;
  return 1;
}

export async function searchChargersByLocation(
  lat: number,
  lng: number,
  distanceKm: number = 50,
  maxResults: number = 100,
  connectionTypes?: ConnectorType[]
): Promise<ChargerStation[]> {
  const params = new URLSearchParams({
    output: 'json',
    latitude: lat.toString(),
    longitude: lng.toString(),
    distance: distanceKm.toString(),
    distanceunit: 'km',
    maxresults: maxResults.toString(),
    compact: 'true',
    verbose: 'false',
    key: OCM_API_KEY,
  });

  if (connectionTypes && connectionTypes.length > 0) {
    const typeIds = connectionTypes.flatMap((t) => getOCMConnectionTypeIds(t));
    params.append('connectiontypeid', [...new Set(typeIds)].join(','));
  }

  try {
    const data = await ocmFetch(`${OCM_BASE}/poi/?${params}`);
    return data.map(mapOCMToStation).filter(Boolean);
  } catch (err) {
    console.error('Failed to fetch chargers from OCM:', err);
    return [];
  }
}

export async function searchChargersByBounds(
  swLat: number,
  swLng: number,
  neLat: number,
  neLng: number,
  maxResults: number = 200,
  connectionTypes?: ConnectorType[]
): Promise<ChargerStation[]> {
  const params = new URLSearchParams({
    output: 'json',
    boundingbox: `${swLat},${swLng},${neLat},${neLng}`,
    maxresults: maxResults.toString(),
    compact: 'true',
    verbose: 'false',
    key: OCM_API_KEY,
  });

  if (connectionTypes && connectionTypes.length > 0) {
    const typeIds = connectionTypes.flatMap((t) => getOCMConnectionTypeIds(t));
    params.append('connectiontypeid', [...new Set(typeIds)].join(','));
  }

  try {
    console.log('OCM Bounds search:', { swLat, swLng, neLat, neLng });
    const data = await ocmFetch(`${OCM_BASE}/poi/?${params}`);
    console.log('OCM Bounds results:', data?.length || 0);
    return data.map(mapOCMToStation).filter(Boolean);
  } catch (err) {
    console.error('Failed to fetch chargers by bounds:', err);
    // Fallback to location-based search
    try {
      const centerLat = (swLat + neLat) / 2;
      const centerLng = (swLng + neLng) / 2;
      return await searchChargersByLocation(centerLat, centerLng, 50, maxResults, connectionTypes);
    } catch {
      return [];
    }
  }
}

export async function getChargerDetails(id: string): Promise<ChargerStation | null> {
  const params = new URLSearchParams({
    output: 'json',
    id: id,
    compact: 'false',
    verbose: 'true',
    key: OCM_API_KEY,
  });

  try {
    const data = await ocmFetch(`${OCM_BASE}/poi/?${params}`);
    if (data.length > 0) return mapOCMToStation(data[0]);
    return null;
  } catch (err) {
    console.error('Failed to fetch charger details:', err);
    return null;
  }
}

function mapOCMToStation(poi: any): ChargerStation | null {
  if (!poi || !poi.AddressInfo) return null;

  const addr = poi.AddressInfo;
  const connections: ChargerConnection[] = (poi.Connections || []).map((c: any) => ({
    type: mapConnectorType(c.ConnectionTypeID || c.connectionTypeId || 0),
    powerKw: c.PowerKW || c.powerKw || 0,
    current: c.Amps || c.amps || 0,
    voltage: c.Voltage || c.voltage || 0,
    quantity: c.Quantity || c.quantity || 1,
  }));

  if (connections.length === 0) return null;

  const photos: string[] = (poi.MediaItems || poi.mediaItems || []).map(
    (m: any) => m.Item?.URL || m.url || ''
  ).filter(Boolean);

  return {
    id: `ocm-${poi.ID || poi.id}`,
    ocmId: poi.ID || poi.id,
    name: addr.Title || addr.title || addr.AddressLine1 || 'Charging Station',
    address: addr.AddressLine1 || addr.addressLine1 || '',
    city: addr.Town || addr.town || '',
    country: addr.Country?.Title || addr.country?.title || '',
    latitude: addr.Latitude || addr.latitude || 0,
    longitude: addr.Longitude || addr.longitude || 0,
    operators: [poi.OperatorInfo?.Title || poi.operatorInfo?.title || 'Unknown'].filter(Boolean).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i),
    connections,
    level: estimateLevel(connections),
    status: mapStatus(poi.StatusTypeID ?? poi.statusTypeId ?? 0),
    rating: poi.UserReviews?.OverallRating || poi.userReviews?.overallRating || 0,
    reviewCount: poi.UserReviews?.TotalCount || poi.userReviews?.totalCount || 0,
    photos,
    source: 'openchargemap',
    lastVerified: poi.DateLastVerified ? new Date(poi.DateLastVerified).getTime() : undefined,
    openingHours: poi.UsageType?.Title || poi.usageType?.title || undefined,
    amenities: [],
  };
}

function getOCMConnectionTypeIds(type: ConnectorType): number[] {
  const map: Record<ConnectorType, number[]> = {
    type1: [1],
    type2: [2, 1022, 1026, 29, 30, 31, 1035],
    ccs: [25, 32, 36, 1021, 1027, 1036],
    chademo: [3, 27, 1023],
    tesla: [30, 33, 8, 9, 1024],
    gb_t: [14, 15, 1025],
    scame: [16],
    other: [0],
  };
  return map[type] || [0];
}

export async function getReferenceData(): Promise<any> {
  const params = new URLSearchParams({
    output: 'json',
    key: OCM_API_KEY,
  });

  try {
    const data = await ocmFetch(`${OCM_BASE}/referencedata/?${params}`);
    return data;
  } catch (err) {
    console.error('Failed to fetch reference data:', err);
    return null;
  }
}
