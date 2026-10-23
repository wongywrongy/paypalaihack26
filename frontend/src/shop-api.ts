// Private values exist only in the authenticated shop response, never the public projection.
export type ShopProduct = { id: string; variant?: string; listed: number; lowest: number; cost: number; stock?: number; days?: number; goal: string };
export type ShopSnapshot = { shopId: 'dalbit'; readOnly: boolean; products: ShopProduct[]; order: { id: string; payout: number; gain: number; sampleCost: number; status: string }; settings: { older: boolean; autoAccept: boolean } };
export async function loadShop(signal: AbortSignal): Promise<ShopSnapshot> {
  const response = await fetch('/api/shops/dalbit/workspace', { credentials: 'same-origin', signal });
  if (!response.ok) throw new Error('Shop access is unavailable');
  const value = await response.json();
  if (value.shopId !== 'dalbit' || !Array.isArray(value.products) || !value.products.every((row: ShopProduct) => typeof row.id === 'string' && [row.listed,row.lowest,row.cost].every(n => Number.isSafeInteger(n) && n >= 0)) || ![value.order?.payout,value.order?.gain,value.order?.sampleCost].every(Number.isSafeInteger) || typeof value.readOnly !== 'boolean' || typeof value.settings?.older !== 'boolean' || typeof value.settings?.autoAccept !== 'boolean') throw new Error('Invalid shop response');
  return value;
}
