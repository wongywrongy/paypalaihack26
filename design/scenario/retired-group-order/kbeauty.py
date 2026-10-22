"""Rally reference scenario (Korean skincare), the source of every number in design/mockup and PLAN.md.

Run:  python3 design/scenario/kbeauty.py
Retired group-order scenario (pre Oct 22 v2). Writes scenario.json next to this file (members, per-member breakdowns, baselines, pool totals, shop gain).
Shop, brand and products are fictional. Duty 12.5% is the 2026 total on Korean cosmetics (HTS 3304);
the customs fee and tax rate are illustrative. Money uses Decimal here; the app uses integer cents.
Shared freight is split by weight and the customs fee by goods value, with largest-remainder rounding.
"""
from decimal import Decimal as D, ROUND_HALF_UP, ROUND_FLOOR
import json, sys
q=lambda x: D(x).quantize(D('0.01'),ROUND_HALF_UP)
DUTY=D('0.125')   # Section 301 total on KR cosmetics since 2026-07-24 (KORUS doesn't remove it)
TAX=D('0.0925')   # illustrative CA use tax
FEE=D('10')       # illustrative customs processing fee per shipment
W={'ess':D('0.20'),'ton':D('0.25'),'msk':D('0.30')}
def ems(kg):
    for lim,p in [(0.5,24),(1,30),(2,42),(5,68),(10,105)]:
        if kg<=D(str(lim)): return D(p)
    return D(150)
LIST  ={'ess_new':D(25),'ess_old':D(25),'ton':D(24),'msk':D(18)}
POSTED={'ess_new':D(22),'ess_old':D(22),'ton':D(21),'msk':D(16)}
R1S   ={'ess_new':D(23),'ess_old':D(18),'ton':D(21),'msk':D(15)}
DEAL  ={'ess_new':D(22),'ess_old':D(17),'ton':D(20),'msk':D(14)}
M=[
 dict(n='You',  e=1,flex=4,   t=1,m=1,cap=D(75)),
 dict(n='Leo',  e=2,flex=0,   t=0,m=0,cap=D(50)),
 dict(n='Aisha',e=1,flex=None,t=1,m=0,cap=D(62)),
 dict(n='Noah', e=0,flex=None,t=1,m=1,cap=D(56)),
 dict(n='Sam',  e=1,flex=0,   t=0,m=2,cap=D(70)),
 dict(n='Priya',e=2,flex=4,   t=0,m=0,cap=D(50)),
 dict(n='Jun',  e=0,flex=None,t=2,m=0,cap=D(62)),
 dict(n='Elena',e=0,flex=None,t=1,m=1,cap=D(52)),
 dict(n='Omar', e=0,flex=None,t=0,m=3,cap=D(78)),
 dict(n='Kai',  e=1,flex=0,   t=1,m=0,cap=D(62)),
]
def esku(m,p):
    if not m['e']: return None
    gap=p['ess_new']-p['ess_old']
    return 'ess_old' if (m['flex'] is not None and gap>0 and gap>=m['flex']) else 'ess_new'
def goods(m,p):
    s=esku(m,p); g=D(0)
    if s: g+=p[s]*m['e']
    return g+p['ton']*m['t']+p['msk']*m['m']
def wt(m): return W['ess']*m['e']+W['ton']*m['t']+W['msk']*m['m']
def lr(total,ws):
    cents=int(total*100); S=sum(ws); raw=[D(cents)*w/S for w in ws]
    fl=[int(r.to_integral_value(ROUND_FLOOR)) for r in raw]; rem=cents-sum(fl)
    for i in sorted(range(len(raw)),key=lambda i:(raw[i]-fl[i],-i),reverse=True)[:rem]: fl[i]+=1
    return [D(c)/100 for c in fl]
def solo(m):
    g=goods(m,LIST); s=ems(wt(m)+D('0.15')); du=q(g*DUTY); tx=q(g*TAX)
    return dict(goods=g,ship=s,duty=du,fee=FEE,tax=tx,total=g+s+du+FEE+tx)
def group(ms,p,freight):
    gs=[goods(m,p) for m in ms]; sh=lr(freight,[wt(m) for m in ms]); fe=lr(FEE,gs); out=[]
    for m,g,s,f in zip(ms,gs,sh,fe):
        du=q(g*DUTY); tx=q(g*TAX)
        out.append(dict(n=m['n'],ess=esku(m,p),goods=g,ship=s,duty=du,fee=f,tax=tx,total=g+s+du+f+tx,cap=m['cap'],solo=solo(m)['total']))
    return out
