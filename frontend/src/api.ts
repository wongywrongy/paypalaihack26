export interface Product {
  id: string;
  title: string;
  brand: string;
  price_minor: number;
  currency: string;
  variants: string[];
  category: string;
  image: string;
  description: string;
  features: string[];
  specs: Record<string, string>;
  delivery_days: number;
}
export interface ProductContext {
  product_id: string;
  title: string;
  selected_variant: string;
  displayed_price_minor: number;
  currency: string;
  quantity: number;
}
export interface Terms {
  offer_id: string;
  product_id: string;
  title: string;
  variant: string;
  quantity: number;
  merchant: string;
  total_minor: number;
  currency: string;
  minimum: number;
  capacity: number;
  delivery_days: number;
  payment_terms: string;
  [key: string]: unknown;
}
export interface Commitment {
  id: string;
  order_id: string | null;
  approval_url: string | null;
  authorization_id: string | null;
  authorization_status: string | null;
  capture_id: string | null;
  capture_status: string | null;
  refund_id: string | null;
  refund_status: string | null;
  void_status: string | null;
  error: string | null;
  admitted: boolean;
  active: boolean;
  withdrawn: boolean;
  reservation_expires_at: string;
}
export interface Status {
  group: {
    id: string;
    run_id: string;
    mode: string;
    status: string;
    deadline: string | null;
    activated: boolean;
    demo: boolean;
    needs_attention: boolean;
    preparation_expires_at: string;
    failure_reason: string | null;
  };
  offer: Terms;
  confirmed_count: number;
  completed_captures: number;
  commitment: Commitment | null;
  decision: {
    status: string;
    result: {
      decision: string;
      explanation: string;
      unresolved_concerns: string[];
      guardrail_override?: boolean;
      model_result?: { decision: string };
      extracted_constraints?: Record<string, unknown>;
      evidence?: string[];
      question?: string;
    } | null;
    error: string | null;
    mode: string;
  } | null;
  evidence: {
    kind: string;
    status: string;
    evidence_source: string;
    evidence_event_id: string | null;
    updated_at: string;
    resource_id: string | null;
  }[];
  webhooks: {
    id: string;
    verified: boolean;
    event_type: string;
    received_at: string;
    processed_at: string | null;
  }[];
  activity: { id: string; text: string; at: string }[];
  buyer: { name: string; prepared: boolean };
}
export interface Config {
  mode: "fixture" | "connected";
  paypal_client_id: string | null;
  paypal_configured: boolean;
  llm_configured: boolean;
  default_run_id: string | null;
}
export async function api<T>(
  path: string,
  body?: unknown,
  operatorToken?: string,
): Promise<T> {
  const response = await fetch(
    (import.meta.env.VITE_API_URL || "") + "/api" + path,
    {
      method: body === undefined ? "GET" : "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Coalition-Request": "1",
        ...(operatorToken ? { "X-Operator-Token": operatorToken } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
  const data = await response.json().catch(() => ({
    detail: "Backend did not respond. Start the API and worker, then retry.",
  }));
  if (!response.ok)
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "The request could not be validated.",
    );
  return data;
}
export const money = (minor: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
