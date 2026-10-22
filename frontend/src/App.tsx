import Invite from './routes/Invite';
import Tell from './routes/Tell';
import Review from './routes/Review';
import Live from './routes/Live';
import Ask from './routes/Ask';
import Done from './routes/Done';
import Receipt from './routes/Receipt';
import DealRoom from './routes/DealRoom';
import { Action, Screen } from './components/MemberUI';
const routes = { '/': Invite, '/invite': Invite, '/tell': Tell, '/review': Review, '/live': Live, '/ask': Ask, '/done': Done, '/receipt': Receipt, '/deal': DealRoom };
export default function App() {
  const route = location.pathname.replace(/\/$/, '') || '/';
  const Page = routes[route as keyof typeof routes];
  return Page ? <Page /> : <Screen><h1>This page wandered off.</h1><p>Return to the group order to pick up where you started.</p><Action href="/invite">Open the group order</Action></Screen>;
}
