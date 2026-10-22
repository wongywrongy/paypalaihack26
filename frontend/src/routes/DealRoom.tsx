import { useEffect, useRef, useState } from 'react';
import { fixture as f, money, publicOffers } from '../fixture';
import { Header, Photo } from '../components/MemberUI';
const change = (delta: number | null) => delta === null ? 'Opening price' : delta === 0 ? 'Unchanged' : `${delta > 0 ? 'Up' : 'Down'} ${money(Math.abs(delta))} / unit`;
export default function DealRoom() {
  const scrollRegion = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<'opening' | 'middle' | 'agreed' | 'all'>('opening');
  function updatePosition() {
    const element = scrollRegion.current;
    if (!element) return;
    const end = element.scrollWidth - element.clientWidth;
    setPosition(end <= 1 ? 'all' : element.scrollLeft <= 1 ? 'opening' : element.scrollLeft >= end - 1 ? 'agreed' : 'middle');
  }
  useEffect(() => {
    const element = scrollRegion.current;
    if (!element) return;
    const observer = new ResizeObserver(updatePosition);
    observer.observe(element);
    updatePosition();
    return () => observer.disconnect();
  }, []);
  function jump() {
    const element = scrollRegion.current;
    if (!element) return;
    element.scrollTo({ left: position === 'agreed' ? 0 : element.scrollWidth, behavior: 'instant' });
    updatePosition();
  }
  const feedback = position === 'agreed' ? 'Agreed terms in view' : position === 'opening' ? 'Opening offer in view' : position === 'all' ? 'All offers in view' : 'Comparing offers';

  return <main className="deal-room"><Header back="/live" title="Behind the deal" /><div className="deal-heading"><div><h1>How the deal<br />was made.</h1><p className="intro">{f.community} × {f.shop}</p><p className="exchange-disclosure">Example exchange · no live agents or payments</p></div></div><div className="deal-layout"><section>
    <section className="exchange" aria-labelledby="exchange-title"><h2 id="exchange-title">The offers, back and forth</h2><p className="muted">Illustrative proposals reconstructed from the saved example terms. This is not a live agent transcript.</p>
      <ol className="offer-history" aria-label="Example bargaining history">{publicOffers.map((offer, index) => <li className="offer-event" id={offer.id} key={offer.id}>
        <p className="offer-actor">{offer.actor === 'buyer' ? `${f.community} · buying agent` : `${f.shop} · shop agent`}<span>Offer {offer.sequence} of {publicOffers.length}</span></p>
        <h3>{offer.title}</h3><p className="offer-proposal">{offer.proposal}</p>
        <p className="offer-price-label">Unit prices · before shipping, duty, fees and tax</p>
        <dl className="offer-prices">{offer.lines.map(line => <div key={line.product.id}>
          <dt>{index === 0 && <Photo product={line.product} />}<span>{line.product.id === 'ess_new' ? 'Essence · new' : line.product.id === 'ess_old' ? 'Essence · old' : line.product.id === 'msk' ? 'Cica masks' : line.product.name}<small>{line.product.id.startsWith('ess_') ? '100 ml' : line.product.detail}</small></span></dt>
          <dd><strong className="money">{money(line.unit)}<span> / unit</span></strong><small>{change(line.delta)}</small></dd>
        </div>)}</dl>
        <div className="offer-shared"><p><strong>{offer.freight.kind}</strong><span><span className="money">{money(offer.freight.groupCost)}</span> for the whole group{offer.freight.delta === null ? '' : offer.freight.delta === 0 ? ' · unchanged' : ` · ${money(Math.abs(offer.freight.delta))} ${offer.freight.delta > 0 ? 'more' : 'less'} than the previous offer`}</span></p><p><strong>Free sample kits</strong><span>{offer.freeKits} for the group{offer.freeKits > 0 ? ' · one per person' : ''}</span></p></div>
        {offer.id === 'shop-counter' && <section className="human-choice" aria-label="Aisha’s choice"><h4>Aisha keeps the new bottle</h4><p>The old bottle is {money(f.question.newPrice - f.question.oldPrice)} cheaper. Your rule allows the swap; Aisha’s does not. She is asked once and keeps new. No answer would keep her original choice too.</p><a className="text-link" href="/ask">See Aisha’s example question</a></section>}
      </li>)}</ol>
      <section className="acceptance" aria-labelledby="acceptance-title"><h2 id="acceptance-title">Final terms pass the code checks</h2><div className="deal-result"><span>Complete final group total</span><strong className="money">{money(f.group.total)}</strong><p>from {money(f.group.held)} held in the example</p></div><p>All {f.group.count} saved member totals are under their max. They sum to <span className="money">{money(f.group.total)}</span> for the group.</p><p>Your complete final share is <strong className="money">{money(f.total)}</strong>, under your <span className="money">{money(f.max)}</span> max—including shipping, duty, fees and tax.</p><p>Example totals checked from the saved scenario.</p><a className="text-link" href="/done">See your example price</a></section>
    </section>
    <section className="terms-comparison" aria-labelledby="terms-title"><h2 id="terms-title">Compare all the terms</h2><p className="muted">Unit prices before shared costs. Quantities shown are for the final order. Scroll the offers on a small screen.</p><div className="table-nav" hidden={position === 'all'}><button type="button" className="table-jump" aria-controls="deal-offers" aria-describedby="table-position" onClick={jump}>{position === 'agreed' ? 'Show opening offer' : 'Show agreed terms'}</button><p id="table-position" role="status" aria-atomic="true">{feedback}</p></div><div ref={scrollRegion} id="deal-offers" className="table-scroll" tabIndex={0} role="region" aria-label="Offers and agreed terms" aria-describedby="table-position" onScroll={updatePosition}><table><thead><tr><th scope="col">Term</th><th scope="col">Our first offer</th><th scope="col">Shop’s reply</th><th scope="col">Our next offer</th><th scope="col">Agreed</th></tr></thead><tbody>{f.terms.map(term => {
    const product = f.products.find(product => product.id === term.id)!;
    return <tr key={term.id}><th scope="row"><div className="term-product"><Photo product={product} /><span>{product.name}<small>{product.detail} · ×{term.qty}</small></span></div></th>{term.offers.map((offer, i) => <td className="money" key={i}>{money(offer)}</td>)}<td className="money agreed">{money(term.agreed)}</td></tr>;
  })}<tr><th scope="row">Shipping<small>One box to {f.destination}</small></th><td>Express<br /><span className="money">{money(f.freight.express)}</span></td><td>Express<br /><span className="money">{money(f.freight.express)}</span></td><td>Shared freight<br /><span className="money">{money(f.freight.agreed)}</span></td><td className="agreed">{f.dates.ships}<br /><span className="money">{money(f.freight.agreed)}</span></td></tr><tr><th scope="row">Extras</th><td>None</td><td>None</td><td>Sample kits</td><td className="agreed">{f.group.count} free kits</td></tr></tbody></table></div></section><div className="privacy"><section><h2>Our agent saw</h2><p>Everyone’s items and rules, the group’s total max and the shop’s offers. Never the shop’s costs.</p></section><section><h2>The shop’s agent saw</h2><p>Total held, item counts and delivery window. Never anyone’s individual max or rules.</p></section></div></section><aside className="exchange-summary"><h2>What changed?</h2><p>Old bottles cost {money(f.bottleGap)} less than new. {f.terms.find(term => term.id === 'ess_old')!.qty} bottles use the old packaging; Aisha keeps new.</p><p>Shared freight changes the group’s shipping from <span className="money">{money(f.freight.express)}</span> to <strong className="money">{money(f.freight.agreed)}</strong>, with {f.group.count} free sample kits.</p><p>The final shop counter changes the item prices. Code checks the complete shares against everyone’s max.</p></aside></div><footer className="deal-footer"><p className="fine">Illustrative scenario. Fictional shop and products. No money moves.</p></footer></main>;
}
