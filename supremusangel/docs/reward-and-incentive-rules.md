# Reward and Incentive Rules for Sales Persons

## 1. Purpose

This document defines the monthly reward and incentive calculation rules for Supremus Angel sales persons. The incentive is based on eligible unit sales made by a sales person during a calendar or payroll month, converted into total eligible sales value in INR.

The rules apply to merchandise such as:

- Pre-IPO shares
- MIP plans for Pre-IPO shares
- Fractional ownership investments in a franchise
- Neo Green Contract Farming Land

## 2. Key Definitions

| Term | Definition |
| --- | --- |
| Sales Person | Employee or user responsible for closing eligible sales. |
| Monthly Salary, `x` | Fixed monthly salary of the sales person. |
| Base Sales Target | `10 * x`. This is the full monthly target value. |
| Minimum Eligible Target | `70% of Base Sales Target`, equal to `7 * x`. Incentive starts only after this level is achieved. |
| Total Eligible Sales | Sum of eligible sales value booked for the sales person in the calculation month. |
| Achievement Percentage | `(Total Eligible Sales / Base Sales Target) * 100`. |
| Incentive Earned | Fixed salary-linked incentive earned based on the achievement slab. |
| Additional Reward | Extra reward payable after the sales person reaches at least 100% of the base target. |

## 3. Merchandise Unit Rules

Different merchandise can have different unit definitions. The unit definition is used to capture and explain the sale, but the incentive slab must be calculated on the final eligible sales value in INR.

| Merchandise | Example Unit Definition | Incentive Calculation Basis |
| --- | ---: | --- |
| Pre-IPO Shares | 1 unit = INR 25,000 | Eligible INR sales value |
| MIP Plan for Pre-IPO Shares | 1 unit = plan-specific INR value | Eligible INR sales value |
| Fractional Ownership of Franchise | 1 unit = configured franchise fraction/value | Eligible INR sales value |
| Neo Green Contract Farming Land | 1 unit = 0.75 land fraction/area unit | Eligible INR sales value of the sold fraction |

For every sale line, the system should store:

- Merchandise type
- Unit size or unit definition
- Number of units sold
- Unit sales value in INR, where applicable
- Total line sales value in INR
- Sales person
- Booking date or posting date
- Sale status

Only eligible, confirmed sales should be included in the monthly incentive calculation. Cancelled, reversed, refunded, or rejected sales should be excluded or adjusted according to finance approval rules.

## 4. Target and Achievement Formula

Let:

- `x` = monthly salary of the sales person
- `base_target` = `10 * x`
- `minimum_target` = `70% * base_target = 7 * x`
- `total_sales` = total eligible INR sales value for the month
- `achievement_percent` = `(total_sales / base_target) * 100`

Example:

If salary `x = INR 50,000`:

- Base sales target = `10 * 50,000 = INR 5,00,000`
- Minimum eligible target = `70% * 5,00,000 = INR 3,50,000`
- Incentive starts only if monthly eligible sales are at least `INR 3,50,000`

## 5. Slab-Wise Incentive Rules

Slabs are applied based on the achievement percentage against `10x`.

| Achievement Against `10x` | Incentive Earned | Additional Reward |
| ---: | ---: | ---: |
| Below 70% | 0 | 0 |
| 70% to below 80% | 10% of `x` | 0 |
| 80% to below 90% | 20% of `x` | 0 |
| 90% to below 100% | 30% of `x` | 0 |
| 100% to below 140% | 30% of `x` | 10% of `(total_sales - 10x)` |
| 140% to below 200% | 30% of `x` | 11% of `(total_sales - 10x)` |
| 200% to below 300% | 30% of `x` | 12.5% of `(total_sales - 10x)` |
| 300% to below 400% | 30% of `x` | 14% of `(total_sales - 10x)` |
| 400% and above | 30% of `x` | 15% of `(total_sales - 10x)` |

Boundary rule:

- The lower limit of each slab is inclusive.
- The upper limit is exclusive.
- Example: exactly 80% falls in the 80% to below 90% slab.
- 400% and above falls in the final slab.

## 6. Calculation Steps

1. Identify the sales person.
2. Read the sales person's monthly salary `x`.
3. Calculate the base sales target as `10 * x`.
4. Collect all eligible sales booked for the sales person in the month.
5. Convert merchandise units into eligible INR sales value.
6. Calculate achievement percentage using total eligible INR sales value.
7. Select the correct slab.
8. Calculate incentive earned.
9. Calculate additional reward if achievement is 100% or higher.
10. Calculate total payout:

```text
total_payout = incentive_earned + additional_reward
```

## 7. Worked Examples

### Example A: Below Minimum Target

