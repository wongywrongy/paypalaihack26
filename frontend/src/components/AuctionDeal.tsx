import { useEffect, useRef, useState } from 'react';
import { applyAuctionEvent, initialAuction, type AuctionEvent } from '../auction';
import { apiUrl, checkedEvent, orderHref, orderNumber, paymentComplete, request, type Order } from '../connected';
import { type CountryCode, currency, money, shops } from '../fixture';
import { Action, Screen } from './MemberUI';
import { AuctionBoard, AuctionBox } from './AuctionBoard';
import AnimatedTotal from './DealTotal';
export function ConnectedAuction({ order, refresh }: { order: Order; refresh: () => void }) {
  const [canceling, setCanceling] = useState(false);
  const [events, setEvents] = useState(order.events as unknown as AuctionEvent[]), [connection, setConnection] = useState('');
  useEffect(() => { setEvents(previous => [...previous, ...order.events.filter(event => !previous.some(row => row.id === event.id)) as unknown as AuctionEvent[]]); }, [order.events]);
  useEffect(() => {
    if (order.events.some(event => event.kind === 'done')) return;
    const stream = new EventSource(apiUrl(`/orders/${order.id}/deal/stream?after=${Math.max(0, ...order.events.map(event => event.seq))}`), { withCredentials: true });
    stream.onopen = () => setConnection('');
    stream.onerror = () => setConnection('Connection interrupted. Rally is reconnecting; your bidding continues.');
    stream.addEventListener('deal', ((message: MessageEvent) => {
      try {
        const event = checkedEvent(JSON.parse(message.data), order.maximum_minor) as unknown as AuctionEvent;
        setEvents(previous => previous.some(row => row.id === event.id) ? previous : [...previous, event].sort((a, b) => a.seq - b.seq));
        if (event.kind === 'done') { stream.close(); refresh(); }
      } catch (error) { setConnection((error as Error).message); stream.close(); }
    }) as EventListener);
    stream.addEventListener('status', () => { stream.close(); refresh(); });
    return () => stream.close();
  }, [order.id, order.events]);
  useEffect(() => { if (paymentComplete(order) || ['VOIDED', 'NEEDS_REVIEW'].includes(order.payment_state)) return; const timer = setInterval(refresh, 2000); return () => clearInterval(timer); }, [order.payment_state]);
  return <AuctionPlayback events={events} maximum={order.maximum_minor} country={order.country} id={order.id} paid={paymentComplete(order)} replayInitially={new URLSearchParams(location.search).get('replay') === '1'} connection={order.payment_state === 'NEEDS_REVIEW' ? 'Your payment result needs a check. Keep this order number.' : connection} canceling={canceling} onCancel={['AUTHORIZED', 'NEGOTIATING'].includes(order.payment_state) ? async () => { setCanceling(true); try { await request(`/orders/${order.id}/cancel`, { method: 'POST', body: {} }); refresh(); } catch (error) { setConnection((error as Error).message); } finally { setCanceling(false); } } : undefined} canceled={order.payment_state === 'VOIDED'} />;
}
export function AuctionPlayback({ events, maximum, country, id, paid, replayInitially = true, connection = '', canceled = false, onCancel, canceling = false }: { events: AuctionEvent[]; maximum: number; country: CountryCode; id: string; paid: boolean; replayInitially?: boolean; connection?: string; canceled?: boolean; onCancel?: () => void; canceling?: boolean }) {
  const [state, setState] = useState(() => replayInitially ? initialAuction(maximum) : events.reduce(applyAuctionEvent, initialAuction(maximum)));
  const [seconds, setSeconds] = useState(Math.floor(state.elapsed));
  const current = useRef(state);
  const queue = useRef<AuctionEvent[]>(replayInitially ? [...events] : []);
  const [playing, setPlaying] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    const missing = events.filter(event => !current.current.applied.includes(event.id) && !queue.current.some(row => row.id === event.id));
    queue.current = [...queue.current, ...missing].sort((a, b) => a.seq - b.seq);
  }, [events]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const event = queue.current.shift();
      if (!event) return;
      try { current.current = applyAuctionEvent(current.current, event); setState(current.current); }
      catch (error) { setError((error as Error).message); }
    }, 600);
    return () => clearInterval(timer);
  }, [playing]);
  useEffect(() => {
    if (!playing || state.done) return;
    const timer = setInterval(() => setSeconds(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [playing, state.done]);
  function replay() { setSeconds(0); current.current = initialAuction(maximum); setState(current.current); queue.current = [...events]; setPlaying(true); }
  const code = currency(country), last = state.feed.at(-1);
  return <Screen title={`Order ${orderNumber(id)}`} wide><div className={`auction-board${state.awarded ? ' awarded' : ''}${state.done ? ' finished' : ''}`}><aside className="auction-summary"><div className="auction-sticky"><div className="deal-progress"><h1>{canceled ? 'Order canceled' : state.done ? 'Bidding complete' : playing ? 'Shops are bidding' : 'Bidding paused'}</h1><span className="clock money">{state.done ? Math.ceil(state.elapsed) : seconds}s</span></div><div className="round-progress" aria-label={`Round ${state.round} of 3`}>{[1, 2, 3].map(round => <span key={round} className={round < state.round || state.done ? 'round-dot done' : round === state.round ? 'round-dot active' : 'round-dot'} aria-label={`Round ${round}${round <= state.round ? ' reached' : ''}`} />)}<span>{state.round || 1} of 3</span></div><p className="muted">Your total, all in</p><div className="total-display"><AnimatedTotal amount={state.total} currency={code} settled={state.done} /></div><p className={`saving-chip${state.total < maximum ? ' shown' : ''}`} key={state.total} aria-hidden={state.total >= maximum}>{money(Math.max(0, maximum - state.total), code)} less</p><p className="hold-line">{canceled ? 'Your order was canceled. Your bank determines when the hold is released.' : state.done && paid ? `You pay ${money(state.total, code)}. ${money(maximum - state.total, code)} of your hold was not captured.` : state.done ? 'Bidding is complete. Rally is confirming your payment with PayPal.' : `PayPal holds ${money(maximum, code)}. Shops can only bid it down.`}</p><div className="live-card"><b className="live-who" key={`who-${state.feed.length}`}>{last ? (last.who === 'rally' ? 'Rally' : shops[last.who].name) : 'Rally'}</b><p className="auction-live-message" title={last?.text} aria-live="polite"><span key={state.feed.length} className="live-line">{last?.text || 'Shops are preparing their bids.'}</span></p></div>{!state.done && <button className="text-link playback-toggle" onClick={() => setPlaying(!playing)}>{playing ? 'Pause bidding' : 'Resume bidding'}</button>}{(connection || error) && <p role="alert">{connection || error}</p>}</div><div className="auction-actions">{onCancel && <button className="text-link" disabled={canceling} onClick={onCancel}>{canceling ? 'Canceling order…' : 'Cancel order'}</button>}{state.done && paid && !canceled && <Action to={id === 'RL-24817' ? '/paid' : orderHref('/paid', id)}>See your order</Action>}{state.done && <button className="text-link" onClick={replay}>Watch the bidding again</button>}</div><details className="auction-feed"><summary>Bid history</summary><ol>{[...state.feed].reverse().map((line, i) => <li key={state.feed.length - i}><strong>{line.who === 'rally' ? 'Rally' : shops[line.who].name} · {line.t}s</strong><p>{line.text}</p></li>)}</ol></details></aside><div className="auction-content"><AuctionBoard state={state} currency={code} />{state.awarded && <AuctionBox state={state} currency={code} />}</div></div></Screen>;
}
