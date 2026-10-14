/**
 * Real sensor labels and units, transcribed from Table 2 of Saxena,
 * Goebel, Simon & Eklund, "Damage Propagation Modeling for Aircraft
 * Engine Run-to-Failure Simulation" (PHM08). Units left blank ("") are
 * dimensionless in the source table.
 */
export const SENSOR_META: Record<string, { label: string; unit: string }> = {
  T2: { label: 'Total temp, fan inlet', unit: '\u00b0R' },
  T24: { label: 'Total temp, LPC outlet', unit: '\u00b0R' },
  T30: { label: 'Total temp, HPC outlet', unit: '\u00b0R' },
  T50: { label: 'Total temp, LPT outlet', unit: '\u00b0R' },
  P2: { label: 'Pressure, fan inlet', unit: 'psia' },
  P15: { label: 'Total pressure, bypass duct', unit: 'psia' },
  P30: { label: 'Total pressure, HPC outlet', unit: 'psia' },
  Nf: { label: 'Physical fan speed', unit: 'rpm' },
  Nc: { label: 'Physical core speed', unit: 'rpm' },
  epr: { label: 'Engine pressure ratio', unit: '' },
  Ps30: { label: 'Static pressure, HPC outlet', unit: 'psia' },
  phi: { label: 'Fuel flow / Ps30', unit: 'pps/psi' },
  NRf: { label: 'Corrected fan speed', unit: 'rpm' },
  NRc: { label: 'Corrected core speed', unit: 'rpm' },
  BPR: { label: 'Bypass ratio', unit: '' },
  farB: { label: 'Burner fuel-air ratio', unit: '' },
  htBleed: { label: 'Bleed enthalpy', unit: '' },
  Nf_dmd: { label: 'Demanded fan speed', unit: 'rpm' },
  PCNfR_dmd: { label: 'Demanded corrected fan speed', unit: 'rpm' },
  W31: { label: 'HPT coolant bleed', unit: 'lbm/s' },
  W32: { label: 'LPT coolant bleed', unit: 'lbm/s' },
}

/** Ordered sensor keys, matching the raw file's column order. */
export const SENSOR_KEYS = Object.keys(SENSOR_META)

/**
 * Op-setting labels and units. Altitude and Mach number are stated
 * directly in the source paper (six flight conditions spanning
 * altitude 0-42K ft and Mach 0-0.84); TRA (throttle resolver angle) is
 * named in the same passage but with no unit given, so it's left
 * unitless here rather than guessing one.
 */
export const OP_SETTING_META: Record<'altitudeFt' | 'mach' | 'tra', { label: string; unit: string }> = {
  altitudeFt: { label: 'Altitude', unit: 'ft' },
  mach: { label: 'Mach number', unit: '' },
  tra: { label: 'TRA', unit: '' },
}

/**
 * Formats one op setting's value to a sensible number of decimal places
 * for its unit -- whole feet for altitude, more precision for unitless
 * ratios like Mach number. Shared by the popup, the sidebar breakdown,
 * and operating-condition labels so all three describe a setting the
 * same way.
 *
 * Args:
 *   key: Which op setting.
 *   value: Its raw numeric value.
 *
 * Returns:
 *   A short display string, e.g. "24,998 ft" or "0.62".
 */
export function formatOpSetting(key: keyof typeof OP_SETTING_META, value: number): string {
  const { unit } = OP_SETTING_META[key]
  const decimals = key === 'altitudeFt' ? 0 : key === 'mach' ? 2 : 1
  const num = value.toLocaleString(undefined, { maximumFractionDigits: decimals })
  return unit ? `${num} ${unit}` : num
}
