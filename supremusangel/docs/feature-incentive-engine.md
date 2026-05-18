# Feature: Sales Person Reward & Incentive Engine

**App:** supremusangel  
**Module:** Supremus Angel  
**Status:** Implemented & Deployed  
**Branch:** develop  
**Last Updated:** 2026-05-18  

---

## 1. Overview

The Sales Person Reward & Incentive Engine is a monthly payout system built inside the `supremusangel` Frappe custom app. It calculates how much incentive and additional reward each sales person earns in a given month based on their total confirmed sales value relative to a salary-linked base target.

The engine covers:

- Capture of individual sales transactions against defined merchandise types
- Automatic posting of sales records from submitted Sales Invoices
- Monthly calculation of achievement percentage, applicable slab, incentive, and reward
- Three management reports for monitoring payouts and distributions

---

## 2. Business Rules Summary

### 2.1 Base Target

| Formula | Description |
|---------|-------------|
| `base_target = 10 × salary` | Full monthly sales target |
| `minimum_target = 7 × salary` | Minimum threshold — no payout below this |
| `achievement_percent = (total_sales / base_target) × 100` | Achievement percentage |

### 2.2 Incentive Slabs

| Achievement Against 10x | Incentive (% of Salary) | Additional Reward (% of Sales above 10x) |
|-------------------------|-------------------------|------------------------------------------|
| Below 70% | 0% | 0% |
| 70% to below 80% | 10% | 0% |
| 80% to below 90% | 20% | 0% |
| 90% to below 100% | 30% | 0% |
| 100% to below 140% | 30% | 10% |
| 140% to below 200% | 30% | 11% |
| 200% to below 300% | 30% | 12.5% |
| 300% to below 400% | 30% | 14% |
| 400% and above | 30% | 15% |

**Boundary rule:** lower limit inclusive, upper limit exclusive. Example: exactly 80% falls in the 80–90% slab.

### 2.3 Payout Formula

```
incentive_amount = salary × incentive_percent / 100
reward_amount   = (total_sales − base_target) × reward_percent / 100   [only if total_sales > base_target]
total_payout    = incentive_amount + reward_amount
```

---

## 3. Worked Examples

### Example A — 85% Achievement (Slab 80–90%)

| Field | Value |
|-------|-------|
| Salary | ₹50,000 |
| Base Target (10x) | ₹5,00,000 |
| Total Sales | ₹4,25,000 |
| Achievement | 85% |
| Incentive (20% of ₹50,000) | ₹10,000 |
| Additional Reward | ₹0 |
| **Total Payout** | **₹10,000** |

### Example B — 120% Achievement (Slab 100–140%)

| Field | Value |
|-------|-------|
| Salary | ₹50,000 |
| Base Target (10x) | ₹5,00,000 |
| Total Sales | ₹6,00,000 |
| Achievement | 120% |
| Incentive (30% of ₹50,000) | ₹15,000 |
| Additional Reward (10% of ₹1,00,000) | ₹10,000 |
| **Total Payout** | **₹25,000** |

### Example C — 250% Achievement (Slab 200–300%)

| Field | Value |
|-------|-------|
| Salary | ₹50,000 |
| Base Target (10x) | ₹5,00,000 |
| Total Sales | ₹12,50,000 |
| Achievement | 250% |
| Incentive (30% of ₹50,000) | ₹15,000 |
| Additional Reward (12.5% of ₹7,50,000) | ₹93,750 |
| **Total Payout** | **₹1,08,750** |

---

## 4. DocTypes

### 4.1 SA Merchandise

Master table defining the types of products that can be sold.

| Field | Type | Description |
|-------|------|-------------|
| `merchandise_name` | Data (unique, autoname) | Name of the merchandise |
| `unit_definition` | Small Text | Human-readable unit description (e.g., "1 unit = ₹25,000") |
| `unit_value_inr` | Currency | Fixed INR value per unit (used when `is_variable_value = 0`) |
| `is_variable_value` | Check | If checked, the unit value is entered per sale rather than fixed |

**Seed data (4 records):**

| Merchandise | Fixed/Variable | Unit Value |
|-------------|---------------|------------|
| Pre-IPO Shares | Fixed | ₹25,000 |
| MIP Plan for Pre-IPO Shares | Variable | Per plan |
| Fractional Ownership of Franchise | Variable | Per fraction |
| Neo Green Contract Farming Land | Variable | Per area unit |

### 4.2 SA Incentive Slab

Configuration table for achievement slabs. Nine slabs are seeded (see Section 2.2).

