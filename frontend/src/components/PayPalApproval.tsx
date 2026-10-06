import { useEffect, useRef } from "react";
import { api, type Commitment } from "../api";
interface PayPalWindow extends Window {
  paypal?: {
    Buttons: (options: Record<string, unknown>) => {
      render: (element: HTMLElement) => Promise<void>;
      close: () => void;
    };
  };
}
let sdk: Promise<void> | undefined;
function loadSDK(clientId: string) {
  if (!sdk)
    sdk = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://www.paypal.com/sdk/js?" +
        new URLSearchParams({
          "client-id": clientId,
          currency: "USD",
          intent: "authorize",
          components: "buttons",
          "disable-funding": "credit,paylater,card",
        });
      script.onload = () => resolve();
      script.onerror = () => {
        sdk = undefined;
        script.remove();
        reject(
          new Error(
            "PayPal SDK could not load. Check your connection and retry.",
          ),
        );
      };
      document.head.appendChild(script);
    });
  return sdk;
}
export default function PayPalApproval({
  clientId,
  commitment,
  onApproved,
  onError,
}: {
  clientId: string;
  commitment: Commitment;
  onApproved: () => void;
  onError: (e: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onApproved, onError });
  callbacks.current = { onApproved, onError };
  useEffect(() => {
    let canceled = false;
    let buttons:
      ReturnType<NonNullable<PayPalWindow["paypal"]>["Buttons"]> | undefined;
    loadSDK(clientId)
      .then(async () => {
        if (canceled || !ref.current) return;
        buttons = (window as PayPalWindow).paypal!.Buttons({
          style: {
            layout: "vertical",
            shape: "rect",
            label: "paypal",
            height: 44,
          },
          createOrder: () => commitment.order_id,
          onApprove: async (data: { orderID: string }) => {
            try {
              await api("/commitments/" + commitment.id + "/authorize", {
                order_id: data.orderID,
              });
              callbacks.current.onApproved();
            } catch (e) {
              callbacks.current.onError((e as Error).message);
            }
          },
          onCancel: () =>
            callbacks.current.onError(
              "PayPal approval canceled. You have not joined the group.",
            ),
          onError: () =>
            callbacks.current.onError(
              "PayPal checkout could not complete. Retry approval; your authorization will be verified on the server.",
            ),
        });
        await buttons.render(ref.current);
      })
      .catch((e) => callbacks.current.onError((e as Error).message));
    return () => {
      canceled = true;
      buttons?.close();
    };
  }, [clientId, commitment.id, commitment.order_id]);
  return <div ref={ref} className="paypal-buttons" />;
}
