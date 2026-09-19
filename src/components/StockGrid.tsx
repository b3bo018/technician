import { DEVICE_MODELS, SIM_STOCK_KEYS, Stock } from '../types';
export function StockGrid({ stock }: { stock: Stock | null }) {
 return <div className="stock-grid">{[...DEVICE_MODELS,...SIM_STOCK_KEYS].map(model => <div className={'stock-cell ' + (stock && stock[model] < 0 ? 'negative' : '')} key={model}><span>{model === 'SIM' ? 'SIM · Unassigned' : model}</span><strong>{stock ? stock[model] : '—'}</strong><small>{model.startsWith('SIM') ? model==='SIM'?'legacy cards':'cards available' : 'units available'}</small></div>)}</div>;
}
