import frappe
from frappe.utils import flt


def execute(filters=None):
    filters = filters or {}
    columns = get_columns()
    data = get_data(filters)
    return columns, data


def get_columns():
    return [
        {"label": "Slab", "fieldname": "slab_applied", "fieldtype": "Link", "options": "SA Incentive Slab", "width": 150},
        {"label": "Slab Label", "fieldname": "slab_label", "fieldtype": "Data", "width": 180},
        {"label": "Min Achievement %", "fieldname": "min_achievement", "fieldtype": "Float", "width": 140},
        {"label": "Max Achievement %", "fieldname": "max_achievement", "fieldtype": "Data", "width": 140},
        {"label": "Count", "fieldname": "count", "fieldtype": "Int", "width": 80},
        {"label": "Total Sales", "fieldname": "total_sales", "fieldtype": "Currency", "width": 140},
        {"label": "Total Incentive", "fieldname": "total_incentive", "fieldtype": "Currency", "width": 140},
        {"label": "Total Reward", "fieldname": "total_reward", "fieldtype": "Currency", "width": 130},
        {"label": "Total Payout", "fieldname": "total_payout", "fieldtype": "Currency", "width": 130},
        {"label": "Avg Achievement %", "fieldname": "avg_achievement", "fieldtype": "Float", "width": 140},
    ]


def get_data(filters):
    conditions = ["ic.status != 'Draft'"]
    values = {}

    if filters.get("calculation_month"):
        conditions.append("ic.calculation_month = %(calculation_month)s")
        values["calculation_month"] = filters["calculation_month"]

    where = "WHERE " + " AND ".join(conditions)

    rows = frappe.db.sql(
        f"""
        SELECT
            ic.slab_applied,
            sl.slab_label,
            sl.min_achievement,
            sl.max_achievement,
            sl.has_no_upper_limit,
            COUNT(ic.name) AS count,
            SUM(ic.total_sales) AS total_sales,
            SUM(ic.incentive_amount) AS total_incentive,
            SUM(ic.reward_amount) AS total_reward,
            SUM(ic.total_payout) AS total_payout,
            AVG(ic.achievement_percent) AS avg_achievement
        FROM `tabSA Incentive Calculation` ic
        LEFT JOIN `tabSA Incentive Slab` sl ON sl.name = ic.slab_applied
        {where}
        GROUP BY ic.slab_applied
        ORDER BY sl.min_achievement ASC
        """,
        values,
        as_dict=True,
    )

    # also add a row for calculations with no slab (below minimum)
    no_slab_conditions = conditions + ["ic.slab_applied IS NULL OR ic.slab_applied = ''"]
    no_slab_where = "WHERE " + " AND ".join(no_slab_conditions)
    no_slab = frappe.db.sql(
        f"""
        SELECT
            COUNT(ic.name) AS count,
            SUM(ic.total_sales) AS total_sales,
            SUM(ic.incentive_amount) AS total_incentive,
            SUM(ic.reward_amount) AS total_reward,
            SUM(ic.total_payout) AS total_payout,
            AVG(ic.achievement_percent) AS avg_achievement
        FROM `tabSA Incentive Calculation` ic
        {no_slab_where}
        """,
        values,
        as_dict=True,
    )

    result = []
    for r in rows:
        if not r.slab_applied:
            continue
        max_disp = "No Limit" if r.has_no_upper_limit else flt(r.max_achievement)
        result.append({
            "slab_applied": r.slab_applied,
            "slab_label": r.slab_label,
            "min_achievement": flt(r.min_achievement),
            "max_achievement": max_disp,
            "count": r.count,
            "total_sales": flt(r.total_sales),
            "total_incentive": flt(r.total_incentive),
            "total_reward": flt(r.total_reward),
            "total_payout": flt(r.total_payout),
            "avg_achievement": flt(r.avg_achievement),
        })

    if no_slab and no_slab[0].count:
        ns = no_slab[0]
        result.append({
            "slab_applied": "",
            "slab_label": "No Slab (Below Minimum)",
            "min_achievement": 0,
            "max_achievement": "-",
            "count": ns.count,
            "total_sales": flt(ns.total_sales),
            "total_incentive": 0,
            "total_reward": 0,
            "total_payout": 0,
            "avg_achievement": flt(ns.avg_achievement),
        })

    return result
