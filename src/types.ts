export const DEVICE_MODELS = ['FMC920', 'FMC130', 'FMC125', 'Jimi VL03', 'GT06', 'Ruptela'] as const;
export type DeviceModel = typeof DEVICE_MODELS[number];
export const SIM_PROVIDERS = ['Etisalat', 'du', 'International'] as const;
export type SimProvider = typeof SIM_PROVIDERS[number];
export type SimStockKey = 'SIM' | `SIM ${SimProvider}`;
export const SIM_STOCK_KEYS: SimStockKey[] = ['SIM Etisalat', 'SIM du', 'SIM International', 'SIM'];
export const simStockKey = (provider?: SimProvider): SimStockKey => provider ? `SIM ${provider}` : 'SIM';
export const ROLES = ['master_admin', 'admin', 'manager', 'accountant', 'hr', 'it', 'technician'] as const;
export type Role = typeof ROLES[number];
export const UNIT_JOB_TYPES = ['new_installation', 'device_change', 'device_removal', 'sim_change', 'sim_device_change', 'inspection'] as const;
export type UnitJobType = typeof UNIT_JOB_TYPES[number];
export const JOB_TYPES = [...UNIT_JOB_TYPES, 'mixed'] as const;
export type JobType = typeof JOB_TYPES[number];
export type JobStatus = 'assigned' | 'in_progress' | 'completed';
export type InspectionAction = 'check_only' | 'device_change' | 'sim_change' | 'sim_device_change';
export type Stock = Record<DeviceModel | SimStockKey, number>;
export const emptyStock = (): Stock => ({ FMC920: 0, FMC130: 0, FMC125: 0, 'Jimi VL03': 0, GT06: 0, Ruptela: 0, 'SIM Etisalat': 0, 'SIM du': 0, 'SIM International': 0, SIM: 0 });
export interface Technician { uid: string; email: string; displayName?: string; photoDataUrl?: string; role: Role; status?: 'active' | 'deactivated'; inventory_breakdown?: { fmc920?: number; fmc130?: number; sim_cards?: number }; inventory_count?: number; }
export interface Movement { id: string; technician_id: string; technician_name: string; type: 'received' | 'installed' | 'sim-used' | 'adjustment'; device_model: DeviceModel | ''; quantity: number; sim_count: number; quantity_delta?: number; sim_delta?: number; sim_provider?: SimProvider; timestamp: string; notes: string; }
export interface UnitJob { vehicle_number: string; job_type: UnitJobType; }
export interface UnitCompletion extends UnitJob { inspection_action?: InspectionAction; device_model?: DeviceModel; device_imei?: string; sim_number?: string; }
export interface Installation { id: string; shift_id?: string; technician_id: string; technician_name: string; job_type?: JobType; inspection_action?: InspectionAction; unit_count?: number; unit_records?: UnitCompletion[]; device_model: string; device_imeis?: string[]; sim_numbers?: string[]; sim_count: number; sim_provider?: SimProvider; customer_ref: string; vehicle_ref: string; notes: string; timestamp: string; completed_at?: string; completion_latitude?: number; completion_longitude?: number; completion_accuracy_m?: number; legacy?: boolean; }
export interface InventoryAccount { technician_id: string; opening: Stock; timestamp: string; }
export interface Shift { id: string; job_reference?: string; technician_id: string; technician_name: string; site_name: string; company_name?: string; contact_person?: string; customer_name?: string; customer_phone?: string; vehicle_number?: string; vehicle_numbers?: string[]; unit_jobs?: UnitJob[]; maps_url?: string; job_notes?: string; job_type: JobType; unit_count: number; latitude?: number; longitude?: number; radius_m: number; scheduled_at: string; assigned_at?: string; arrived_at?: string; completed_at?: string; completion_latitude?: number; completion_longitude?: number; completion_accuracy_m?: number; status?: JobStatus; window_start: string; window_end: string; grace_minutes: number; timezone: string; date: string; }
export interface Attendance { id: string; technician_id: string; latitude: number; longitude: number; accuracy_m: number; timestamp: string; }
export interface WorkSession { id: string; technician_id: string; technician_name: string; date: string; timezone: string; status: 'active' | 'clocked_out'; clock_in_at: string; clock_in_latitude: number; clock_in_longitude: number; clock_in_accuracy_m: number; clock_out_at?: string; clock_out_latitude?: number; clock_out_longitude?: number; clock_out_accuracy_m?: number; }
export interface WorkBreak { id: string; session_id: string; technician_id: string; date: string; status: 'active' | 'ended'; started_at: string; ended_at?: string; }
export interface PendingOperation { id: string; uid: string; kind: 'received' | 'installed' | 'sim-used' | 'job-completed'; shift_id?: string; job_type?: JobType; inspection_action?: InspectionAction; unit_count?: number; unit_records?: UnitCompletion[]; device_model: DeviceModel | ''; device_imeis?: string[]; sim_numbers?: string[]; quantity: number; sim_count: number; sim_provider?: SimProvider; customer_ref: string; vehicle_ref: string; notes: string; completion_latitude?: number; completion_longitude?: number; completion_accuracy_m?: number; captured_at: string; }
export const roleLabel = (role: Role) => ({ master_admin: 'Master administrator', admin: 'Administrator', manager: 'Manager', accountant: 'Accountant', hr: 'Human resources', it: 'IT support', technician: 'Technician' }[role]);
export const jobLabel = (job: JobType) => ({ new_installation: 'New installation', device_change:'Device change', sim_change: 'SIM change', sim_device_change: 'SIM and device change', device_removal: 'Removal', inspection: 'Inspection', mixed:'Mixed unit work' }[job]);
export function jobReference(shift:Pick<Shift,'id'|'job_reference'>){if(shift.job_reference)return shift.job_reference;let hash=0;for(const char of shift.id)hash=(hash*31+char.charCodeAt(0))>>>0;return `ST${String(hash%100000).padStart(5,'0')}`}
export const inspectionLabel = (action?: InspectionAction) => ({ check_only: 'Check only', device_change: 'Device change', sim_change: 'SIM change', sim_device_change: 'SIM and device change' }[action||'check_only']);
