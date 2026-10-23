import { useEffect, useRef, useState } from 'react';
import type { Currency } from '../fixture';

type PaymentSession = { start: (options: { presentationMode: 'auto' }, order: Promise<{ orderId: string }>) => Promise<void>; hasReturned: () => boolean; resume: () => Promise<void> };
type PayPalSDK = {
  createInstance: (options: { clientId: string; components: string[]; pageType: string }) => Promise<{
    findEligibleMethods: (options: { currencyCode: Currency }) => Promise<{ isEligible: (method: string) => boolean }>;
    createPayPalOneTimePaymentSession: (options: {
      onApprove: (data: { orderId: string }) => Promise<void>;
      onCancel: () => void;
      onError: () => void;
    }) => PaymentSession;
  }>;
};
let sdk: Promise<PayPalSDK> | undefined;
function loadSDK() {
  return sdk ||= new Promise<PayPalSDK>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://www.sandbox.paypal.com/web-sdk/v6/core';
    script.onload = () => {
      const paypal = (window as Window & { paypal?: PayPalSDK }).paypal;
      if (paypal) resolve(paypal);
      else { sdk = undefined; script.remove(); reject(new Error('PayPal could not initialize. Please retry.')); }
    };
    script.onerror = () => { sdk = undefined; script.remove(); reject(new Error('PayPal could not load. Check your connection and retry.')); };
    document.head.appendChild(script);
  });
}
export default function PayPalApproval({ clientId, currency, createOrder, approveOrder, onError, resumeOnly = false }: {
  clientId: string; currency: Currency;
  createOrder: () => Promise<{ orderId: string }>;
  approveOrder: (orderId: string) => Promise<void>;
  onError: (message: string) => void;
  resumeOnly?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'busy' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const callbacks = useRef({ createOrder, approveOrder, onError });
  callbacks.current = { createOrder, approveOrder, onError };
  useEffect(() => {
    let canceled = false;
    let busy = false;
    const host = ref.current!;
    setPhase('loading');
    loadSDK().then(async paypal => {
      const instance = await paypal.createInstance({ clientId, components: ['paypal-payments'], pageType: 'checkout' });
      if (canceled) return;
      const fail = (message: string) => { if (!canceled) { busy = false; setPhase('ready'); callbacks.current.onError(message); } };
      const session = instance.createPayPalOneTimePaymentSession({
        onApprove: async ({ orderId }) => {
          if (canceled) return;
          try { await callbacks.current.approveOrder(orderId); }
          catch (error) { fail((error as Error).message); }
        },
        onCancel: () => fail('PayPal approval canceled. You have not been charged.'),
        onError: () => fail('PayPal checkout could not complete. Retry approval; Rally checks your payment on the server.'),
      });
      if (session.hasReturned()) { setPhase('busy'); await session.resume(); return; }
      if (resumeOnly) { setPhase('ready'); return; }
      const methods = await instance.findEligibleMethods({ currencyCode: currency });
      if (canceled) return;
      if (!methods.isEligible('paypal')) throw new Error('PayPal is not available for this checkout. Try another browser or destination.');
      const button = document.createElement('paypal-button');
      button.setAttribute('aria-label', 'Pay with PayPal');
      button.addEventListener('click', async () => {
        if (busy || canceled) return;
        busy = true; setPhase('busy'); callbacks.current.onError('');
        button.setAttribute('disabled', '');
        try {
          // SDK v6 needs the invoked promise, resolving to an object with orderId.
          await session.start({ presentationMode: 'auto' }, callbacks.current.createOrder());
        } catch (error) { fail((error as Error).message); }
        finally { if (!canceled) { busy = false; button.removeAttribute('disabled'); setPhase('ready'); } }
      });
      host.replaceChildren(button); setPhase('ready');
    }).catch(error => { if (!canceled) { setPhase('failed'); callbacks.current.onError((error as Error).message); } });
    return () => { canceled = true; host.replaceChildren(); };
  }, [clientId, currency, attempt, resumeOnly]);
  return <div className="paypal-buttons" aria-busy={phase === 'loading' || phase === 'busy'}>
    <div ref={ref} />
    {phase === 'loading' && <p className="fine" role="status">Loading PayPal…</p>}
    {phase === 'busy' && <p className="fine" role="status">Complete your approval in PayPal.</p>}
    {phase === 'failed' && <button className="primary" onClick={() => { onError(''); setAttempt(value => value + 1); }}>Retry PayPal approval</button>}
  </div>;
}
