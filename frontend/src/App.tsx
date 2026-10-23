import { BagProvider } from './state';
import Shop from './routes/Shop';
import Ask from './routes/Ask';
import Bag from './routes/Bag';
import Deal from './routes/Deal';
import Paid from './routes/Paid';
import Track from './routes/Track';
import Orders from './routes/shops/Orders';
import Products from './routes/shops/Products';
import Settings from './routes/shops/Settings';
import { Action, Screen } from './components/MemberUI';
const routes = { '/': Shop, '/shop': Shop, '/ask': Ask, '/bag': Bag, '/deal': Deal, '/paid': Paid, '/track': Track, '/shops/orders': Orders, '/shops/products': Products, '/shops/settings': Settings };
export default function App() {
  const path = location.pathname.replace(/\/$/, '') || '/';
  const Page = routes[path as keyof typeof routes];
  return <BagProvider>{path === '/ship-to' ? <Shop sheet /> : Page ? <Page /> : <Screen><h1>This page wandered off.</h1><p>Find your next favorite in the shop.</p><Action to="/shop">Back to the shop</Action></Screen>}</BagProvider>;
}
