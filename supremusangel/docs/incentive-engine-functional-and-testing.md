# Incentive Engine — Functional & UI Testing Guide

**App:** supremusangel · **Module:** Supremus Angel · **Site (docs default):** scope_connect.com

This guide documents the **three incentive schemes** end-to-end and gives a **step-by-step UI test** with a single dataset whose numbers reconcile, so you can confirm every figure on screen.

| Scheme | Who | DocType | Extra layer |
|--------|-----|---------|-------------|
| Sales Person | Individual seller | `SA Incentive Calculation` | — |
| Team Lead (TL) | Leads one team | `SA TL Incentive Calculation` | Team commission (flat 1%) |
| Branch Manager (BM) | Leads a branch (several teams) | `SA BM Incentive Calculation` | Branch commission (tiered 0.5% / 1%) |

All three share: monthly window, **base target = 10 × salary**, **minimum = 7 × salary**, and confirmed `SA Sales Record`s as the sales source.

---

## 1. Concepts

### 1.1 The Sales Person tree (hierarchy)
Teams and branches are **not** new tables — they are the **ERPNext Sales Person tree** (`Selling > Sales Person`, a nested-set tree).

- A **TL** is a Sales Person node; its **team** = all non-group (leaf) Sales Persons in its subtree.
- A **BM** is a Sales Person node higher up; its **branch** = all non-group (leaf) Sales Persons in its subtree (i.e. the sellers across all its teams).
- Group nodes (`is_group = 1`) are treated as organisational; only **leaf sellers** are counted as members.

### 1.2 Where salary comes from
Salary is entered **manually** on each calculation document. Managers read each member's salary/target from that member's **own `SA Incentive Calculation`** for the month, and read member **sales** directly from `SA Sales Record`. → **Always calculate the sellers first, then the TLs, then the BM.**

---

## 2. Functional Logic

### 2.1 Sales Person (`SA Incentive Calculation`)

```
base_target        = salary × 10
minimum_target     = salary × 7
total_sales        = Σ Confirmed SA Sales Record in month (for this person)
achievement %      = total_sales / base_target × 100
incentive_amount   = salary × slab.incentive_percent / 100
reward_amount      = (total_sales − base_target) × slab.reward_percent / 100   [if > 100%]
total_payout       = incentive_amount + reward_amount
```

Slabs (`SA Incentive Slab`) — single rate by achievement bracket:

| Achievement | Incentive (% of salary) | Reward (% on sales above 10x) |
|---|---|---|
| Below 70% | 0 | 0 |
| 70–80% | 10% | 0 |
| 80–90% | 20% | 0 |
| 90–100% | 30% | 0 |
| 100–140% | 30% | 10% |
| 140–200% | 30% | 11% |
| 200–300% | 30% | 12.5% |
| 300–400% | 30% | 14% |
| 400%+ | 30% | 15% |

### 2.2 Team Lead (`SA TL Incentive Calculation`)

**Personal half** (configs `SA TL Bonus Slab`, `SA TL Incentive Slab`):

```
personal_target    = salary × 10
bonus_amount       = personal_target × bonus_slab.bonus_percent / 100     (flat, % of target)
personal_incentive = MARGINAL across bands on sales above target
personal_payout    = bonus_amount + personal_incentive
```

Bonus slab (flat % of personal target):

| Personal achievement | Bonus |
|---|---|
| Below 70% | 0 |
| 70–80% | 1% of target |
| 80–100% | 2% of target |
| 100%+ | 3% of target |

