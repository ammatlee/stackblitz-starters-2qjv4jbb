export const VESSEL_TYPES = [
  'Tugboat',
  'Anchor Handling Tug',
  'SPOB',
  'LCT',
  'Barge',
  'Crane Barge',
  'Pontoon',
  'Oil Barge',
  'Accommodation Barge',
  'General Cargo',
  'Bulk Carrier',
  'Container Ship',
  'Passenger / Ro-Ro',
  'Oil Tanker',
  'Chemical Tanker',
  'Gas Carrier',
  'Supply Vessel (PSV/OSV)',
  'Fishing Vessel',
  'Dredger',
  'FSO / FPSO',
];
/** Jenis kapal yang memiliki towing winch. */
export const TUG_TYPES = ['Tugboat', 'Anchor Handling Tug'];
/** Jenis kapal dengan palka/hatch cover (item hatch & palka tidak lagi otomatis N/A). */
export const HOLD_TYPES = ['General Cargo', 'Bulk Carrier', 'Container Ship', 'Oil Tanker', 'Chemical Tanker', 'Gas Carrier'];
/** Jenis kapal dengan sistem kargo (item mesin kargo tidak lagi otomatis N/A). */
export const CARGO_SYSTEM_TYPES = ['Oil Tanker', 'Chemical Tanker', 'Gas Carrier'];
/** Kapal tanpa penggerak sendiri: tidak memiliki Propeller Shaft Survey. Jenis buatan sendiri yang memuat kata barge/pontoon/tongkang dianggap tanpa penggerak. */
export const NON_PROPELLED = ['Pontoon', 'Barge', 'Crane Barge', 'Oil Barge', 'Accommodation Barge'];
export const isNonPropelled = (t: string | null | undefined) => !!t && (NON_PROPELLED.includes(t) || /barge|pontoon|tongkang/i.test(t));
