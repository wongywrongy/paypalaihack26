import { useEffect, useState } from "react";
import productsData from "../../catalog.json";
import { api, money, type Config, type Product, type Status } from "./api";
import Icon from "./components/Icon";
import CoalitionOverlay from "./components/CoalitionOverlay";
import Operator from "./Operator";

const PRODUCTS: Product[] = productsData.map((p) => ({
  ...p,
  specs: Object.fromEntries(
    Object.entries(p.specs).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  ),
}));
export default function App() {
  const params = new URLSearchParams(location.search);
  const [selected, setSelected] = useState(params.get("product") || "arc-991"),
    [variant, setVariant] = useState("Graphite"),
    [quantity, setQuantity] = useState(1),
    [gallery, setGallery] = useState(0);
  const [config, setConfig] = useState<Config | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [searchOpen, setSearchOpen] = useState(false);
  const [bag, setBag] = useState<
      { title: string; quantity: number; variant: string }[]
    >(() => {
      try {
        return JSON.parse(sessionStorage.getItem("demo-bag") || "[]");
      } catch {
        return [];
      }
    }),
    [bagOpen, setBagOpen] = useState(false),
    [saved, setSaved] = useState(false),
    [tab, setTab] = useState("Details"),
    [notice, setNotice] = useState("");
  const [buyerStatus, setBuyerStatus] = useState<Status | null>(null);
  const product = PRODUCTS.find((p) => p.id === selected) || PRODUCTS[0];
  useEffect(() => {
    setVariant(product.variants[0]);
    setQuantity(1);
    setGallery(0);
    setTab("Details");
    setSaved(false);
  }, [product.id]);
  async function bootstrap() {
    setError("");
    try {
      const c = await api<Config>("/config");
      setConfig(c);
      if (["/operator", "/merchant"].includes(location.pathname)) return;
      const session = await api<{ run_id: string }>("/session", {
        run_id: params.get("run") || undefined,
        invite: params.get("invite") || undefined,
      });
      const offerURL = new URL(location.href);
      offerURL.searchParams.set("run", session.run_id);
      if (params.get("invite")) offerURL.searchParams.delete("invite");
      history.replaceState(null, "", offerURL);
      setReady(true);
      if (params.get("paypal_return")) {
        const state = await api<Status>("/status");
        const order = params.get("token");
        if (state.commitment?.order_id && order === state.commitment.order_id)
          await api("/commitments/" + state.commitment.id + "/authorize", {
            order_id: order,
          });
        setNotice(
          "PayPal approval received. Open Coalition to check the confirmed authorization.",
        );
      }
      if (params.get("paypal_cancel"))
        setNotice(
          "PayPal approval canceled. Your group status has not been advanced.",
        );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void bootstrap();
  }, []);
  function browse(p: Product) {
    setSelected(p.id);
    setSearchOpen(false);
    setQuery("");
    setNotice("");
    const url = new URL(location.href);
    url.searchParams.set("product", p.id);
    history.replaceState(null, "", url);
    window.scrollTo({
      top: 0,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  function addToBag() {
    const next = [...bag, { title: product.title, quantity, variant }];
    setBag(next);
    sessionStorage.setItem("demo-bag", JSON.stringify(next));
    setNotice(
      "Added to your demo bag. Ordinary storefront checkout is simulated.",
    );
    setBagOpen(true);
  }
  if (["/operator", "/merchant"].includes(location.pathname))
    return <Operator config={config} />;
  const context = {
    product_id: product.id,
    title: product.title,
    selected_variant: variant,
    displayed_price_minor: product.price_minor,
    currency: product.currency,
    quantity,
  };
  const filtered = PRODUCTS.filter((p) =>
    (p.title + " " + p.category).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="demo-ribbon">
        <span>
          <span className="status-dot" />A little shop. A collective advantage.
        </span>
        <span>
          DEMO STOREFRONT <i />{" "}
          {config?.mode === "fixture"
            ? "Fixture mode · simulated payments"
            : config?.mode === "connected"
              ? "PayPal sandbox"
              : "Catalog preview"}
        </span>
      </div>
      <header className="store-header">
        <a href="/" className="store-logo" aria-label="Commonplace home">
          <Icon name="logo" size={30} />
          commonplace
        </a>
        <div className="search-box">
          <Icon name="search" size={18} />
          <input
            placeholder="Find your everyday essential"
            aria-label="Search products"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchOpen(false);
              if (e.key === "Enter" && filtered[0]) browse(filtered[0]);
            }}
          />
          {searchOpen && (
            <div className="search-results">
              {filtered.length ? (
                filtered.map((p) => (
                  <button key={p.id} onClick={() => browse(p)}>
                    <img src={p.image} alt="" />
                    <span>
                      {p.title}
                      <small>{p.category}</small>
                    </span>
                    <strong>{money(p.price_minor)}</strong>
                  </button>
                ))
              ) : (
                <p>No demo products match your search.</p>
              )}
              <button
                className="search-dismiss"
                onClick={() => setSearchOpen(false)}
              >
                Close search
              </button>
            </div>
          )}
        </div>
        <div className="header-actions">
          <a href="/merchant" className="operator-link">
            Merchant view
          </a>
          <button
            className="bag-button"
            onClick={() => setBagOpen(!bagOpen)}
            aria-label={"Demo bag, " + bag.length + " items"}
          >
            <Icon name="bag" />
            <span>Bag</span>
            <b>{bag.length}</b>
          </button>
        </div>
      </header>
      <nav className="store-nav" aria-label="Shop departments">
        <button className="selected" onClick={() => browse(PRODUCTS[0])}>
          All essentials
        </button>
        {PRODUCTS.map((p) => (
          <button key={p.id} onClick={() => browse(p)}>
            {p.category}
          </button>
        ))}
        <span>Considered goods. Everyday prices.</span>
      </nav>
      {bagOpen && (
        <section className="bag-panel" aria-label="Demo shopping bag">
          <div>
            <h3>Your demo bag</h3>
            <button
              className="icon-button"
              aria-label="Close bag"
              onClick={() => setBagOpen(false)}
            >
              <Icon name="close" />
            </button>
          </div>
          {bag.length ? (
            <ul>
              {bag.map((i, k) => (
                <li key={k}>
                  <strong>{i.title}</strong>
                  <span>
                    {i.variant} · Qty {i.quantity}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>Your bag is empty.</p>
          )}
          <p>Simulated ordinary shopping. No payment or fulfillment.</p>
          {!!bag.length && (
            <button
              className="secondary-button"
              onClick={() => {
                setBag([]);
                sessionStorage.removeItem("demo-bag");
              }}
            >
              Clear demo bag
            </button>
          )}
        </section>
      )}
      <main>
        <div className="breadcrumb">
          <button onClick={() => browse(PRODUCTS[0])}>Home</button>
          <Icon name="chevron" size={12} />
          <span>{product.category}</span>
          <Icon name="chevron" size={12} />
          <span>{product.title.split(" · ")[0]}</span>
        </div>
        {(error || notice) && (
          <div
            className={error ? "connection-notice" : "notice"}
            role={error ? "alert" : "status"}
          >
            {error || notice}
            {error && (
              <button onClick={bootstrap}>
                Retry connection
                <Icon name="arrow" size={15} />
              </button>
            )}
          </div>
        )}
        {buyerStatus?.buyer.prepared && (
          <div className="notice">
            Preparing sandbox buyer: {buyerStatus.buyer.name}. Approve this
            buyer before the operator starts the timer.
          </div>
        )}
        <div className="product-layout">
          <section className="product-gallery" aria-label="Product images">
            <div
              className={
                "gallery-main gallery-" +
                product.id +
                (gallery === 1 ? " zoomed" : gallery === 2 ? " flipped" : "")
              }
            >
              <span className="gallery-label">Made for your everyday</span>
              <img
                src={product.image}
                alt={
                  product.title +
                  ", " +
                  variant +
                  (gallery === 1 ? ", detail view" : "")
                }
                style={
                  variant === product.variants[1]
                    ? {
                        filter:
                          product.id === "arc-991"
                            ? "brightness(1.6)"
                            : product.id === "form-lamp"
                              ? "saturate(.1) brightness(1.35)"
                              : "hue-rotate(100deg) saturate(.55) brightness(.8)",
                      }
                    : undefined
                }
              />
              <span className="gallery-index">{gallery + 1} / 3</span>
              <button
                className={"save-button " + (saved ? "saved" : "")}
                onClick={() => setSaved(!saved)}
                aria-label={
                  saved ? "Remove from favorites" : "Save to favorites"
                }
                aria-pressed={saved}
              >
                <Icon name="heart" />
              </button>
            </div>
            <div className="thumbnails">
              {["Product view", "Detail view", "Alternate view"].map(
                (name, i) => (
                  <button
                    aria-label={name}
                    aria-pressed={gallery === i}
                    key={name}
                    className={gallery === i ? "active" : ""}
                    onClick={() => setGallery(i)}
                  >
                    <img src={product.image} alt="" className={"thumb-" + i} />
                  </button>
                ),
              )}
              <span>Good things, in the details.</span>
            </div>
          </section>
          <section className="product-info">
            <p className="brand-name">{product.brand}</p>
            <h1>{product.title}</h1>
            <p className="product-description">{product.description}</p>
            <div className="product-price">
              {money(product.price_minor)}
              <span>USD · ordinary demo price</span>
            </div>
            <div className="variants">
              <div>
                <strong>Color</strong>
                <span>{variant}</span>
              </div>
              <div className="variant-options">
                {product.variants.map((v, i) => (
                  <button
                    key={v}
                    className={v === variant ? "active" : ""}
                    aria-pressed={v === variant}
                    onClick={() => setVariant(v)}
                  >
                    <i
                      style={{
                        background:
                          product.id === "arc-991"
                            ? i === 0
                              ? "#454a48"
                              : "#e1e0d8"
                            : product.id === "form-lamp"
                              ? i === 0
                                ? "#7e9387"
                                : "#e2dfd4"
                              : i === 0
                                ? "#be745b"
                                : "#466153",
                      }}
                    />
                    {v}
                    {v === variant && <Icon name="check" size={13} />}
                  </button>
                ))}
              </div>
            </div>
            <ul className="product-features">
              {product.features.map((f) => (
                <li key={f}>
                  <Icon name="check" size={15} />
                  {f}
                </li>
              ))}
            </ul>
            <div className="quiet-delivery">
              <Icon name="truck" size={24} />
              <div>
                <strong>A good day, delivered.</strong>
                <p>
                  Free simulated delivery within {product.delivery_days} days.
                </p>
              </div>
            </div>
          </section>
          <div className="purchase-column">
            <section className="purchase-box" aria-label="Purchase controls">
              <div className="in-stock">
                <span className="status-dot" />
                In stock · demo inventory
              </div>
              <div className="purchase-price">
                {money(product.price_minor)}
                <span>USD</span>
              </div>
              <p>Free delivery within {product.delivery_days} days</p>
              <small>Simulated shipping · $0 tax</small>
              <label className="quantity-control">
                <span>Quantity</span>
                <select
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <button className="add-to-bag" onClick={addToBag}>
                Add to demo bag
                <Icon name="bag" size={17} />
              </button>
              <div className="seller-line">
                <span>Sold by</span>
                <strong>Commonplace Supply</strong>
                <span>Fulfillment</span>
                <strong>Simulated</strong>
              </div>
            </section>
            <CoalitionOverlay
              context={context}
              config={config}
              ready={ready}
              initialError={error}
              onStatus={setBuyerStatus}
            />
            <div className="purchase-footnote">
              <Icon name="shield" size={16} />
              <span>Clear terms. Your approval. Always.</span>
            </div>
          </div>
        </div>
        <section className="details-section">
          <div
            className="details-tabs"
            role="tablist"
            aria-label="Product information"
          >
            {["Details", "Specifications", "Delivery & returns"].map((t) => (
              <button
                role="tab"
                id={"tab-" + t}
                aria-selected={tab === t}
                aria-controls="detail-content"
                tabIndex={tab === t ? 0 : -1}
                key={t}
                onClick={() => setTab(t)}
                onKeyDown={(e) => {
                  const tabs = [
                    "Details",
                    "Specifications",
                    "Delivery & returns",
                  ];
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    const next =
                      tabs[
                        (tabs.indexOf(t) + (e.key === "ArrowRight" ? 1 : 2)) % 3
                      ];
                    setTab(next);
                    document.getElementById("tab-" + next)?.focus();
                  }
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div
            id="detail-content"
            role="tabpanel"
            aria-labelledby={"tab-" + tab}
            className="details-content"
          >
            {tab === "Details" ? (
              <>
                <h2>
                  {product.id === "arc-991"
                    ? "Ready for the next chapter."
                    : product.id === "form-lamp"
                      ? "Room for a bright idea."
                      : "Take the day with you."}
                </h2>
                <p>
                  {product.description} This original product and all storefront
                  specifications are fictional demo data. Coalition’s calculator
                  offer is for the exact Arc 991 in Graphite.
                </p>
              </>
            ) : tab === "Specifications" ? (
              <dl className="spec-list">
                {Object.entries(product.specs).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <>
                <h2>Delivery with no guesswork.</h2>
                <p>
                  Simulated delivery within {product.delivery_days} days.
                  Shipping included and tax set to $0. Physical fulfillment and
                  ordinary storefront returns are simulated. Coalition payment
                  recovery is shown separately in your group panel.
                </p>
              </>
            )}
          </div>
        </section>
        <section className="browse-section">
          <div>
            <h2>A few more good finds.</h2>
            <p>Small upgrades for a full day.</p>
          </div>
          <div className="related-products">
            {PRODUCTS.filter((p) => p.id !== product.id).map((p) => (
              <button key={p.id} onClick={() => browse(p)}>
                <div>
                  <img src={p.image} alt="" />
                  <span>
                    <Icon name="arrow" />
                  </span>
                </div>
                <small>{p.brand}</small>
                <h3>{p.title}</h3>
                <strong>{money(p.price_minor)}</strong>
              </button>
            ))}
          </div>
        </section>
      </main>
      <footer className="store-footer">
        <a className="store-logo" href="/">
          <Icon name="logo" size={25} />
          commonplace
        </a>
        <p>A demo of shopping, together.</p>
        <span>
          Original demo storefront. No Amazon affiliation.
          <br />
          Storefront, merchant & physical fulfillment are simulated.
        </span>
      </footer>
    </>
  );
}
