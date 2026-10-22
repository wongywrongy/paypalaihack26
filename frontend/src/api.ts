// Preserved approval adapter contract; M3 connects it to Rally's hold endpoints.
export interface Commitment { id: string; order_id: string | null }
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch((import.meta.env.VITE_API_URL || '') + '/api' + path, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({ detail: 'Could not reach Rally. Please try again.' }));
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Could not save your change. Please try again.');
  return data;
}
