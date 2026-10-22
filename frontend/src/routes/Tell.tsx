import { fixture as f, money } from '../fixture';
import { Action, Photo, Screen } from '../components/MemberUI';
export default function Tell() {
  return <Screen back="/invite" title="Your order"><h1>What do you want?</h1><label className="field-label" htmlFor="request">Your example request</label><textarea id="request" value={f.request} readOnly rows={4} /><p className="basket-intro">Here’s your basket</p><div className="mini-products">{f.catalog.map(product => <div key={product.id}><Photo product={product} /><strong>{product.name}</strong></div>)}</div>
    <p className="max-line">Your max, all in <strong className="money">{money(f.max)}</strong></p>
    <div className="plain-section"><h2>A different bottle. Same formula.</h2><p>The essence has new packaging. Your example allows the old bottle when it is at least $4 cheaper.</p></div>
    <Action href="/review">Continue</Action>
  </Screen>;
}
