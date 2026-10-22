import { fixture as f } from '../fixture';
import { Action, Products, Screen } from '../components/MemberUI';
export default function Invite() {
  return <Screen><h1>{f.shop},<br />{f.city} to you.</h1><p className="intro">{f.organizer} started a group order. One box to {f.destination}. Join by {f.dates.lock}.</p>
    <p className="friends"><span className="friend-number">{f.group.count - 1}</span><span>friends are in.<br /><span className="muted">There’s room for you.</span></span></p>
    <Products /><p className="explanation">Pick your skincare. Set your max.<br />We work on a better price together.</p>
    <Action href="/tell" note="You pay your max or less. Charged only if a deal happens.">Join the order</Action>
  </Screen>;
}