| Field | Value |
| --- | ---: |
| Monthly salary `x` | INR 50,000 |
| Base target `10x` | INR 5,00,000 |
| Total eligible sales | INR 3,00,000 |
| Achievement | 60% |
| Incentive earned | INR 0 |
| Additional reward | INR 0 |
| Total payout | INR 0 |

Reason: Achievement is below the minimum 70% threshold.

### Example B: 80% to Below 90%

| Field | Value |
| --- | ---: |
| Monthly salary `x` | INR 50,000 |
| Base target `10x` | INR 5,00,000 |
| Total eligible sales | INR 4,25,000 |
| Achievement | 85% |
| Incentive earned | `20% of 50,000 = INR 10,000` |
| Additional reward | INR 0 |
| Total payout | INR 10,000 |

### Example C: 100% to Below 140%

| Field | Value |
| --- | ---: |
| Monthly salary `x` | INR 50,000 |
| Base target `10x` | INR 5,00,000 |
| Total eligible sales | INR 6,00,000 |
| Achievement | 120% |
| Incentive earned | `30% of 50,000 = INR 15,000` |
| Additional reward | `10% of (6,00,000 - 5,00,000) = INR 10,000` |
| Total payout | INR 25,000 |

### Example D: 200% to Below 300%

| Field | Value |
| --- | ---: |
| Monthly salary `x` | INR 50,000 |
| Base target `10x` | INR 5,00,000 |
| Total eligible sales | INR 12,50,000 |
| Achievement | 250% |
| Incentive earned | `30% of 50,000 = INR 15,000` |
| Additional reward | `12.5% of (12,50,000 - 5,00,000) = INR 93,750` |
| Total payout | INR 1,08,750 |

## 8. Eligibility and Adjustment Rules

The following rules should be finalized by business/finance before automation:

- Sales should be counted only after the sale is confirmed, approved, or booked as per company policy.
- If a sale is cancelled in the same month, it should not be counted.
- If a sale is cancelled after incentive payout, the reversal should be adjusted in the next payout cycle.
- Taxes, charges, discounts, and refunds should be consistently treated. The recommended basis is net eligible sales value before taxes unless finance defines otherwise.
- If one sale has multiple sales persons, the sale value should be split using an approved contribution percentage.
- If a sales person joins or leaves mid-month, the base target can either remain full-month or be prorated. This needs a policy decision.

## 9. Implementation Requirements

The incentive engine should support the following configuration:

| Configuration | Purpose |
| --- | --- |
| Merchandise master | Defines merchandise type, unit size, and sales value basis. |
| Sales person salary source | Provides monthly salary `x`. |
| Incentive slab table | Maintains achievement range, incentive percentage, and reward percentage. |
| Calculation period | Defines monthly calculation start and end dates. |
| Eligibility status | Determines which sales documents are counted. |
| Adjustment mechanism | Handles cancellations, refunds, and post-payout reversals. |

Recommended calculation fields:

| Field | Description |
| --- | --- |
| sales_person | Sales person receiving incentive credit. |
| calculation_month | Month for which payout is calculated. |
| salary | Monthly salary `x`. |
| base_target | `10 * x`. |
| minimum_target | `70% of base_target`. |
| total_sales | Eligible monthly sales value in INR. |
| achievement_percent | `(total_sales / base_target) * 100`. |
| incentive_percent | Fixed incentive percentage of salary from the slab. |
| incentive_amount | Incentive earned from salary percentage. |
| reward_percent | Additional reward percentage from the slab. |
| reward_amount | Additional reward on sales above `10x`. |
| total_payout | `incentive_amount + reward_amount`. |

## 10. Acceptance Criteria

The rule implementation is complete when:

- A sales person's monthly incentive can be calculated from salary and eligible sales value.
- No payout is generated below 70% achievement.
- The correct salary-linked incentive is generated for 70% to below 100% achievement.
- A 30% salary-linked incentive is generated for all achievement levels at or above 100%.
- Additional reward is calculated only on sales above `10x`.
- The correct additional reward percentage is selected for 100% and above slabs.
- Merchandise-specific unit definitions are preserved, but slab calculations use INR sales value.
- Cancelled or reversed sales do not incorrectly inflate incentive payout.
- Calculation output clearly shows salary, target, sales, achievement percentage, slab, incentive, reward, and total payout.

## 11. Open Policy Decisions

The following points need final confirmation before production automation:

- Should incentives be based on Sales Order, Sales Invoice, Payment Received, or another finance-approved event?
- Should `total_sales` be gross value, net value before tax, or net realized value after discounts/refunds?
- Should targets be prorated for mid-month joiners, resignations, unpaid leave, or role changes?
- How should sales credit be split when multiple sales persons are involved?
- Who can approve manual incentive adjustments?
- Should incentive payouts be locked after payroll approval?
