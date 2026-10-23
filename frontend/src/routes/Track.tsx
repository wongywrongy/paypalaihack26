import { finalLines, landed, money, recordedMode, recordedOrder } from '../fixture';
import { Action, Screen, Unavailable } from '../components/MemberUI';
export default function Track() { const country = recordedOrder.country; if (!recordedMode()) return <Unavailable />; const total = landed(finalLines, country, 50); return <Screen title="Order RL-24817" back="/paid"><p className="fine order-context">{recordedOrder.destination} · {recordedOrder.currency} · order choices saved at checkout</p><h1>Packing in Seoul</h1><p className="intro">Arrives Oct 30 to Nov 2</p><ol className="timeline">{[
  [`Paid ${money(total.total, total.currency)}`, 'Oct 22 · PayPal released the rest of your hold'],
  ['Shops shipped to our Seoul hub', 'Oct 23 · Bada Market and Dalbit Official'],
  ['Packed into one box', 'Checked against your order'],
  ['Leaves Seoul', 'Oct 26 · tracking appears in PayPal'],
  ['Customs cleared, duty paid', 'About Oct 29'],
  ['Delivered', 'Oct 30 to Nov 2'],
].map(([title, note], index) => <li key={title} className={index < 2 ? 'complete' : index === 2 ? 'current' : ''} aria-current={index === 2 ? 'step' : undefined}><h2>{title}</h2><p>{note}</p></li>)}</ol><section className="shop-group"><h2>You’re covered</h2><p>Not shipped by Oct 29? Full refund to your PayPal.</p><p>Customs charged less than estimated? We refund the difference.</p></section><Action to="/shop">Keep exploring</Action></Screen>; }
