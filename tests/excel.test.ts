import test from 'node:test';
import assert from 'node:assert/strict';
import { createReportWorkbook } from '../src/lib/excel';
import { emptyStock } from '../src/types';
test('Excel report leads with simple customer, device and SIM usage',async()=>{
 const tech={uid:'a',email:'a@example.test',displayName:'A',role:'technician' as const};
 const book=await createReportWorkbook([tech],[{id:'1',technician_id:'a',technician_name:'A',job_type:'new_installation',unit_count:1,device_model:'FMC920',sim_count:1,sim_provider:'Etisalat',customer_ref:'Acme',vehicle_ref:'Car',notes:'',timestamp:'2026-09-14T08:00:00Z'},{id:'2',technician_id:'b',technician_name:'B',device_model:'GT06',sim_count:0,customer_ref:'Hidden',vehicle_ref:'',notes:'',timestamp:'2026-09-14T08:00:00Z'}],[],[{technician_id:'a',opening:emptyStock(),timestamp:'2026-09-01T00:00:00Z'}],[],[],[],'2026-09-14','2026-09-14');
 const buffer=await book.xlsx.writeBuffer();const {default:ExcelJS}=await import('exceljs');const {Workbook}=ExcelJS;const restored=new Workbook();await restored.xlsx.load(buffer);
 assert.equal(restored.worksheets.length,6);assert.ok(restored.getWorksheet('Summary'));assert.ok(restored.getWorksheet('Jobs'));const usage=restored.getWorksheet('Customer usage')!;assert.equal(usage.rowCount,2);assert.equal(usage.getCell('C2').value,'Acme');assert.equal(usage.getCell('F2').value,'FMC920');assert.equal(usage.getCell('G2').value,1);assert.equal(usage.getCell('H2').value,'Etisalat');assert.equal(usage.getCell('I2').value,1);assert.ok(restored.getWorksheet('Technician inventory'));
});