| Field | Type | Description |
|-------|------|-------------|
| `slab_label` | Data | Display label |
| `min_achievement` | Float | Lower bound (inclusive) |
| `max_achievement` | Float | Upper bound (exclusive), hidden when `has_no_upper_limit` is set |
| `has_no_upper_limit` | Check | Open-ended slab (400% and above) |
| `incentive_percent` | Float | Incentive % of monthly salary |
| `reward_percent` | Float | Reward % on sales above 10x |
| `notes` | Small Text | Optional description |

**Naming:** `SA-SLAB-00001` series.

### 4.3 SA Sales Record

Transaction doctype recording each individual sale by a sales person.

| Field | Type | Description |
|-------|------|-------------|
| `sales_person` | Link → Sales Person | Sales person who closed the sale |
| `posting_date` | Date | Date of the sale |
| `status` | Select | `Confirmed` / `Cancelled` |
| `merchandise` | Link → SA Merchandise | Optional — not required for auto-posted records |
| `unit_definition` | Small Text | Fetched from merchandise |
| `is_variable_value` | Check | Fetched from merchandise |
| `units_sold` | Float | Number of units sold |
| `unit_value_inr` | Currency | Per-unit value in INR |
| `total_sales_value` | Currency | Calculated: `units_sold × unit_value_inr` |
| `reference_doctype` | Link → DocType | Source document type (e.g., Sales Invoice) |
| `reference_name` | Dynamic Link | Source document name |
| `notes` | Small Text | Free-text notes |

**Naming:** `SA-SALE-YYYY-00001` series.  
**Auto-calculation:** `total_sales_value` is recalculated on save via `before_save`.

### 4.4 SA Incentive Calculation

Main calculation document. One document per sales person per month.

**Inputs Tab:**

| Field | Type | Description |
|-------|------|-------------|
| `sales_person` | Link → Sales Person | Sales person being evaluated |
| `calculation_month` | Data | Format: `YYYY-MM` (e.g., `2026-05`) |
| `salary` | Currency | Monthly salary (x) — entered manually |
| `from_date` | Date | Auto-derived from `calculation_month` (read-only) |
| `to_date` | Date | Auto-derived from `calculation_month` (read-only) |
| `status` | Select | `Draft` / `Calculated` / `Approved` / `Paid` |

**Results Tab:**

| Field | Type | Description |
|-------|------|-------------|
| `base_target` | Currency | 10 × salary |
| `minimum_target` | Currency | 7 × salary |
| `total_sales` | Currency | Sum of confirmed SA Sales Records in the month |
| `achievement_percent` | Float | (total_sales / base_target) × 100 |
| `slab_applied` | Link → SA Incentive Slab | Matching slab |
| `incentive_percent` | Float | From slab |
| `incentive_amount` | Currency | salary × incentive_percent / 100 |
| `reward_percent` | Float | From slab |
| `reward_amount` | Currency | (total_sales − base_target) × reward_percent / 100 |
| `total_payout` | Currency | incentive_amount + reward_amount |

**Sales Details Tab:**

Child table (`SA Incentive Calculation Detail`) listing every SA Sales Record that was included in the calculation (sales_record, posting_date, merchandise, units_sold, total_sales_value).

**Naming:** `SA-INC-YYYY-00001` series.

---

## 5. Calculation Logic

Triggered by the **Calculate** button on the form (calls `calculate()` whitelist method).

```
1. Validate: salary, calculation_month, sales_person must be filled
2. base_target  = salary × 10
3. minimum_target = base_target × 0.70
4. from_date, to_date = first and last day of calculation_month
5. Fetch all SA Sales Records WHERE:
       sales_person = <selected>
       posting_date BETWEEN from_date AND to_date
       status = "Confirmed"
6. total_sales = SUM(total_sales_value)
7. achievement_percent = (total_sales / base_target) × 100
8. Find slab: iterate slabs sorted by min_achievement DESC,
   return first where achievement_percent >= min_achievement
   AND (has_no_upper_limit OR achievement_percent < max_achievement)
9. incentive_amount = salary × slab.incentive_percent / 100
10. reward_amount = (total_sales − base_target) × slab.reward_percent / 100
    [only if total_sales > base_target, else 0]
11. total_payout = incentive_amount + reward_amount
12. Populate sales_details child table
13. Set status = "Calculated", save document
```

---

## 6. Sales Invoice Integration

When a **Sales Invoice is submitted**, the system auto-creates SA Sales Records for each sales team member on the invoice.

**Hook:** `doc_events → Sales Invoice → on_submit`  
**File:** `supremus_angel/hooks/sales_invoice.py`

**Logic:**
- Reads `net_total` (falls back to `grand_total`)
- For each row in `sales_team`: allocates value by `allocated_percentage` (defaults to 100% if blank)
- Creates one SA Sales Record per sales person with `status = Confirmed`
- Sets `reference_doctype = Sales Invoice` and `reference_name` for traceability

