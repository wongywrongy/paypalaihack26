import { createContext, useContext, useEffect, useState, type ReactNode, type SetStateAction } from 'react';
import { allowed, catalog, countries, hero, recordedMode, type CountryCode, type Rules } from './fixture';
export type BagState = { country: CountryCode; items: string[]; rules: Rules };
const initial = (): BagState => {
  const fallback: BagState = { country: 'US', items: recordedMode() ? [...hero.cart] : [], rules: { ...hero.rules } };
  try {
    const saved = JSON.parse(localStorage.getItem('rally-shopping-v2') || 'null');
    if (!saved || !(saved.country in countries) || !Array.isArray(saved.items) || saved.items.length > 8 || new Set(saved.items).size !== saved.items.length || !saved.items.every((id: unknown) => typeof id === 'string' && catalog.some(item => item.id === id && allowed(item, saved.country))) || typeof saved.rules?.old_packaging_ok !== 'boolean' || typeof saved.rules?.add_small_extras_if_cheaper !== 'boolean') return fallback;
    return saved;
  } catch { return fallback; }
};
const Context = createContext<ReturnType<typeof useBagState> | null>(null);
function useBagState() {
  const [bag, updateBag] = useState<BagState>(initial);
  function setBag(next: SetStateAction<BagState>) {
    const value = typeof next === 'function' ? next(bag) : next;
    try { localStorage.setItem('rally-shopping-v2', JSON.stringify(value)); } catch { /* Storage is optional. */ }
    updateBag(value);
  }
  const [notice, setNotice] = useState('');
  useEffect(() => { try { localStorage.setItem('rally-shopping-v2', JSON.stringify(bag)); } catch { /* Browsing still works when storage is unavailable. */ } }, [bag]);
  return { bag, setBag, notice, setNotice };
}
export function BagProvider({ children }: { children: ReactNode }) { const value = useBagState(); return <Context.Provider value={value}>{children}</Context.Provider>; }
export function useBag() { const value = useContext(Context); if (!value) throw new Error('BagProvider required'); return value; }
