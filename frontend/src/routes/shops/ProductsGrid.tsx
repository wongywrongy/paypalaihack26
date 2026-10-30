import { useState } from 'react';
import { AllCommunityModule, themeQuartz, type ColDef } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import { request } from '../../connected';
import { money, product, type ShopId } from '../../fixture';
import type { ListingChange, ShopProduct } from '../../shop-api';
const theme = themeQuartz.withParams({ accentColor: '#B4235A', backgroundColor: '#FFFFFF', foregroundColor: '#17161A', headerBackgroundColor: '#F7F4F0', borderColor: '#E4DFD8', fontFamily: 'Schibsted Grotesk', fontSize: 14, wrapperBorderRadius: 12 });
export default function ProductsGrid({ rows, changes, shop, readOnly, refresh }: { rows: ShopProduct[]; changes: ListingChange[]; shop: ShopId; readOnly: boolean; refresh: () => void }) {
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const columns: ColDef<ShopProduct>[] = [
    { headerName: 'Product', valueGetter: params => params.data ? `${product(params.data.id).name}${params.data.variant === 'older' ? ' · older packaging' : ''}` : '', minWidth: 240, flex: 2 },
    ...(['listed', 'lowest', 'cost'] as const).map((field, index): ColDef<ShopProduct> => ({ field, headerName: ['Listed (USD)', 'Lowest price (USD)', 'Your cost (USD)'][index], valueGetter: p => p.data ? p.data[field] / 100 : 0, valueFormatter: p => money(Math.round(Number(p.value) * 100)), editable: field !== 'cost' && !readOnly && !busy, cellEditor: 'agTextCellEditor', type: 'numericColumn', minWidth: 160 })),
    { field: 'stock', headerName: 'In stock', editable: !readOnly && !busy, cellEditor: 'agTextCellEditor', type: 'numericColumn', minWidth: 115, cellClassRules: { 'low-stock': p => Number(p.value) <= 3 } },
    { field: 'days', headerName: 'Days on shelf', type: 'numericColumn', minWidth: 130 },
    { field: 'goal', headerName: 'Goal', minWidth: 160 },
  ];
  async function save(row: ShopProduct, field: string, raw: unknown) {
    const value = String(raw);
    if (!(field === 'stock' ? /^\d+$/ : /^\d+(\.\d{1,2})?$/).test(value)) { setMessage(`${product(row.id).name}: enter ${field === 'stock' ? 'whole units from 0 to 500' : 'a USD amount with up to two decimals'}.`); return; }
    const next = { ...row, [field]: field === 'stock' ? Number(value) : Math.round(Number(value) * 100) };
    if (next.lowest < next.cost || next.lowest > next.listed || Number(next.stock) > 500) { setMessage(`${product(row.id).name}: lowest price must stay between cost and listed price; stock must be 0–500.`); return; }
    setBusy(true); setMessage('Saving listing…');
    try { await request(`/shops/${shop}/products/${row.offer_id}`, { method: 'PATCH', body: { list_usd: next.listed, floor_usd: next.lowest, stock: next.stock, version: row.version } }); setMessage(`${product(row.id).name}: listing saved.`); refresh(); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  return <><p className="fine">{readOnly ? 'Prices are in USD.' : 'Select a price or stock cell and press Enter to edit. Enter prices in USD.'}</p><p role="status" aria-live="polite">{message}</p><div className="private-grid" role="region" aria-label="Private shop product prices"><AgGridProvider modules={[AllCommunityModule]}><AgGridReact theme={theme} rowData={rows} columnDefs={columns} readOnlyEdit onCellEditRequest={event => { if (event.data && event.colDef.field) void save(event.data, event.colDef.field, event.newValue); }} getRowId={p => p.data.offer_id || p.data.id} defaultColDef={{ sortable: true, filter: true, resizable: true }} rowHeight={48} headerHeight={48} animateRows={false} /></AgGridProvider></div><button className="text-link" disabled={readOnly || busy} onClick={async () => { setBusy(true); try { await request(`/shops/${shop}/reset`, { method: 'POST', body: {} }); setMessage('Launch settings restored.'); refresh(); } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); } }}>Reset to launch settings</button><section className="shop-group"><h2>Recent changes</h2>{changes.length ? <ul>{changes.map(change => <li key={change.id}><strong>{change.offer_id ? product(change.offer_id.split('/')[1].split(':')[0]).name : 'Agent goals'}</strong> · {change.action} · <time dateTime={change.created_at}>{new Date(change.created_at).toLocaleString()}</time>{change.after.list_usd !== undefined && <span> · Listed {money(change.after.list_usd)} · Lowest {money(change.after.floor_usd)} · Stock {change.after.stock}</span>}</li>)}</ul> : <p>No changes yet.</p>}</section></>;
}
