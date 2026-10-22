import { fixture as f, money } from '../fixture';
import { Action, Breakdown, Products, Screen } from '../components/MemberUI';
export default function Done() {
  return <Screen><h1>Deal reached.</h1><p className="pay-label">You pay</p><p className="hero-money money">{money(f.total)}</p><p className="under-max">{money(f.released)} under your max</p><div className="savings"><span>Saved vs ordering alone</span><strong className="money">{money(f.saved)}</strong></div><Products agreed /><Breakdown /><Action href="/receipt">See your receipt</Action><a className="text-link centered" href="/deal">How the deal was made</a></Screen>;
}
