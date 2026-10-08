export interface Product {
  id: string;
  title: string;
  brand: string;
  price_minor: number;
  currency: string;
  variants: string[];
  category: string;
  image: string;
  image_position?: string;
  catalog_active?: boolean;
  source_url?: string;
  public_policy?: { merchant: string; ranges: number[][]; thresholds: number[] };
  description: string;
  features: string[];
  specs: Record<string, string>;
  delivery_days: number;
}
export interface NegotiationRound {
  id: number; sequence: number; speaker: "buyer" | "merchant";
  action: "offered" | "countered" | "accepted" | "declined" | "invalid" | "unavailable";
  valid: boolean; currency: string; timestamp: string;
  tiers: { minimum_buyers: number; total_each_cents: number }[];
  changes: { field: string; minimum_buyers: number; from_minor: number | null; to_minor: number }[];
  explanation: string;
  accepted_quote_reference: { id: string; version: number } | null;
}
export interface Negotiation {
  id: string; product_id: string; request_id: string; status: string;
  state: "negotiating" | "agreed" | "declined" | "interrupted";
  phase: "preparing" | "waiting_for_merchant" | "evaluating_offer" | "agreed" | "declined" | "interrupted";
  error_kind: string | null; error: string | null;
  accepted_quote_reference: { id: string; version: number } | null;
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
  pricing_model?: "tiers";
  tier_schedule?: { minimum_buyers: number; total_each_cents: number }[];
  delivery_by?: string;
  close_at?: string;
  version?: number;
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
  accepted_terms?: Terms;
  amount_minor?: number;
  authorized_minor?: number | null;
  captured_minor?: number | null;
  refunded_minor?: number | null;
  settlement_minor?: number | null;
}
export interface PaymentMember {
  position: number;
  is_you: boolean;
  authorization_status: string | null;
  capture_status: string | null;
  capture_operation_status: string | null;
  refund_status: string | null;
  void_status: string | null;
  evidence_source: string | null;
  updated_at: string | null;
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
  ordinary_price_minor?: number;
  confirmed_count: number;
  completed_captures: number;
  selected_count?: number;
  totals?: { authorized_minor: number; captured_minor: number; refunded_minor: number };
  commitment: Commitment | null;
  authorization_pending: boolean;
  members: PaymentMember[];
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
}
export async function api<T>(
  path: string,
  body?: unknown,
  operatorToken?: string,
): Promise<T> {
  const run = new URLSearchParams(location.search).get("run");
  const scoped = run && !path.startsWith("/operator") && path !== "/session" && path !== "/config" && path !== "/catalog";
  const response = await fetch(
    (import.meta.env.VITE_API_URL || "") + "/api" + path + (scoped ? (path.includes("?") ? "&" : "?") + new URLSearchParams({ run }) : ""),
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
    throw Object.assign(new Error(
      typeof data.detail === "string"
        ? data.detail
        : "The request could not be validated.",
    ), { status: response.status });
  return data;
}
export const money = (minor: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
