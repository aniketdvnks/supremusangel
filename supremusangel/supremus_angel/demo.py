"""
Creates dummy SA Sales Records for testing the incentive calculation.
Assumes monthly salary = INR 50,000 → Base Target = INR 5,00,000

Person 1 – Pritesh Thakar   : INR 4,25,000  → 85%  → slab 80-90%  → payout INR 10,000
Person 2 – Raja Kumar        : INR 6,00,000  → 120% → slab 100-140% → payout INR 25,000
Person 3 – Abhijeet Sambhaji Patil : INR 12,50,000 → 250% → slab 200-300% → payout INR 1,08,750
"""

import frappe
from frappe.utils import today


MONTH = "2026-05"

RECORDS = [
    # (sales_person, merchandise, units_sold, unit_value_inr, posting_date)
    # --- Pritesh Thakar: target 85% → total INR 4,25,000 ---
    ("Pritesh Thakar", "Pre-IPO Shares",                    10, 25000,   "2026-05-03"),
    ("Pritesh Thakar", "MIP Plan for Pre-IPO Shares",        1, 175000,  "2026-05-10"),

    # --- Raja Kumar: target 120% → total INR 6,00,000 ---
    ("Raja Kumar",     "Pre-IPO Shares",                    20, 25000,   "2026-05-05"),
    ("Raja Kumar",     "Fractional Ownership of Franchise",  1, 100000,  "2026-05-15"),

    # --- Abhijeet Sambhaji Patil: target 250% → total INR 12,50,000 ---
    ("Abhijeet Sambhaji Patil", "Pre-IPO Shares",           40, 25000,   "2026-05-07"),
    ("Abhijeet Sambhaji Patil", "Neo Green Contract Farming Land", 1, 250000, "2026-05-20"),
]


def create_demo_records():
    created = 0
    for sales_person, merchandise, units_sold, unit_value_inr, posting_date in RECORDS:
        # skip if already exists for this person+date+merchandise
        if frappe.db.exists("SA Sales Record", {
            "sales_person": sales_person,
            "merchandise": merchandise,
            "posting_date": posting_date,
        }):
            print(f"  Skip (exists): {sales_person} / {merchandise}")
            continue

        merch_doc = frappe.get_doc("SA Merchandise", merchandise)
        is_variable = merch_doc.is_variable_value
        fixed_val = merch_doc.unit_value_inr if not is_variable else 0
        total = units_sold * (unit_value_inr if is_variable else fixed_val)

        doc = frappe.get_doc({
            "doctype": "SA Sales Record",
            "sales_person": sales_person,
            "posting_date": posting_date,
            "status": "Confirmed",
            "merchandise": merchandise,
            "unit_definition": merch_doc.unit_definition,
            "is_variable_value": is_variable,
            "units_sold": units_sold,
            "unit_value_inr": unit_value_inr if is_variable else fixed_val,
            "total_sales_value": total,
        })
        doc.insert(ignore_permissions=True)
        print(f"  Created: {sales_person} | {merchandise} | ₹{total:,.0f}")
        created += 1

    frappe.db.commit()
    print(f"\nDone — {created} records created.")
    _print_summary()


def _print_summary():
    print("\n── Expected Payout Summary (salary ₹50,000) ──")
    data = [
        ("Pritesh Thakar",           425000,  85,  "80-90%",   10000,      0,       10000),
        ("Raja Kumar",               600000, 120, "100-140%",  15000,  10000,       25000),
        ("Abhijeet Sambhaji Patil", 1250000, 250, "200-300%",  15000,  93750,      108750),
    ]
    for name, sales, pct, slab, incentive, reward, total in data:
        print(f"  {name:<30} Sales ₹{sales:>10,.0f}  Achv {pct}%  Slab {slab}  "
              f"Incentive ₹{incentive:>7,.0f}  Reward ₹{reward:>8,.0f}  Total ₹{total:>9,.0f}")