poolkg=sum(wt(m) for m in M)+D('0.5')
print('pool kg',poolkg,'EMS',ems(poolkg))
deal=group(M,DEAL,D(25)); posted=group(M,POSTED,ems(poolkg))
for d,p in zip(deal,posted):
    print(f"{d['n']:6} cap {d['cap']:>6} solo {d['solo']:>7} posted {p['total']:>7}{' OVER' if p['total']>d['cap'] else '     '} deal {d['total']:>7}{' OVER' if d['total']>d['cap'] else '     '} {d['ess']} save {d['solo']-d['total']}")
T=lambda rows,k: sum(r[k] for r in rows)
print('deal total',T(deal,'total'),'goods',T(deal,'goods'),'ship',T(deal,'ship'),'fee',T(deal,'fee'),'duty',T(deal,'duty'),'tax',T(deal,'tax'))
print('posted total',T(posted,'total'),'solo total',T(deal,'solo'),'caps',sum(m['cap'] for m in M))
cur=M[:]
while True:
    fr=ems(sum(wt(m) for m in cur)+D('0.5')); pp=group(cur,POSTED,fr)
    print(' cascade',len(cur),'freight',fr,[(r['n'],str(r['total']),'OVER' if r['total']>r['cap'] else '') for r in pp])
    keep=[m for m,r in zip(cur,pp) if r['total']<=r['cap']]
    if len(keep)==len(cur) or not keep: cur=keep; break
    cur=keep
print('posted converts:',[m['n'] for m in cur])
RES={'ess_new':D(19),'ess_old':D(10),'ton':D(17),'msk':D(11)}
COGS={'ess_new':D(9),'ess_old':D(9),'ton':D(8),'msk':D(6)}
def seller(ms,p,fch,fcost,samples):
    gain=prof=D(0); u={}
    for m in ms:
        s=esku(m,p)
        for k,n in [(s,m['e']),('ton',m['t']),('msk',m['m'])]:
            if k and n: gain+=(p[k]-RES[k])*n; prof+=(p[k]-COGS[k])*n; u[k]=u.get(k,0)+n
    extra=(fch-fcost)-samples
    return dict(units=u,item_gain=gain,freight=fch-fcost,samples=-samples,gain=gain+extra,profit=prof+extra,rev=sum(goods(m,p) for m in ms))
print('seller deal',seller(M,DEAL,D(25),D(10),D('15')))
print('seller posted all',seller(M,POSTED,ems(poolkg),ems(poolkg),D(0)))
import os
out = dict(
    note="Illustrative. Fictional shop Haneul Beauty and product line Dalbit.",
    rates=dict(duty=str(DUTY), tax=str(TAX), customs_fee=str(FEE)),
    prices=dict(list={k: str(v) for k, v in LIST.items()}, listed_bulk={k: str(v) for k, v in POSTED.items()},
                round1_shop={k: str(v) for k, v in R1S.items()}, agreed={k: str(v) for k, v in DEAL.items()}),
    freight=dict(agreed_shared="25", listed_express=str(ems(poolkg)), pool_kg=str(poolkg)),
    members=[dict(name=m['n'], essence=m['e'], toner=m['t'], masks=m['m'],
                  bottle_rule=('either' if m['flex'] == 0 else 'new only' if m['flex'] is None and m['e'] else
                               (f"old if ${m['flex']}+ cheaper" if m['flex'] else None)),
                  max=str(m['cap'])) for m in M],
    deal=[{k: str(v) for k, v in r.items()} for r in deal],
    listed_if_all_bought=[{k: str(v) for k, v in r.items()} for r in posted],
    alone={m['n']: {k: str(v) for k, v in solo(m).items()} for m in M},
    totals=dict(deal=str(T(deal, 'total')), listed_if_all_bought=str(T(posted, 'total')), alone=str(T(deal, 'solo')),
                held=str(sum(m['cap'] for m in M))),
    listed_after_dropouts=[m['n'] for m in cur],
    shop=dict(deal={k: (str(v) if not isinstance(v, dict) else v) for k, v in seller(M, DEAL, D(25), D(10), D('15')).items()},
              listed_if_all_bought={k: (str(v) if not isinstance(v, dict) else v) for k, v in seller(M, POSTED, ems(poolkg), ems(poolkg), D(0)).items()}),
)
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scenario.json'), 'w'), indent=1)