**On cancellation (`on_cancel`):**
- Finds all SA Sales Records linked to the cancelled invoice with `status = Confirmed`
- Sets their status to `Cancelled` — they are excluded from future calculations

---

## 7. Reports

All three reports are accessible from the **Supremus Angel workspace** (shortcuts + Incentive Reports card).

### 7.1 Sales Person Incentive Summary

**Purpose:** Month-end payout sheet — one row per SA Incentive Calculation.

**Filters:** Month (YYYY-MM), Sales Person, Status

**Columns:** Sales Person, Month, Salary, Base Target, Total Sales, Achievement %, Slab, Incentive %, Incentive Amount, Reward %, Reward Amount, Total Payout, Status

**Excludes:** Draft documents

---

### 7.2 SA Sales Records Register

**Purpose:** Detailed register of all individual sales transactions.

**Filters:** From Date, To Date, Sales Person, Merchandise, Status (defaults to Confirmed)

**Columns:** Record, Sales Person, Posting Date, Merchandise, Units Sold, Unit Value, Total Sales Value, Status, Reference, Notes

---

### 7.3 Slab-wise Achievement Distribution

**Purpose:** Management view — how many sales persons fell in each slab for a given month, with totals.

**Filters:** Month (YYYY-MM)

**Columns:** Slab, Slab Label, Min Achievement %, Max Achievement %, Count, Total Sales, Total Incentive, Total Reward, Total Payout, Avg Achievement %

Includes a "No Slab (Below Minimum)" row for sales persons who did not qualify.

---

## 8. Workspace

A dedicated **Supremus Angel** workspace is configured in the Frappe desk.

**Shortcuts (Quick Access bar):**

| Label | Type | Color |
|-------|------|-------|
| SA Sales Record | DocType | Blue |
| SA Incentive Calculation | DocType | Green |
| Sales Person Incentive Summary | Report | Orange |
| SA Sales Records Register | Report | Purple |
| Slab-wise Achievement Distribution | Report | Yellow |

**Cards:**
- **Incentive Transactions** — SA Sales Record, SA Incentive Calculation
- **Incentive Masters** — SA Merchandise, SA Incentive Slab
- **Incentive Reports** — all 3 reports
- **Meetings & Policy** — Meeting, Company Policy

---

## 9. Setup & Seeding

### Create seed data (merchandise + slabs)

```bash
bench --site scope_connect.com execute supremusangel.supremus_angel.setup.create_incentive_data
```

### Create demo/test records (3 sales persons, May 2026)

```bash
bench --site scope_connect.com execute supremusangel.supremus_angel.demo.create_demo_records
```

**Demo persons and expected payouts (salary ₹50,000):**

| Sales Person | Total Sales | Achievement | Slab | Total Payout |
|-------------|-------------|-------------|------|-------------|
| Pritesh Thakar | ₹4,25,000 | 85% | 80–90% | ₹10,000 |
| Raja Kumar | ₹6,00,000 | 120% | 100–140% | ₹25,000 |
| Abhijeet Sambhaji Patil | ₹12,50,000 | 250% | 200–300% | ₹1,08,750 |

### Run migrate after deployment

```bash
bench --site scope_connect.com migrate
```

---

## 10. File Structure

```
supremusangel/supremus_angel/
├── setup.py                                  # Seed: merchandise + slabs
├── demo.py                                   # Test records for 3 persons
├── hooks/
│   ├── __init__.py
│   └── sales_invoice.py                      # on_submit / on_cancel hooks
├── doctype/
│   ├── sa_merchandise/
│   ├── sa_incentive_slab/
│   ├── sa_sales_record/
│   ├── sa_incentive_calculation/
│   └── sa_incentive_calculation_detail/
├── report/
│   ├── sales_person_incentive_summary/
│   ├── sa_sales_records_register/
│   └── slab_wise_achievement_distribution/
└── workspace/
    └── supremus_angel/supremus_angel.json
```

`hooks.py` (app root) registers the `doc_events` for Sales Invoice.

---

## 11. Open Policy Decisions

The following points need business/finance confirmation before full production automation:

1. **Sales basis** — should incentives be calculated on Sales Order, Sales Invoice submission, or Payment Received?
2. **Sales value basis** — gross value, net value before tax, or net realized value after discounts/refunds?
3. **Prorated targets** — should base targets be prorated for mid-month joiners, resignations, or unpaid leave?
4. **Split credit** — how is sales value split when multiple sales persons share a deal (currently uses `allocated_percentage` from Sales Invoice sales team)?
5. **Manual adjustments** — who can override or adjust a calculated payout, and does it require approval?
6. **Payout lock** — should Approved/Paid calculations be locked from recalculation?
7. **HRMS integration** — should salary be auto-fetched from Employee Salary Structure Assignment instead of manually entered?
