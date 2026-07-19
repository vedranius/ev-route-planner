import { useState } from 'react';
import { useVehicle } from '../context/VehicleContext';
import { searchVehicles, getUniqueMakes, getVehicleModels, type VehicleSpec } from '../data/vehicles';
import { CONNECTOR_LABELS, type ConnectorType, type UserVehicle } from '../types';

interface VehicleSelectorProps {
  onSelect?: (vehicle: UserVehicle) => void;
}

export default function VehicleSelector({ onSelect }: VehicleSelectorProps) {
  const { selectedVehicle, vehicles, selectVehicle, addVehicle, updateVehicle, removeVehicle } = useVehicle();
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editVehicle, setEditVehicle] = useState<UserVehicle | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMake, setSelectedMake] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [customBattery, setCustomBattery] = useState(false);
  const [customBatteryKwh, setCustomBatteryKwh] = useState('');
  const [customSoh, setCustomSoh] = useState('100');
  const [customSoc, setCustomSoc] = useState('80');

  const makes = getUniqueMakes();
  const filteredModels = selectedMake ? getVehicleModels(selectedMake) : [];
  const searchResults = searchQuery ? searchVehicles(searchQuery) : [];

  const handleAddVehicle = (spec: VehicleSpec) => {
    const batteryKwh = customBattery && customBatteryKwh ? parseFloat(customBatteryKwh) : spec.batteryKwh;
    const usableKwh = customBattery && customBatteryKwh ? batteryKwh * 0.95 : spec.usableBatteryKwh;
    const soh = customSoh ? parseFloat(customSoh) : 100;
    const soc = customSoc ? parseFloat(customSoc) : 80;

    const vehicle = addVehicle(spec, {
      batteryCapacityKwh: batteryKwh,
      usableBatteryKwh: usableKwh,
      sohPercent: soh,
      socPercent: soc,
      isCustom: customBattery,
    });

    selectVehicle(vehicle);
    setShowAdd(false);
    setSelectedMake('');
    setSelectedModel('');
    setCustomBattery(false);
    setSearchQuery('');
    onSelect?.(vehicle);
  };

  const handleEditSave = () => {
    if (!editVehicle) return;
    updateVehicle(editVehicle.id, editVehicle);
    setShowEdit(false);
    setEditVehicle(null);
  };

  const openEdit = (vehicle: UserVehicle) => {
    setEditVehicle({ ...vehicle });
    setShowEdit(true);
  };

  return (
    <div>
      {vehicles.length > 0 && !showAdd && (
        <div className="space-y-2 mb-3">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className={`card flex items-center justify-between cursor-pointer transition-all ${
                selectedVehicle?.id === v.id ? 'border-[#10b981]' : 'hover:border-[#64748b]'
              }`}
              onClick={() => { selectVehicle(v); onSelect?.(v); }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${selectedVehicle?.id === v.id ? 'bg-[#10b981]' : 'bg-[#334155]'}`} />
                <div>
                  <p className="font-medium">{v.name}</p>
                  <p className="text-sm text-[#94a3b8]">
                    {v.batteryCapacityKwh} kWh • {v.socPercent}% SoC • {v.sohPercent}% SoH
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(v); }}
                  className="p-1 text-[#94a3b8] hover:text-white text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); removeVehicle(v.id); }}
                  className="p-1 text-[#94a3b8] hover:text-[#ef4444] text-sm"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showAdd && !showEdit && (
        <button onClick={() => setShowAdd(true)} className="btn-primary w-full">
          + Add Vehicle
        </button>
      )}

      {showAdd && (
        <div className="card fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Add Vehicle</h3>
            <button onClick={() => { setShowAdd(false); setSearchQuery(''); setSelectedMake(''); }} className="text-[#94a3b8] hover:text-white text-sm">
              Cancel
            </button>
          </div>

          <div className="mb-3">
            <input
              type="text"
              placeholder="Search vehicles (e.g. Tesla Model 3, VW ID.4...)"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSelectedMake(''); }}
              className="input-field"
            />
          </div>

          {searchQuery && searchResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1 mb-3 scrollbar-thin">
              {searchResults.slice(0, 20).map((spec, i) => (
                <button
                  key={i}
                  onClick={() => handleAddVehicle(spec)}
                  className="w-full text-left p-2 rounded-lg hover:bg-[#334155] transition-colors"
                >
                  <p className="font-medium text-sm">{spec.make} {spec.model} {spec.trim}</p>
                  <p className="text-xs text-[#94a3b8]">
                    {spec.batteryKwh} kWh • {spec.rangeWltpKm} km WLTP • {spec.maxChargePowerDcKw} kW DC
                  </p>
                </button>
              ))}
            </div>
          )}

          {!searchQuery && (
            <>
              <div className="mb-3">
                <label className="block text-sm text-[#94a3b8] mb-1">Manufacturer</label>
                <select
                  value={selectedMake}
                  onChange={(e) => { setSelectedMake(e.target.value); setSelectedModel(''); }}
                  className="input-field"
                >
                  <option value="">Select make...</option>
                  {makes.map((m) => (
                    <option key={m.make} value={m.make}>{m.make} ({m.count})</option>
                  ))}
                </select>
              </div>

              {selectedMake && (
                <div className="mb-3">
                  <label className="block text-sm text-[#94a3b8] mb-1">Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => {
                      const spec = filteredModels.find((m) => `${m.make} ${m.model} ${m.trim}` === e.target.value);
                      if (spec) handleAddVehicle(spec);
                    }}
                    className="input-field"
                  >
                    <option value="">Select model...</option>
                    {filteredModels.map((m, i) => (
                      <option key={i} value={`${m.make} ${m.model} ${m.trim}`}>
                        {m.model} {m.trim} ({m.year})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <div className="border-t border-[#334155] pt-3 mt-3">
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={customBattery}
                onChange={(e) => setCustomBattery(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Custom battery (modified vehicle)</span>
            </label>
            {customBattery && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-[#94a3b8] mb-1">Battery kWh</label>
                  <input
                    type="number"
                    value={customBatteryKwh}
                    onChange={(e) => setCustomBatteryKwh(e.target.value)}
                    className="input-field text-sm"
                    placeholder="e.g. 100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#94a3b8] mb-1">SoH %</label>
                  <input
                    type="number"
                    value={customSoh}
                    onChange={(e) => setCustomSoh(e.target.value)}
                    className="input-field text-sm"
                    min="1"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#94a3b8] mb-1">SoC %</label>
                  <input
                    type="number"
                    value={customSoc}
                    onChange={(e) => setCustomSoc(e.target.value)}
                    className="input-field text-sm"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showEdit && editVehicle && (
        <div className="card fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Edit {editVehicle.name}</h3>
            <button onClick={() => { setShowEdit(false); setEditVehicle(null); }} className="text-[#94a3b8] hover:text-white text-sm">
              Cancel
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-sm text-[#94a3b8] mb-1">Battery Capacity (kWh)</label>
              <input
                type="number"
                value={editVehicle.batteryCapacityKwh}
                onChange={(e) => setEditVehicle({ ...editVehicle, batteryCapacityKwh: parseFloat(e.target.value) || 0 })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm text-[#94a3b8] mb-1">Usable Battery (kWh)</label>
              <input
                type="number"
                value={editVehicle.usableBatteryKwh}
                onChange={(e) => setEditVehicle({ ...editVehicle, usableBatteryKwh: parseFloat(e.target.value) || 0 })}
                className="input-field"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">Current SoC %</label>
                <input
                  type="number"
                  value={editVehicle.socPercent}
                  onChange={(e) => setEditVehicle({ ...editVehicle, socPercent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                  className="input-field"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">Battery Health (SoH) %</label>
                <input
                  type="number"
                  value={editVehicle.sohPercent}
                  onChange={(e) => setEditVehicle({ ...editVehicle, sohPercent: Math.min(100, Math.max(1, parseInt(e.target.value) || 100)) })}
                  className="input-field"
                  min="1"
                  max="100"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-[#94a3b8] mb-1">Consumption (kWh/100km)</label>
              <input
                type="number"
                value={editVehicle.consumptionKwhPer100km}
                onChange={(e) => setEditVehicle({ ...editVehicle, consumptionKwhPer100km: parseFloat(e.target.value) || 0 })}
                className="input-field"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-sm text-[#94a3b8] mb-1">Max DC Charge Power (kW)</label>
              <input
                type="number"
                value={editVehicle.maxChargePowerKw}
                onChange={(e) => setEditVehicle({ ...editVehicle, maxChargePowerKw: parseFloat(e.target.value) || 0 })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm text-[#94a3b8] mb-1">Connector Types</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {(['type2', 'ccs', 'chademo', 'tesla'] as ConnectorType[]).map((ct) => (
                  <label key={ct} className="flex items-center gap-1 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editVehicle.connectorTypes.includes(ct)}
                      onChange={(e) => {
                        const types = e.target.checked
                          ? [...editVehicle.connectorTypes, ct]
                          : editVehicle.connectorTypes.filter((t) => t !== ct);
                        setEditVehicle({ ...editVehicle, connectorTypes: types });
                      }}
                    />
                    {CONNECTOR_LABELS[ct]}
                  </label>
                ))}
              </div>
            </div>
            <button onClick={handleEditSave} className="btn-primary w-full">
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
