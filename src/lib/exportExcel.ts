import * as XLSX from 'xlsx';
import { Installation } from '../types';

export function exportInstallationsToExcel(
  installations: Installation[],
  techEmail: string
) {
  if (!installations || installations.length === 0) {
    throw new Error('No installation records available to export.');
  }

  // Format data specifically with required columns: Date, Customer Name, Device, IMEI
  const rows = installations.map((item) => {
    let formattedDate = '';
    try {
      const d = new Date(item.timestamp);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      } else {
        formattedDate = String(item.timestamp);
      }
    } catch {
      formattedDate = String(item.timestamp);
    }

    return {
      'Date': formattedDate,
      'Customer Name': item.customer_name,
      'Device': item.device_type,
      'IMEI': item.imei,
      'SIM Number': item.sim_number || 'N/A',
      'Relay Installed': item.relay_installed ? 'Yes' : 'No',
      'Technician Email': item.tech_email,
      'Notes': item.notes || ''
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths for clean readability in Excel
  worksheet['!cols'] = [
    { wch: 20 }, // Date
    { wch: 28 }, // Customer Name
    { wch: 24 }, // Device
    { wch: 20 }, // IMEI
    { wch: 22 }, // SIM Number
    { wch: 16 }, // Relay Installed
    { wch: 28 }, // Technician Email
    { wch: 25 }  // Notes
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Installations');

  const cleanDate = new Date().toISOString().slice(0, 10);
  const safeEmail = techEmail.split('@')[0] || 'tech';
  const fileName = `Installations_${safeEmail}_${cleanDate}.xlsx`;

  XLSX.writeFile(workbook, fileName);
}
