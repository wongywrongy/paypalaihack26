import scenario from '../../design/scenario/retired-group-order/scenario.json' with { type: 'json' };

export type ProductId = 'ess_new' | 'ess_old' | 'ton' | 'msk';
export type Product = { id: ProductId; name: string; detail: string; photo: number; list: number; agreed: number };
export const cents = (amount: string): number => {
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) throw new Error('Invalid fixture amount');
  const [dollars, fraction = ''] = amount.split('.');
  return Number(dollars) * 100 + Number(fraction.padEnd(2, '0'));
};
export const money = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100);
const definitions: Array<Omit<Product, 'list' | 'agreed'>> = [
  { id: 'ess_new', name: 'Snail Essence', detail: '100 ml · new bottle', photo: 0 },
  { id: 'ess_old', name: 'Snail Essence', detail: '100 ml · old bottle', photo: 1 },
  { id: 'ton', name: 'Rice Toner', detail: '150 ml', photo: 2 },
  { id: 'msk', name: 'Cica Sheet Masks', detail: 'Box of 10', photo: 3 },
];
const products = definitions.map(product => ({ ...product, list: cents(scenario.prices.list[product.id]), agreed: cents(scenario.prices.agreed[product.id]) }));
const member = scenario.members[0];
const allocation = scenario.deal[0];
const costKeys = ['goods', 'ship', 'duty', 'fee', 'tax'] as const;
const costs = costKeys.map((key, i) => ({ label: ['Items', 'Shared shipping', 'Import duty (est.)', 'Customs fee (est.)', 'Tax (est.)'][i], cents: cents(allocation[key]) }));
const total = cents(allocation.total);
const max = cents(member.max);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
if (sum(costs.map(cost => cost.cents)) !== total
  || scenario.deal.some(row => cents(row.total) > cents(row.cap))
  || sum(scenario.deal.map(row => cents(row.total))) !== cents(scenario.totals.deal)
  || sum(scenario.members.map(row => cents(row.max))) !== cents(scenario.totals.held)) throw new Error('Scenario totals do not reconcile');

// M3 replaces this source; screens keep the same view model and integer cents.
export const fixture = {
  shop: 'Haneul Beauty', city: 'Seoul', community: 'Glass Skin Club', organizer: 'Kyle', destination: 'San Jose',
  products, catalog: products.filter(product => product.id !== 'ess_old'), basket: products.filter(product => product.id !== 'ess_new'), member, members: scenario.members,
  total, max, solo: cents(allocation.solo), saved: cents(allocation.solo) - total, released: max - total, costs,
  request: 'Snail essence, the rice toner and a box of cica masks. Under $75 all in.',
  bottleGap: cents(scenario.prices.agreed.ess_new) - cents(scenario.prices.agreed.ess_old),
  group: { held: cents(scenario.totals.held), total: cents(scenario.totals.deal), solo: cents(scenario.totals.alone), listed: cents(scenario.totals.listed_if_all_bought), count: scenario.members.length },
  question: { member: 'Aisha', minutes: 10, newPrice: cents(scenario.prices.round1_shop.ess_new), oldPrice: cents(scenario.prices.round1_shop.ess_old) },
  freight: { express: cents(scenario.freight.listed_express), agreed: cents(scenario.freight.agreed_shared) },
  dates: { lock: 'Thu, 6 PM', ends: '8 PM', ships: 'Nov 14', pickup: 'around Nov 21', refund: 'Nov 18', arriveBy: 'Nov 28' },
  terms: [
    { id: 'ess_new', qty: scenario.shop.deal.units.ess_new, offers: [1800, cents(scenario.prices.round1_shop.ess_new), 2100], agreed: cents(scenario.prices.agreed.ess_new) },
    { id: 'ess_old', qty: scenario.shop.deal.units.ess_old, offers: [1800, cents(scenario.prices.round1_shop.ess_old), 1600], agreed: cents(scenario.prices.agreed.ess_old) },
    { id: 'ton', qty: scenario.shop.deal.units.ton, offers: [1700, cents(scenario.prices.round1_shop.ton), 1900], agreed: cents(scenario.prices.agreed.ton) },
    { id: 'msk', qty: scenario.shop.deal.units.msk, offers: [1200, cents(scenario.prices.round1_shop.msk), 1300], agreed: cents(scenario.prices.agreed.msk) },
  ],
};


export type PublicOfferId = 'group-opening' | 'shop-counter' | 'group-revised' | 'shop-final';
export type PublicOffer = {
  id: PublicOfferId;
  sequence: number;
  actor: 'buyer' | 'shop';
  title: string;
  proposal: string;
  lines: Array<{ product: Product; unit: number; delta: number | null }>;
  freight: { kind: 'Express' | 'Shared freight'; groupCost: number; delta: number | null };
  freeKits: number;
};
// A public, illustrative reconstruction of the four saved term columns. No agent transcript,
// private shop economics, intermediate allocations or execution state is inferred here.
const offerDefinitions: Array<Pick<PublicOffer, 'id' | 'actor' | 'title' | 'proposal'>> = [
  { id: 'group-opening', actor: 'buyer', title: 'The group opens', proposal: `Can you meet these unit prices for our group order, with express shipping to ${fixture.destination}?` },
  { id: 'shop-counter', actor: 'shop', title: 'The shop counters with a bottle choice', proposal: `The old bottle is ${money(fixture.question.oldPrice)}; the new one is ${money(fixture.question.newPrice)}. Same formula, with express shipping unchanged.` },
  { id: 'group-revised', actor: 'buyer', title: 'The group trades speed for a better deal', proposal: `We can use the shared box shipping ${fixture.dates.ships}, for pickup ${fixture.dates.pickup}—within our ${fixture.dates.arriveBy} limit. Can you meet these item prices and include a free sample kit for each person?` },
  { id: 'shop-final', actor: 'shop', title: 'The shop makes its final counter', proposal: `I can keep shared freight at ${money(fixture.freight.agreed)} for the group and include ${fixture.group.count} free sample kits, at these final item prices.` },
];
export const publicOffers: PublicOffer[] = offerDefinitions.map((definition, index) => {
  const column = (term: typeof fixture.terms[number], at: number) => at === 3 ? term.agreed : term.offers[at];
  const groupCost = index < 2 ? fixture.freight.express : fixture.freight.agreed;
  const previousFreight = index <= 2 ? fixture.freight.express : fixture.freight.agreed;
  return {
    ...definition,
    sequence: index + 1,
    lines: fixture.terms.map(term => ({
      product: products.find(product => product.id === term.id)!,
      unit: column(term, index),
      delta: index === 0 ? null : column(term, index) - column(term, index - 1),
    })),
    freight: { kind: index < 2 ? 'Express' : 'Shared freight', groupCost, delta: index === 0 ? null : groupCost - previousFreight },
    freeKits: index < 2 ? 0 : fixture.group.count,
  };
});