Personal incentive (**marginal** — each band's rate applies only to the portion of sales inside it):

| Band (% of target) | Rate |
|---|---|
| 100–140% | 10% |
| 140–200% | 11% |
| 200–300% | 12.5% |
| 300–400% | 14% |
| 400%+ | 15% |

**Team half:**

```
full_team_target = Σ (member salary × 10)        [leaf members in subtree]
team_target      = 70% × full_team_target         [the "teams target"]
team_sales       = Σ member confirmed sales
team_achievement = team_sales / full_team_target × 100
team_commission  = 1% × team_sales                [only if team_achievement ≥ 70%]
total_payout     = personal_payout + team_commission
```

### 2.3 Branch Manager (`SA BM Incentive Calculation`)

**Identical to TL** for the personal half (reuses the same `SA TL Bonus Slab` / `SA TL Incentive Slab`). The **only** difference is a **tiered branch commission**:

```
full_branch_target = Σ (member salary × 10)        [leaf members in BM subtree]
branch_target      = 70% × full_branch_target
branch_revenue     = Σ member confirmed sales
branch_achievement = branch_revenue / full_branch_target × 100
```

| Branch achievement | Commission |
|---|---|
| Below 70% | 0 |
| 70–100% (on target) | **0.5%** of branch revenue |
| Above 100% (overachieved) | **1%** of branch revenue |

```
total_payout = personal_payout + branch_commission
```

---

## 3. One-Time Setup

> The app must be installed on the site. (Local note: a fresh install on this bench currently fails on an unrelated pre-existing `Job Opening`/`Job Category` customization error — resolve that or test on a site where supremusangel is already installed.)

```bash
bench set-config -g developer_mode 1
bench --site scope_connect.com migrate
bench --site scope_connect.com execute supremusangel.supremus_angel.setup.create_incentive_data
bench --site scope_connect.com clear-cache
bench --site scope_connect.com build        # if slab/calc JS isn't showing
```

`create_incentive_data` seeds: 4 Merchandise, 9 `SA Incentive Slab`, 4 `SA TL Bonus Slab`, 5 `SA TL Incentive Slab` (idempotent — safe to re-run). BM needs no extra seed.

**Verify masters in UI:** open list views for **SA Incentive Slab**, **SA TL Bonus Slab**, **SA TL Incentive Slab** and confirm the rows match the tables in §2.

---

## 4. Build the Test Dataset (UI)

We build one branch with two teams. **Unit value:** Pre-IPO Shares = ₹25,000/unit (seeded).

### 4.1 Sales Person tree
Go to **Sales Person** (tree view) and create this structure (set **Is Group** as noted). For the tree, the manager nodes are groups; sellers are leaves.

```
All Sales Persons (group, root – may already exist)
└─ Ravi (BM)            (group)
   ├─ Anil (TL)         (group)
   │  ├─ Sunil          (leaf)
   │  └─ Sneha          (leaf)
   └─ Priya (TL)        (group)
      ├─ Raj            (leaf)
      └─ Maya           (leaf)
```

Tip: in tree view, click a node → **Add Child**. Tick **Is Group** for Ravi, Anil, Priya; leave it unticked for the four sellers.

### 4.2 Salaries used (entered on calc docs, not stored on the tree)

| Person | Role | Salary | Personal target (10x) |
|---|---|---|---|
| Sunil | Seller | 25,000 | 2,50,000 |
| Sneha | Seller | 25,000 | 2,50,000 |
| Raj | Seller | 25,000 | 2,50,000 |
| Maya | Seller | 25,000 | 2,50,000 |
| Anil | TL | 50,000 | 5,00,000 |
| Priya | TL | 50,000 | 5,00,000 |
| Ravi | BM | 70,000 | 7,00,000 |

### 4.3 Sales for the month (use month `2026-06`)
Create **SA Sales Record** documents (New → SA Sales Record). For each: set **Sales Person**, **Posting Date** within June 2026, **Status = Confirmed**, **Merchandise = Pre-IPO Shares**, and **Units Sold** as below (Total Sales Value auto-fills at ₹25,000/unit).

| Person | Units Sold | Total Sales Value |
|---|---|---|
| Sunil | 8 | 2,00,000 |
| Sneha | 12 | 3,00,000 |
| Raj | 10 | 2,50,000 |
| Maya | 6 | 1,50,000 |
| Anil (TL personal) | 24 | 6,00,000 |
| Priya (TL personal) | 17 | 4,25,000 |
| Ravi (BM personal) | 28 | 7,00,000 |

> Alternative: submit a **Sales Invoice** with these people in the **Sales Team** table — the `on_submit` hook auto-creates Confirmed `SA Sales Record`s. Manual records are simpler for a first test.

---

## 5. UI Test Walkthrough & Expected Results

**Order matters: sellers → TLs → BM.**

### Step 1 — Sellers (`SA Incentive Calculation`)
For each of Sunil, Sneha, Raj, Maya: **New SA Incentive Calculation** → Sales Person, `calculation_month = 2026-06`, Salary = 25,000 → **Save** → click **Calculate**.

| Seller | Sales | Achiev. | Slab | Incentive | Reward | **Total Payout** |
|---|---|---|---|---|---|---|
| Sunil | 2,00,000 | 80% | 80–90% | 20%×25k = 5,000 | 0 | **5,000** |
| Sneha | 3,00,000 | 120% | 100–140% | 30%×25k = 7,500 | 10%×50k = 5,000 | **12,500** |
| Raj | 2,50,000 | 100% | 100–140% | 7,500 | 0 | **7,500** |
| Maya | 1,50,000 | 60% | — (below 70%) | 0 | 0 | **0** |

*(These four must be Calculated first so the managers can read their salary/target.)*

### Step 2 — Team Lead Anil (`SA TL Incentive Calculation`)
New → Team Lead = **Anil**, month `2026-06`, Salary = 50,000 → Save → **Calculate**.

**Personal** (sales 6,00,000 vs target 5,00,000 = 120%):
- Bonus: 100%+ → 3% × 5,00,000 = **15,000**
- Marginal incentive: 1,00,000 in 100–140% band × 10% = **10,000**
- **Personal payout = 25,000**

**Team** (members Sunil + Sneha — *Anil's leaf subtree*):
- Team sales = 2,00,000 + 3,00,000 = **5,00,000**
- Full team target = 2,50,000 + 2,50,000 = **5,00,000** → teams target (70%) = 3,50,000
- Team achievement = 100% ≥ 70% → commission = 1% × 5,00,000 = **5,000**

**→ Total Payout = 25,000 + 5,000 = ₹30,000.** Check the **Team Breakdown** tab shows Sunil & Sneha with `Has Calc = ✓`.

### Step 3 — Team Lead Priya
New → Team Lead = **Priya**, month `2026-06`, Salary = 50,000 → Calculate.

- Personal (sales 4,25,000 = 85%): bonus 2% × 5,00,000 = **10,000**; incentive 0 → personal payout **10,000**
- Team (Raj + Maya): sales 2,50,000 + 1,50,000 = **4,00,000**; full target 5,00,000 → achievement **80%** ≥ 70% → 1% × 4,00,000 = **4,000**
- **→ Total Payout = ₹14,000.**

### Step 4 — Branch Manager Ravi (`SA BM Incentive Calculation`)
New → Branch Manager = **Ravi**, month `2026-06`, Salary = 70,000 → Calculate.

**Personal** (sales 7,00,000 vs target 7,00,000 = 100%):
- Bonus 100%+ → 3% × 7,00,000 = **21,000**; incentive 0 → **Personal payout = 21,000**

**Branch** (leaf members = Sunil, Sneha, Raj, Maya — *TLs Anil/Priya are group nodes, excluded*):
- Branch revenue = 2,00,000 + 3,00,000 + 2,50,000 + 1,50,000 = **9,00,000**
- Full branch target = 4 × 2,50,000 = **10,00,000** → branch target (70%) = 7,00,000
- Branch achievement = 9,00,000 / 10,00,000 = **90%** → on-target tier → **0.5%** × 9,00,000 = **4,500**

**→ Total Payout = 21,000 + 4,500 = ₹25,500.** Branch Breakdown tab lists the 4 sellers.

### Step 5 — Verify the BM commission tiers
Re-test the tiering by bumping branch sales (add units to a seller's `SA Sales Record`, re-Calculate the seller's `SA Incentive Calculation`, then re-Calculate Ravi):

| Branch revenue | Achievement | Tier | Commission |
|---|---|---|---|
| 6,50,000 | 65% | below 70% | **0** |
| 9,00,000 | 90% | 70–100% | 0.5% → **4,500** |
| 11,00,000 | 110% | overachieved | 1% → **11,000** |

---

## 6. Verification Checklist

- [ ] Below 70% personal achievement → **no** personal bonus/incentive (all schemes).
- [ ] TL/BM personal bonus is **% of target** (not salary): 3% × 5,00,000 = 15,000 for a TL at 100%.
- [ ] TL/BM personal incentive is **marginal** (e.g. 6,00,000 sales on 5,00,000 target → 10,000, not 60,000).
- [ ] TL team commission is **flat 1%** once team ≥ 70%.
- [ ] BM branch commission is **0.5%** at 70–100% and **1%** above 100%; **0** below 70%.
- [ ] Manager **member list = leaf sellers** in the subtree (group nodes excluded).
- [ ] If a member has no `SA Incentive Calculation` for the month, an **orange message** appears and that member's target is excluded (sales still counted).
- [ ] Re-running **Calculate** is idempotent (same inputs → same outputs).

---

## 7. Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| **Calculate** button missing | Doc must be saved and in Draft (`docstatus 0`). Run `bench build` + `clear-cache` if JS stale. |
| Team/branch target lower than expected | Members missing an `SA Incentive Calculation` for the month — calculate sellers first (orange message lists them). |
| A seller not counted in team/branch | They are a **group** node, or their `posting_date` is outside the month, or record `Status ≠ Confirmed`, or they sit outside the manager's subtree. |
| Commission is 0 despite sales | Team/branch achievement < 70% of full target. |
| Member sales = 0 | `SA Sales Record` status not `Confirmed`, or wrong `sales_person`/date. |
| App won't install locally | Pre-existing `Job Opening: ... Job Category` validation error (unrelated to incentives). |

---

## 8. Reference

- Detailed business rules & doctype field lists: [feature-incentive-engine.md](./feature-incentive-engine.md) (§2–§10B).
- Rules source: [reward-and-incentive-rules.md](./reward-and-incentive-rules.md).
- Slab seeding: `supremusangel/supremus_angel/setup.py` → `create_incentive_data`.
