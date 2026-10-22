import { fixture as f, money } from '../fixture';
import { Action, Products, Screen } from '../components/MemberUI';
export default function Review() {
  return <Screen back="/tell" title="Review"><h1>Your order.<br />Your limit.</h1><Products /><fieldset className="rules"><legend>To get you a better price</legend><label><input type="checkbox" checked disabled aria-describedby="example-rules" /><span>Take the old bottle if $4+ cheaper</span></label><label><input type="checkbox" checked disabled aria-describedby="example-rules" /><span>Use slower shipping<span className="muted subline">Arrives by {f.dates.arriveBy}</span></span></label></fieldset>
    <p id="example-rules" className="fine">These are the choices for this example order.</p><div className="limit"><label htmlFor="max">Your max, all in</label><input id="max" className="money" value={money(f.max)} readOnly /><p className="fine">Includes shipping, import duty and estimated tax.</p><p className="comparison">Ordering alone <span className="money">about {money(f.solo)}</span></p></div>
    <Action href="/live" note={<>In a real order, PayPal holds {money(f.max)}. You’re charged only if a deal happens, never above your max.</>}>Preview the {money(f.max)} hold</Action>
  </Screen>;
}
