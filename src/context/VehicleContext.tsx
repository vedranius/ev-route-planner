import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { UserVehicle } from '../types';
import type { VehicleSpec } from '../data/vehicles';
import { useAuth } from './AuthContext';

interface VehicleContextType {
  selectedVehicle: UserVehicle | null;
  vehicles: UserVehicle[];
  selectVehicle: (vehicle: UserVehicle) => void;
  addVehicle: (spec: VehicleSpec, customData?: Partial<UserVehicle>) => UserVehicle;
  updateVehicle: (id: string, data: Partial<UserVehicle>) => void;
  removeVehicle: (id: string) => void;
  updateSoc: (id: string, soc: number) => void;
}

const VEHICLES_KEY = 'evrp_vehicles';
const SELECTED_VEHICLE_KEY = 'evrp_selected_vehicle';

function loadLocalVehicles(): UserVehicle[] {
  try {
    return JSON.parse(localStorage.getItem(VEHICLES_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalVehicles(vehicles: UserVehicle[]) {
  localStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));
}

function loadSelectedVehicle(): UserVehicle | null {
  try {
    return JSON.parse(localStorage.getItem(SELECTED_VEHICLE_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveSelectedVehicle(vehicle: UserVehicle | null) {
  if (vehicle) localStorage.setItem(SELECTED_VEHICLE_KEY, JSON.stringify(vehicle));
  else localStorage.removeItem(SELECTED_VEHICLE_KEY);
}

const VehicleContext = createContext<VehicleContextType | undefined>(undefined);

export function useVehicle() {
  const context = useContext(VehicleContext);
  if (!context) throw new Error('useVehicle must be used within VehicleProvider');
  return context;
}

export function VehicleProvider({ children }: { children: ReactNode }) {
  const { userData, updateUserData } = useAuth();
  const [selectedVehicle, setSelectedVehicle] = useState<UserVehicle | null>(() => loadSelectedVehicle());
  const [localVehicles, setLocalVehicles] = useState<UserVehicle[]>(() => loadLocalVehicles());
  const firebaseSyncedRef = useRef(false);

  // Merge Firebase vehicles into local - never let Firebase empty array overwrite local data
  useEffect(() => {
    if (userData?.vehicles && userData.vehicles.length > 0) {
      const firebaseIds = new Set(userData.vehicles.map((v) => v.id));
      const localOnly = localVehicles.filter((v) => !firebaseIds.has(v.id));
      const merged = [...userData.vehicles, ...localOnly];
      if (JSON.stringify(merged) !== JSON.stringify(localVehicles)) {
        setLocalVehicles(merged);
        saveLocalVehicles(merged);
      }
      firebaseSyncedRef.current = true;
    }
  }, [userData?.vehicles]);

  const vehicles = localVehicles;

  const selectVehicle = useCallback((vehicle: UserVehicle) => {
    setSelectedVehicle(vehicle);
    saveSelectedVehicle(vehicle);
  }, []);

  const addVehicle = useCallback(
    (spec: VehicleSpec, customData?: Partial<UserVehicle>): UserVehicle => {
      const newVehicle: UserVehicle = {
        id: `vehicle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: `${spec.make} ${spec.model}`,
        make: spec.make,
        model: spec.model,
        year: spec.year,
        batteryCapacityKwh: spec.batteryKwh,
        usableBatteryKwh: spec.usableBatteryKwh,
        consumptionKwhPer100km: spec.realWorldConsumptionKwhPer100km,
        socPercent: 80,
        sohPercent: 100,
        maxChargePowerKw: spec.maxChargePowerDcKw,
        connectorTypes: spec.connectorTypes as any[],
        isCustom: false,
        odometerKm: 0,
        ...customData,
      };

      const updatedVehicles = [...localVehicles, newVehicle];
      setLocalVehicles(updatedVehicles);
      saveLocalVehicles(updatedVehicles);
      updateUserData({ vehicles: updatedVehicles } as any);
      return newVehicle;
    },
    [localVehicles, updateUserData]
  );

  const updateVehicle = useCallback(
    (id: string, data: Partial<UserVehicle>) => {
      const updatedVehicles = localVehicles.map((v) => (v.id === id ? { ...v, ...data } : v));
      setLocalVehicles(updatedVehicles);
      saveLocalVehicles(updatedVehicles);
      updateUserData({ vehicles: updatedVehicles } as any);
      if (selectedVehicle?.id === id) {
        const updated = { ...selectedVehicle, ...data };
        setSelectedVehicle(updated);
        saveSelectedVehicle(updated);
      }
    },
    [localVehicles, selectedVehicle, updateUserData]
  );

  const removeVehicle = useCallback(
    (id: string) => {
      const updatedVehicles = localVehicles.filter((v) => v.id !== id);
      setLocalVehicles(updatedVehicles);
      saveLocalVehicles(updatedVehicles);
      updateUserData({ vehicles: updatedVehicles } as any);
      if (selectedVehicle?.id === id) {
        setSelectedVehicle(null);
        saveSelectedVehicle(null);
      }
    },
    [localVehicles, selectedVehicle, updateUserData]
  );

  const updateSoc = useCallback(
    (id: string, soc: number) => {
      updateVehicle(id, { socPercent: soc });
    },
    [updateVehicle]
  );

  const value = {
    selectedVehicle,
    vehicles,
    selectVehicle,
    addVehicle,
    updateVehicle,
    removeVehicle,
    updateSoc,
  };

  return <VehicleContext.Provider value={value}>{children}</VehicleContext.Provider>;
}
