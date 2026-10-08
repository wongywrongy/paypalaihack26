import { useEffect, useState } from "react";
import productsData from "../../catalog.json";
import { api, type Config, type Product, type Status } from "./api";
import Checkout from "./components/Checkout";
import Operator from "./Operator";

const PRODUCTS: Product[] = productsData.map((p) => ({
  ...p,
  specs: Object.fromEntries(Object.entries(p.specs).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  )),
}));

export default function App() {
  const params = new URLSearchParams(location.search);
  const invite = new URLSearchParams(location.hash.slice(1)).get("invite") || params.get("invite");
  const [config, setConfig] = useState<Config | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [buyerStatus, setBuyerStatus] = useState<Status | null>(null);
  async function bootstrap() {
    setError("");
    try {
      const c = await api<Config>("/config");
      setConfig(c);
      if (["/operator", "/merchant"].includes(location.pathname)) return;
      const session = await api<{ run_id: string }>("/session", {
        run_id: params.get("run") || undefined,
        invite: invite || undefined,
      });
      const offerURL = new URL(location.href);
      if (params.has("paypal_return") || params.has("paypal_cancel")) offerURL.pathname = "/checkout";
      offerURL.searchParams.set("run", session.run_id);
      if (invite) { offerURL.searchParams.delete("invite"); offerURL.hash = ""; }
      history.replaceState(null, "", offerURL);
      if (params.get("paypal_return")) {
        const state = await api<Status>("/status");
        const order = params.get("token");
        if (state.commitment?.order_id && order === state.commitment.order_id) {
          await api("/commitments/" + state.commitment.id + "/authorize", {
            order_id: order,
          });
          setNotice(
          "PayPal approval received. Coalition is checking the authorization.",
          );
        } else setNotice("This PayPal return does not match your payment. No authorization was requested.");
      }
      if (params.get("paypal_cancel"))
        setNotice(
          "PayPal approval canceled. Your group status has not been advanced.",
        );
      for (const key of ["paypal_return", "paypal_cancel", "token", "PayerID"]) offerURL.searchParams.delete(key);
      history.replaceState(null, "", offerURL);
      setBuyerStatus(await api<Status>("/status"));
      setReady(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void bootstrap();
  }, []);
  useEffect(() => {
    if (!ready) return;
    let ignore = false;
    const refresh = async () => {
      try {
        const state = await api<Status>("/status");
        if (!ignore) { setBuyerStatus(state); setError(""); }
      } catch (e) { if (!ignore) setError((e as Error).message); }
    };
    const timer = setInterval(refresh, buyerStatus && ["SUCCEEDED", "FAILED"].includes(buyerStatus.group.status) ? 10000 : 2000);
    return () => { ignore = true; clearInterval(timer); };
  }, [ready, buyerStatus?.group.status]);
  if (["/operator", "/merchant"].includes(location.pathname)) return <Operator config={config} />;
  return <Checkout config={config} status={buyerStatus} onStatus={setBuyerStatus}
    initialError={error} notice={notice} onRetry={bootstrap} products={PRODUCTS} />;
}
