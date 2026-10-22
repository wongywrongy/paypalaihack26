import { fixture as f, money } from '../fixture';
import { Action, Photo, Screen } from '../components/MemberUI';
export default function Live() {
  return <Screen><h1>Working on a<br />better group price.</h1><p className="intro">{f.group.count} friends · {f.shop}<br />We’ll finish by {f.dates.ends}.</p><ol className="progress" aria-label="Deal progress"><li className="complete">Offer sent</li><li className="complete">Shop replied</li><li aria-current="step">Final offer</li></ol>
    <section className="rule-applied"><Photo product={f.products[1]} /><div><h2>Old bottle.<br />{money(f.bottleGap)} less.</h2><p>You said that’s fine, so we switched you.</p></div></section>
    <div className="plain-section"><h2>Also on the table</h2><p>Cheaper shared shipping and a free sample kit for everyone.</p></div><div className="still-under"><span>Your max, all in<span className="subline">Still under your max</span></span><strong className="money">{money(f.max)}</strong></div>
    <Action href="/deal">See the example bargaining</Action><a className="text-link centered" href="/done">See the example deal</a>
  </Screen>;
}
