export type UserRole = 'technician' | 'admin';

export interface VanInventory {
  fmc920: number;
  fmc130: number;
  sim_cards: number;
  relays: number;
}

export const DEFAULT_INVENTORY: VanInventory = {
  fmc920: 15,
  fmc130: 15,
  sim_cards: 30,
  relays: 20
};

export interface TechnicianUser {
  uid: string;
  email: string;
  role: UserRole;
  inventory_count: number; // total devices (fmc920 + fmc130)
  inventory_breakdown?: VanInventory;
  displayName?: string;
  created_at?: string;
  status?: 'active' | 'deactivated';
  phone?: string;
}

export interface Installation {
  id?: string;
  tech_id: string;
  tech_email: string;
  customer_name: string;
  device_type: string; // 'Teltonika FMC920' | 'Teltonika FMC130' | string
  imei: string;
  sim_number: string; // SIM card / ICCID number
  relay_installed?: boolean; // 12V/24V immobilizer relay
  timestamp: string; // ISO string or Firestore Timestamp representation
  notes?: string;
  syncedFromOfflineQueue?: boolean;
  offlineQueuedAt?: string;
}

export interface CustomerOption {
  id: string;
  name: string;
  category: string;
  contactPerson?: string;
  phone?: string;
}

export const TELTONIKA_DEVICES = [
  'Teltonika FMC920',
  'Teltonika FMC130'
] as const;

export const DEFAULT_CUSTOMERS: CustomerOption[] = [
  { id: 'cust-1', name: 'Apex Fleet Logistics', category: 'Fleet Transport', phone: '+971 50 123 4567' },
  { id: 'cust-2', name: 'Metro Courier Services', category: 'Last-Mile Delivery', phone: '+971 52 234 5678' },
  { id: 'cust-3', name: 'Velocity Heavy Haul', category: 'Freight & Cargo', phone: '+971 55 345 6789' },
  { id: 'cust-4', name: 'BlueWave Utilities & Power', category: 'Field Service', phone: '+971 56 456 7890' },
  { id: 'cust-5', name: 'Global Cold Chain Express', category: 'Refrigerated Transport', phone: '+971 54 567 8901' },
  { id: 'cust-6', name: 'Titan Heavy Machinery Inc.', category: 'Construction & Plant', phone: '+971 58 678 9012' },
  { id: 'cust-7', name: 'Urban Green Transit', category: 'Passenger Transit', phone: '+971 50 789 0123' }
];

export const COMMON_DEVICE_MODELS: string[] = [
  'Teltonika FMC920',
  'Teltonika FMC130'
];
