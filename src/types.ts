export const DEVICE_MODELS = ['FMC920', 'FMC130', 'FMC125', 'Jimi VL03', 'GT06', 'Ruptela'] as const;
export type DeviceModel = typeof DEVICE_MODELS[number];
export const SIM_PROVIDERS = ['Etisalat', 'du', 'International'] as const;
export type SimProvider = typeof SIM_PROVIDERS[number];
export type SimStockKey = 'SIM' | `SIM ${SimProvider}`;
export const SIM_STOCK_KEYS: SimStockKey[] = ['SIM Etisalat', 'SIM du', 'SIM International', 'SIM'];
export const simStockKey = (provider?: SimProvider): SimStockKey => provider ? `SIM ${provider}` : 'SIM';
export const ROLES = ['master_admin', 'admin', 'manager', 'accountant', 'hr', 'it', 'technician'] as const;
export type Role = typeof ROLES[number];
export const JOB_TYPES = ['new_installation', 'sim_change', 'sim_device_change', 'device_removal'] as const;
export type JobType = typeof JOB_TYPES[number];
export type Stock = Record<DeviceModel | SimStockKey, number>;
export const emptyStock = (): Stock => ({ FMC920: 0, FMC130: 0, FMC125: 0, 'Jimi VL03': 0, GT06: 0, Ruptela: 0, 'SIM Etisalat': 0, 'SIM du': 0, 'SIM International': 0, SIM: 0 });
export interface Technician { uid: string; email: string; displayName?: string; photoDataUrl?: string; role: Role; status?: 'active' | 'deactivated'; inventory_breakdown?: { fmc920?: number; fmc130?: number; sim_cards?: number }; inventory_count?: number; }
export interface Movement { id: string; technician_id: string; technician_name: string; type: 'received' | 'installed' | 'sim-used'; device_model: DeviceModel | ''; quantity: number; sim_count: number; sim_provider?: SimProvider; timestamp: string; notes: string; }
export interface Installation { id: string; shift_id?: string; technician_id: string; technician_name: string; job_type?: JobType; unit_count?: number; device_model: string; device_imeis?: string[]; sim_numbers?: string[]; sim_count: number; sim_provider?: SimProvider; customer_ref: string; vehicle_ref: string; notes: string; timestamp: string; legacy?: boolean; }
export interface InventoryAccount { technician_id: string; opening: Stock; timestamp: string; }
export interface Shift { id: string; technician_id: string; technician_name: string; site_name: string; company_name?: string; contact_person?: string; customer_name?: string; customer_phone?: string; vehicle_number?: string; vehicle_numbers?: string[]; maps_url?: string; job_notes?: string; job_type: JobType; unit_count: number; latitude?: number; longitude?: number; radius_m: number; scheduled_at: string; window_start: string; window_end: string; grace_minutes: number; timezone: string; date: string; }
export interface Attendance { id: string; technician_id: string; latitude: number; longitude: number; accuracy_m: number; timestamp: string; }
export interface PendingOperation { id: string; uid: string; kind: 'received' | 'installed' | 'sim-used' | 'job-completed'; shift_id?: string; job_type?: JobType; device_model: DeviceModel | ''; device_imeis?: string[]; sim_numbers?: string[]; quantity: number; sim_count: number; sim_provider?: SimProvider; customer_ref: string; vehicle_ref: string; notes: string; captured_at: string; }
export const roleLabel = (role: Role) => ({ master_admin: 'Master administrator', admin: 'Administrator', manager: 'Manager', accountant: 'Accountant', hr: 'Human resources', it: 'IT support', technician: 'Technician' }[role]);
export const jobLabel = (job: JobType) => ({ new_installation: 'New installation', sim_change: 'SIM change', sim_device_change: 'SIM and device change', device_removal: 'Device removal' }[job]);
