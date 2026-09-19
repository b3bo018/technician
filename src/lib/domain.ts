import { Attendance, DEVICE_MODELS, Installation, InventoryAccount, Movement, Shift, SimProvider, Stock, Technician, emptyStock, simStockKey, SIM_PROVIDERS, SIM_STOCK_KEYS } from '../types';
export const TIME_ZONE = import.meta.env?.VITE_BUSINESS_TIME_ZONE || 'Asia/Dubai';
export function dayKey(value: string | Date, timezone = TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}
export function displayTime(value: string, timezone = TIME_ZONE) {
  return new Date(value).toLocaleString('en-GB', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' });
}
export function localToISO(date: string, time: string, timezone = TIME_ZONE): string {
  const target = Date.parse(date + 'T' + time + ':00Z');
  let guess = target;
  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
    const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
    const rendered = Date.parse(p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute + ':' + p.second + 'Z');
    guess += target - rendered;
  }
  if (!Number.isFinite(guess)) throw new Error('Enter a valid date and time.');
  return new Date(guess).toISOString();
}
export function nextDate(date: string, offset = 1) { return new Date(Date.parse(date + 'T12:00:00Z') + offset * 86400000).toISOString().slice(0, 10); }
export function periodRange(anchor: string, period: 'daily' | 'weekly' | 'monthly' | 'custom'): [string, string] {
  if (period === 'monthly') return [anchor.slice(0, 7) + '-01', new Date(Date.UTC(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)), 0, 12)).toISOString().slice(0, 10)];
  if (period === 'weekly') {
    const dow = new Date(anchor + 'T12:00:00Z').getUTCDay();
    const first = nextDate(anchor, -((dow + 6) % 7)); return [first, nextDate(first, 6)];
  }
  return [anchor, anchor];
}
export function openingStock(user: Technician): Stock {
  const bd = user.inventory_breakdown;
  return { ...emptyStock(), FMC920: bd?.fmc920 ?? Math.floor((user.inventory_count || 0) / 2), FMC130: bd?.fmc130 ?? Math.ceil((user.inventory_count || 0) / 2), SIM: bd?.sim_cards ?? 0 };
}
export function stockAt(account: InventoryAccount | undefined, movements: Movement[], through?: string): Stock | null {
  if (!account || (through && dayKey(account.timestamp) > through)) return null;
  const stock = { ...emptyStock(), ...account.opening };
  for (const m of movements) {
    if (through && dayKey(m.timestamp) > through) continue;
    const sign = m.type === 'received' ? 1 : -1;
    if (m.device_model) stock[m.device_model] += sign * m.quantity;
    stock[simStockKey(m.sim_provider)] += sign * m.sim_count;
  }
  return stock;
}
export function simTotal(stock: Stock | null) { return stock ? SIM_STOCK_KEYS.reduce((sum, key) => sum + stock[key], 0) : null; }
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}
export function attendanceStatus(shift: Shift, checkin?: Attendance, now = Date.now()) {
  if (!checkin) return { timing: now > Date.parse(shift.scheduled_at) + shift.grace_minutes * 60000 ? 'Missing' : 'Scheduled', location: 'No check-in', distance: null as number | null };
  if (!Number.isFinite(shift.latitude) || !Number.isFinite(shift.longitude)) return {
    timing: Date.parse(checkin.timestamp) <= Date.parse(shift.scheduled_at) + shift.grace_minutes * 60000 ? 'On time' : 'Late',
    location: 'Location recorded', distance: null as number | null
  };
  const distance = distanceMeters(shift.latitude!, shift.longitude!, checkin.latitude, checkin.longitude);
  return {
    timing: Date.parse(checkin.timestamp) <= Date.parse(shift.scheduled_at) + shift.grace_minutes * 60000 ? 'On time' : 'Late',
    location: distance > shift.radius_m ? 'Outside site' : checkin.accuracy_m > shift.radius_m ? 'Low GPS accuracy' : 'At site',
    distance: Math.round(distance)
  };
}
export function validateOperation(op: { kind: string; device_model: string; quantity: number; sim_count: number; sim_provider?: SimProvider; customer_ref: string; shift_id?: string; job_type?: string; device_imeis?: string[]; sim_numbers?: string[] }) {
  if (!['received', 'installed', 'sim-used', 'job-completed'].includes(op.kind)) throw new Error('Choose a valid stock action.');
  if (!Number.isInteger(op.quantity) || !Number.isInteger(op.sim_count) || op.quantity < 0 || op.sim_count < 0 || op.quantity > 10000 || op.sim_count > 10000) throw new Error('Quantities must be whole numbers between 0 and 10,000.');
  if (op.quantity > 0 && !DEVICE_MODELS.includes(op.device_model as any)) throw new Error('Select a device model.');
  if (op.quantity === 0 && op.device_model !== '') throw new Error('SIM-only entries must not include a device.');
  if (op.quantity + op.sim_count === 0 && op.kind !== 'job-completed') throw new Error('Enter a device or SIM quantity.');
  if (op.sim_count > 0 && !SIM_PROVIDERS.includes(op.sim_provider as SimProvider)) throw new Error('Choose Etisalat, du, or International for the SIM stock.');
  if (op.kind === 'sim-used' && (op.quantity !== 0 || op.sim_count < 1)) throw new Error('Enter the SIM quantity used.');
  if (op.kind === 'installed' && (op.quantity !== 1 || op.sim_count > 1 || !op.customer_ref.trim())) throw new Error('An installation requires one device and a customer reference, with zero or one SIM.');
  if (op.kind === 'job-completed') {
    if (!op.shift_id || !['new_installation','sim_change','sim_device_change','device_removal'].includes(op.job_type || '')) throw new Error('This completion must belong to an assigned job.');
    if (!op.customer_ref.trim()) throw new Error('The assigned company is required.');
    if (['new_installation','sim_device_change'].includes(op.job_type || '') && (!op.device_model || !op.device_imeis?.length || !op.sim_numbers?.length)) throw new Error('Scan or enter every device IMEI and SIM number.');
    if (op.job_type === 'sim_change' && !op.sim_numbers?.length) throw new Error('Scan or enter every replacement SIM number.');
    if (op.job_type === 'device_removal' && !op.device_imeis?.length) throw new Error('Scan or enter every removed device IMEI.');
  }
}
export function overtimeMinutes(shift: Shift, checkin: Attendance | undefined, installation: Installation | undefined) {
  if (!installation) return 0;
  const end = Date.parse(installation.timestamp);
  const start = checkin ? Date.parse(checkin.timestamp) : Date.parse(shift.scheduled_at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const workStart = Date.parse(localToISO(shift.date, '09:00', shift.timezone));
  const workEnd = Date.parse(localToISO(shift.date, '18:00', shift.timezone));
  const before = Math.max(0, Math.min(end, workStart) - start);
  const after = Math.max(0, end - Math.max(start, workEnd));
  return Math.ceil((before + after) / 60000);
}
export function workDurationMinutes(shift: Shift, checkin: Attendance | undefined, installation: Installation | undefined) {
  if (!installation) return 0;
  const start = Date.parse(checkin?.timestamp || shift.scheduled_at);
  const end = Date.parse(installation.timestamp);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.ceil((end - start) / 60000);
}
export function jobPerformanceScore(shift: Shift, checkin: Attendance | undefined, installation: Installation | undefined) {
  const minutes = workDurationMinutes(shift, checkin, installation);
  if (!minutes) return 0;
  const perUnit = ['new_installation','sim_device_change'].includes(shift.job_type) ? 120 : 60;
  const expected = perUnit * Math.max(1, shift.unit_count || 1);
  return Math.max(0, Math.min(100, Math.round(expected / minutes * 100)));
}
export function csvCell(value: unknown) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
export function buildReport(technicians: Technician[], installations: Installation[], movements: Movement[], accounts: InventoryAccount[], shifts: Shift[], attendance: Attendance[], from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || !Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to)) || from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 366) throw new Error('Choose a valid date range of up to one year.');
  const rows: Record<string, string | number>[] = [];
  for (const tech of technicians) for (let date = from; date <= to; date = nextDate(date)) {
    const daily = installations.filter(i => i.technician_id === tech.uid && dayKey(i.timestamp) === date);
    const stock = stockAt(accounts.find(a => a.technician_id === tech.uid), movements.filter(m => m.technician_id === tech.uid), date);
    const assigned = shifts.filter(s => s.technician_id === tech.uid && s.date === date);
    const matches = assigned.map(s => ({ s, a: attendance.find(a => a.id === s.id) }));
    const row: Record<string, string | number> = { Technician: tech.displayName || tech.email, Email: tech.email, Date: date, Timezone: TIME_ZONE, Installations: daily.length };
    for (const model of DEVICE_MODELS) row[model + ' installed'] = daily.filter(i => i.device_model === model || i.device_model === 'Teltonika ' + model).length;
    row['SIMs used in installations'] = daily.reduce((n, i) => n + i.sim_count, 0);
    for (const provider of SIM_PROVIDERS) row[provider + ' SIMs used'] = daily.filter(i => i.sim_provider === provider).reduce((n, i) => n + i.sim_count, 0);
    row['SIMs used separately'] = movements.filter(m => m.technician_id === tech.uid && m.type === 'sim-used' && dayKey(m.timestamp) === date).reduce((n, m) => n + m.sim_count, 0);
    for (const model of DEVICE_MODELS) row[model + ' remaining (end of day)'] = stock ? stock[model] : 'Unavailable before opening balance';
    for (const provider of SIM_PROVIDERS) row[provider + ' SIMs remaining (end of day)'] = stock ? stock[simStockKey(provider)] : 'Unavailable before opening balance';
    row['Unassigned legacy SIMs remaining'] = stock ? stock.SIM : 'Unavailable before opening balance';
    row['Overtime minutes'] = assigned.reduce((sum, s) => sum + overtimeMinutes(s, attendance.find(a => a.id === s.id), daily.find(i => i.shift_id === s.id || i.id === s.id)), 0);
    row['Scheduled sites / arrival times'] = assigned.map(s => s.site_name + ': ' + displayTime(s.scheduled_at, s.timezone)).join(' | ');
    row['Check-in times / locations / accuracy'] = matches.map(({ s, a }) => a ? s.site_name + ': ' + displayTime(a.timestamp, s.timezone) + ' / ' + a.latitude + ', ' + a.longitude + ' / ±' + Math.round(a.accuracy_m) + 'm' : s.site_name + ': no check-in').join(' | ');
    row.Attendance = matches.map(({ s, a }) => { const st = attendanceStatus(s, a); return s.site_name + ': ' + st.timing + ', ' + st.location; }).join(' | ');
    rows.push(row);
  }
  return rows;
}
export function downloadCSV(rows: Record<string, string | number>[], filename: string) {
  if (!rows.length) throw new Error('No technicians match this report.');
  const keys = Object.keys(rows[0]);
  const content = '\uFEFF' + [keys.map(csvCell).join(','), ...rows.map(row => keys.map(k => csvCell(row[k])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
