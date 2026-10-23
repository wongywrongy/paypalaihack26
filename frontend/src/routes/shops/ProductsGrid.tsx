import { AllCommunityModule, themeQuartz, type ColDef } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import { money, product } from '../../fixture';
import type { ShopProduct } from '../../shop-api';
const theme = themeQuartz.withParams({ accentColor: '#B4235A', backgroundColor: '#FFFFFF', foregroundColor: '#17161A', headerBackgroundColor: '#F7F4F0', borderColor: '#E4DFD8', fontFamily: 'Schibsted Grotesk', fontSize: 14, wrapperBorderRadius: 12 });
const columns: ColDef<ShopProduct>[] = [
  { headerName: 'Product', valueGetter: params => params.data ? `${product(params.data.id).name}${params.data.variant === 'older' ? ' · older packaging' : ''}` : '', minWidth: 240, flex: 2 },
  ...(['listed', 'lowest', 'cost'] as const).map((field, index) => ({ field, headerName: ['Listed', 'Lowest price', 'Your cost'][index], valueFormatter: (params: { value: number }) => money(params.value), type: 'numericColumn', minWidth: 130 })),
  { field: 'stock', headerName: 'In stock', type: 'numericColumn', minWidth: 110 },
  { field: 'days', headerName: 'Days on shelf', type: 'numericColumn', minWidth: 130 },
  { field: 'goal', headerName: 'Goal', minWidth: 160 },
];
export default function ProductsGrid({ rows }: { rows: ShopProduct[] }) {
  return <div className="private-grid" role="region" aria-label="Private shop product prices"><AgGridProvider modules={[AllCommunityModule]}><AgGridReact theme={theme} rowData={rows} columnDefs={columns} defaultColDef={{ sortable: true, filter: true, resizable: true }} rowHeight={48} headerHeight={48} animateRows={false} /></AgGridProvider></div>;
}
