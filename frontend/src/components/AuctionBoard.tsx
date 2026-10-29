import { useBag } from '../state';
import MarketRange from './MarketRange';
import { type AuctionState, type Perk } from '../auction';
import { money, product, shops, type Currency, type ShopId } from '../fixture';
import { Photo } from './MemberUI';
const labels: Record<Perk, string> = { older: 'Older packaging', kit: 'Sample kit', bundle: 'Bundle', freeship: 'Ships free in Korea' };
export function AuctionBoard({ state, currency, ownShop, floors }: { state: AuctionState; currency: Currency; ownShop?: ShopId; floors?: Record<string, number> }) {
  const { store } = useBag();
  return <div className="auction-items">{Object.values(state.items).map(item => {
    const details = store?.products.find(product => product.id === item.id) || product(item.id);
    const winning = item.lanes.find(lane => lane.won);
    const prices = item.lanes.flatMap(lane => lane.price === null ? [] : [lane.price]);
    const high = Math.max(item.bestListed, ...prices), low = Math.min(...prices) * .85;
    return <section className="auction-item" key={item.id} aria-label={`${product(item.id).name} bids`}>
      <div className="auction-product"><Photo item={product(item.id)} older={!!winning?.perks.includes('older')} /><div><h2>{product(item.id).name}</h2><p className="fine">{product(item.id).brand} · {product(item.id).size}</p>{winning ? <p className="winner-label">Won by {shops[winning.shop].name}</p> : <p className="fine">{item.lanes.length === 1 ? `Only at ${shops[item.lanes[0].shop].name}` : `${item.lanes.length} shops bid`}</p>}</div></div><MarketRange reference={details.market} />
      <div className="auction-lanes">{item.lanes.map(lane => {
        const position = lane.price === null ? 100 : Math.max(0, Math.min(100, (lane.price - low) / Math.max(1, high - low) * 100));
        const floor = lane.shop === ownShop ? floors?.[item.id + (lane.perks.includes('older') ? ':older' : '')] : undefined;
        return <div key={lane.shop} className={`auction-lane ${lane.won ? 'won' : lane.lost ? 'lost' : lane.leading ? 'leading' : ''} ${lane.bidAt === state.applied.length ? 'new-bid' : ''}`}>
          <div className="lane-heading"><span>{shops[lane.shop].name}{lane.shop === ownShop ? ' · you' : ''}</span><strong className="money">{lane.passed ? 'Pass' : lane.price === null ? 'Waiting' : money(lane.price, currency)}</strong></div>
          <div className="bid-track" role="img" aria-label={`${shops[lane.shop].name}: ${lane.passed ? 'Pass' : lane.price === null ? 'Waiting' : money(lane.price, currency)}${lane.leading ? ', leading' : ''}${lane.won ? ', won' : ''}`}><span className="bid-marker" style={{ left: `${position}%` }} />{floor !== undefined && <span className="bid-floor" style={{ left: `${Math.max(0, Math.min(100, (floor - low) / Math.max(1, high - low) * 100))}%` }} />}</div>
          {floor !== undefined && <p className="fine">Your lowest: <span className="money">{money(floor, currency)}</span></p>}
          {!!lane.perks.length && <div className="perk-chips">{lane.perks.map(perk => <span key={perk} className={perk === 'older' || perk === 'bundle' ? 'rule-chip' : 'gift-chip'}>{labels[perk]}</span>)}</div>}
        </div>;
      })}</div>
      {winning?.price !== null && winning && <p className="item-saving"><span className="money">{money(Math.max(0, item.bestListed - winning.price!), currency)}</span> less than best listed <del className="money">{money(item.bestListed, currency)}</del></p>}
    </section>;
  })}</div>;
}
export function AuctionBox({ state, currency, ownShop }: { state: AuctionState; currency: Currency; ownShop?: ShopId }) {
  return <section className="auction-box"><h2>{ownShop ? 'Your result' : 'Your box'}</h2>{(ownShop ? [ownShop] : Object.keys(shops) as ShopId[]).map(shop => {
    const won = Object.values(state.items).filter(item => item.winner === shop);
    return <div key={shop} className="box-shop"><h3>{shops[shop].name}</h3>{!won.length ? <p className="muted">Outbid</p> : <><ul>{won.map(item => { const lane = item.lanes.find(lane => lane.won)!; return <li key={item.id}><span>{product(item.id).name}</span><strong className="money">{money(lane.price!, currency)}</strong><small>{lane.perks.map(perk => labels[perk]).join(' · ')}</small></li>; })}</ul><p className="box-subtotal">Items <strong className="money">{money(won.reduce((sum, item) => sum + item.lanes.find(lane => lane.won)!.price!, 0), currency)}</strong></p></> }</div>;
  })}</section>;
}
