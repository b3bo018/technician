import { ACCESSORY_STOCK_KEYS, DEVICE_MODELS, SIM_STOCK_KEYS, Stock } from '../types';
import { useDeviceModels } from './DeviceManagement';
export function StockGrid({ stock,includeModel }: { stock: Stock | null;includeModel?:(model:string)=>boolean }) {
 const catalogue=useDeviceModels(true);const models=[...new Set([...DEVICE_MODELS,...catalogue.filter(item=>item.status!=='archived').map(item=>item.name)])];
 return <div className="stock-grid">{[...models,...ACCESSORY_STOCK_KEYS,...SIM_STOCK_KEYS].filter(model=>!includeModel||includeModel(model)).map(model => <div className={'stock-cell ' + (stock && (stock[model]||0) < 0 ? 'negative' : '')} key={model}><span>{model === 'SIM' ? 'SIM · Unassigned' : model}</span><strong>{stock ? stock[model]||0 : '—'}</strong><small>{model.startsWith('SIM') ? model==='SIM'?'legacy cards':'cards available' : ACCESSORY_STOCK_KEYS.includes(model as any)?'accessories available':'units available'}</small></div>)}</div>;
}
