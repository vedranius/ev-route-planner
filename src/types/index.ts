export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  twoFactorSecret?: string;
  twoFactorEnabled: boolean;
  vehicles: UserVehicle[];
  createdAt: number;
}

export interface UserVehicle {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  batteryCapacityKwh: number;
  usableBatteryKwh: number;
  consumptionKwhPer100km: number;
  socPercent: number;
  sohPercent: number;
  maxChargePowerKw: number;
  connectorTypes: ConnectorType[];
  isCustom: boolean;
  odometerKm: number;
}

export type ConnectorType =
  | 'type2'
  | 'ccs'
  | 'chademo'
  | 'tesla'
  | 'type1'
  | 'gb_t'
  | 'scame'
  | 'other';

export const CONNECTOR_LABELS: Record<ConnectorType, string> = {
  type2: 'Type 2',
  ccs: 'CCS',
  chademo: 'CHAdeMO',
  tesla: 'Tesla (NACS)',
  type1: 'Type 1',
  gb_t: 'GB/T',
  scame: 'Scame',
  other: 'Other',
};

export type ChargingLevel = 1 | 2 | 3;

export interface ChargerStation {
  id: string;
  ocmId?: number;
  name: string;
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  operators: string[];
  connections: ChargerConnection[];
  level: ChargingLevel;
  status: ChargerStatus;
  rating: number;
  reviewCount: number;
  photos: string[];
  source: 'openchargemap' | 'user' | 'merged';
  lastVerified?: number;
  openingHours?: string;
  costInfo?: string;
  amenities: string[];
}

export interface ChargerConnection {
  type: ConnectorType;
  powerKw: number;
  current: number;
  voltage: number;
  quantity: number;
}

export type ChargerStatus = 'available' | 'busy' | 'offline' | 'unknown' | 'out_of_order';

export const STATUS_LABELS: Record<ChargerStatus, string> = {
  available: 'Available',
  busy: 'Busy',
  offline: 'Offline',
  unknown: 'Unknown',
  out_of_order: 'Out of Order',
};

export interface RouteStop {
  chargerStation: ChargerStation;
  arrivalSocPercent: number;
  chargeTimeMinutes: number;
  departureSocPercent: number;
  distanceFromPreviousKm: number;
  distanceToNextKm: number;
  energyConsumedKwh: number;
  selectedConnection: ChargerConnection;
}

export interface RoutePlan {
  id: string;
  startLat: number;
  startLng: number;
  startAddress: string;
  endLat: number;
  endLng: number;
  endAddress: string;
  totalDistanceKm: number;
  totalTimeMinutes: number;
  totalEnergyKwh: number;
  stops: RouteStop[];
  polyline: [number, number][];
  avoidTolls: boolean;
  avoidHighways: boolean;
  avoidFerries: boolean;
  preferredSpeedKmh: number;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  text: string;
  imageUrl?: string;
  timestamp: number;
  routeId?: string;
  chargerId?: string;
}

export interface ChargerReview {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  chargerId: string;
  rating: number;
  text: string;
  photos: string[];
  status: ChargerStatus;
  timestamp: number;
  source: 'app' | 'openchargemap' | 'plugshare';
}

export interface LocationShare {
  id: string;
  userId: string;
  userName: string;
  vehicleName?: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  batteryPercent: number;
  estimatedRangeKm: number;
  timestamp: number;
  isActive: boolean;
  expiresAt: number;
}

export interface OVMSConfig {
  ip: string;
  port: number;
  token?: string;
  vehicleId?: string;
  isConnected: boolean;
}
