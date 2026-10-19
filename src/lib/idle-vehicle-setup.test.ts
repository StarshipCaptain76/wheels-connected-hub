import { parseIdleVehicleYear, updateIdleVehicleDraft } from './idle-vehicle-setup.ts';
function assert(ok: boolean, message: string) { if (!ok) throw new Error(message); }
assert(parseIdleVehicleYear('') === null, 'Blank year must not become zero');
assert(parseIdleVehicleYear('1968') === 1968, 'Valid year retained');
assert(parseIdleVehicleYear('0') === null, 'Invalid year rejected before capture');
const a = { year: '1968', make: 'Ford', model: 'Mustang', powertrain: 'ice' };
const b = { year: '1980', make: 'Mercedes', model: '240D', powertrain: 'diesel' };
const drafts = updateIdleVehicleDraft(updateIdleVehicleDraft({}, 'car-a', a), 'car-b', b);
assert(drafts['car-a'].year === '1968' && drafts['car-b'].year === '1980', 'Vehicle details do not leak between cars');
console.log('idle vehicle setup passed');