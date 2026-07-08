import frappe
from frappe.utils import flt

from supremusangel.supremus_angel.incentive_source import get_settings


def execute(filters=None):
    filters = filters or {}
    return get_columns(), get_data(filters)


def get_columns():
    return [
        {"label": "Slab", "fieldname": "slab_applied", "fieldtype": "Data", "width": 200},
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
    conditions = ["status != 'Draft'"]
    values = {}
    if filters.get("calculation_month"):
        conditions.append("calculation_month = %(calculation_month)s")
        values["calculation_month"] = filters["calculation_month"]
    where = "WHERE " + " AND ".join(conditions)

    rows = frappe.db.sql(
        f"""
        SELECT
            COALESCE(NULLIF(slab_applied, ''), '__none__') AS slab_applied,
            COUNT(name) AS count,
            SUM(total_sales) AS total_sales,
            SUM(incentive_amount) AS total_incentive,
            SUM(reward_amount) AS total_reward,
            SUM(total_payout) AS total_payout,
            AVG(achievement_percent) AS avg_achievement
        FROM `tabSA Incentive Calculation`
        {where}
        GROUP BY COALESCE(NULLIF(slab_applied, ''), '__none__')
        """,
        values,
        as_dict=True,
    )

    # slab label -> (min, max display) from the central settings, to order/annotate
    bounds = {}
    order = {}
    settings = get_settings()
    for idx, s in enumerate(settings.salesperson_slabs):
        max_disp = "No Limit" if s.has_no_upper_limit else flt(s.max_achievement)
        bounds[s.slab_label] = (flt(s.min_achievement), max_disp)
        order[s.slab_label] = flt(s.min_achievement)

    result = []
    for r in rows:
        if r.slab_applied == "__none__":
            result.append({
                "slab_applied": "No Slab (Below Minimum)",
                "min_achievement": 0, "max_achievement": "-",
                "count": r.count, "total_sales": flt(r.total_sales),
                "total_incentive": 0, "total_reward": 0, "total_payout": 0,
                "avg_achievement": flt(r.avg_achievement),
                "_order": -1,
            })
            continue
        mn, mx = bounds.get(r.slab_applied, (0, "-"))
        result.append({
            "slab_applied": r.slab_applied,
            "min_achievement": mn, "max_achievement": mx,
            "count": r.count, "total_sales": flt(r.total_sales),
            "total_incentive": flt(r.total_incentive), "total_reward": flt(r.total_reward),
            "total_payout": flt(r.total_payout), "avg_achievement": flt(r.avg_achievement),
            "_order": order.get(r.slab_applied, 9999),
        })

    result.sort(key=lambda x: x["_order"])
    for x in result:
        x.pop("_order", None)
    return result
