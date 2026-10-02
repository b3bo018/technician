import type { JobType, Shift } from '../types';

export type ServiceCategory = 'new_installation' | 'complaints' | 'removals' | 'other';

export const COMPLAINT_JOB_TYPES: JobType[] = ['inspection', 'device_change', 'sim_change', 'sim_device_change'];

export function jobUnits(shift: Shift): JobType[] {
  if (shift.unit_jobs?.length) return shift.unit_jobs.map(unit => unit.job_type);
  const count = Math.max(1, Number(shift.unit_count) || 1);
  return Array.from({ length: count }, () => shift.job_type);
}

export function serviceCategory(type: JobType): ServiceCategory {
  if (type === 'new_installation') return 'new_installation';
  if (type === 'device_removal') return 'removals';
  if (COMPLAINT_JOB_TYPES.includes(type)) return 'complaints';
  return 'other';
}

export function categoryUnitCount(shifts: Shift[], category: Exclude<ServiceCategory, 'other'>) {
  return shifts.reduce((total, shift) => total + jobUnits(shift).filter(type => serviceCategory(type) === category).length, 0);
}

export function jobTypeUnitCount(shifts: Shift[], type: JobType) {
  return shifts.reduce((total, shift) => total + jobUnits(shift).filter(unitType => unitType === type).length, 0);
}

export function shiftMatchesServiceCategory(shift: Shift, category: 'all' | Exclude<ServiceCategory, 'other'>) {
  return category === 'all' || jobUnits(shift).some(type => serviceCategory(type) === category);
}
