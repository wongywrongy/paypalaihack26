import ReactDOM from "react-dom/client";
import "@fontsource-variable/archivo";
import "./styles.css";
import App from "./App";
import RequestDeal, { PricingHelp, MyPurchases } from "./RequestDeal";
ReactDOM.createRoot(document.getElementById("root")!).render(!["/checkout", "/operator", "/merchant", "/purchases", "/how-group-pricing-works"].includes(location.pathname) && !location.search.includes("paypal_") ? <RequestDeal /> : location.pathname === "/purchases" ? <MyPurchases /> : location.pathname === "/how-group-pricing-works" ? <PricingHelp /> : <App />);
