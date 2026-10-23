Method: dual-agent (A: `/root/gd_visual_a` · B: `/root/gd_evidence_b`).

# Rally fixture review — 2026-10-22

The final fixture review scores **34/40**. Rally feels specific to its purpose: product photos carry through the basket and bottle swap, the maximum stays prominent, and detailed bargaining sits behind an optional link.

| Heuristic | Score | Evidence |
|---|---:|---|
| System status | 3/4 | Example labels and clear progress |
| Real-world language | 4/4 | Concrete products, prices and pickup terms |
| User control | 3/4 | Back paths and reversible preview choice |
| Consistency | 4/4 | Shared controls and visual language |
| Error prevention | 3/4 | Safe default and explicit preview boundary |
| Recognition | 4/4 | Mobile product labels remain beside prices |
| Efficiency | 3/4 | Short path; optional details |
| Minimalism | 4/4 | One primary action and clear hierarchy |
| Recovery | 3/4 | Route recovery and change-choice action |
| Contextual help | 3/4 | Hold, release and refund explanations |
| **Total** | **34/40** | **Good** |

The sole visual finding is fixed: mobile offer comparisons retain product labels while scrolling. Both reviewers inspected the actual captures; the final source detector returned zero findings. CI also verified Tab/Enter through the main preview journey and ArrowRight access to the table. No open P0–P2 finding remains within GD scope.

The strongest parts are the pictured bottle tradeoff, the clear maximum-to-final-price progression, and the repeated disclosure that this is an example with no money movement. First-time and distracted buyers retain context; the focused table has a visible outline. All eight cognitive-load checks pass; no decision has more than four visible choices.

Persona checks: Jordan can recognize the basket and distinguish the preview hold from a real approval; Casey can inspect mobile prices without losing the product; Sam has an executed primary keyboard path and visible table focus. Those checks do not establish screen-reader behavior or every secondary keyboard interaction.

Minor observation: small secondary metadata remains a candidate for low-vision testing; its nominal token contrast passes, and small size alone is not an established accessibility failure.

Evidence: source commit `9016d26cb031f2aff50900937e0c11d31f27a6e9`, CI run `39843746928`. Ten actual PNG hashes verified. The recognition score rises from the initial rendered review's 3/4 to 4/4 after the table fix; other scores remain unchanged. The earlier 28/40 source/mockup review used a different target and evidence, so it is not a like-for-like trend. Fixture behavior only; connected model/payment success is outside this review.

Questions skipped: 0 unresolved priority issues.
