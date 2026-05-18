import frappe
from frappe.utils import flt


def execute(filters=None):
    filters = filters or {}
    columns = get_columns()
    data = get_data(filters)
    return columns, data


def get_columns():
    return [
        {"label": "Sales Person", "fieldname": "sales_person", "fieldtype": "Link", "options": "Sales Person", "width": 180},
        {"label": "Month", "fieldname": "calculation_month", "fieldtype": "Data", "width": 100},
        {"label": "Salary", "fieldname": "salary", "fieldtype": "Currency", "width": 120},
        {"label": "Base Target (10x)", "fieldname": "base_target", "fieldtype": "Currency", "width": 150},
        {"label": "Total Sales", "fieldname": "total_sales", "fieldtype": "Currency", "width": 140},
        {"label": "Achievement %", "fieldname": "achievement_percent", "fieldtype": "Float", "width": 120},
        {"label": "Slab", "fieldname": "slab_applied", "fieldtype": "Link", "options": "SA Incentive Slab", "width": 130},
        {"label": "Incentive %", "fieldname": "incentive_percent", "fieldtype": "Float", "width": 100},
        {"label": "Incentive Amt", "fieldname": "incentive_amount", "fieldtype": "Currency", "width": 130},
        {"label": "Reward %", "fieldname": "reward_percent", "fieldtype": "Float", "width": 90},
        {"label": "Reward Amt", "fieldname": "reward_amount", "fieldtype": "Currency", "width": 120},
        {"label": "Total Payout", "fieldname": "total_payout", "fieldtype": "Currency", "width": 130},
        {"label": "Status", "fieldname": "status", "fieldtype": "Data", "width": 90},
    ]


def get_data(filters):
    conditions = ["status != 'Draft'"]
    values = {}

    if filters.get("calculation_month"):
        conditions.append("calculation_month = %(calculation_month)s")
        values["calculation_month"] = filters["calculation_month"]

    if filters.get("sales_person"):
        conditions.append("sales_person = %(sales_person)s")
        values["sales_person"] = filters["sales_person"]

    if filters.get("status"):
        conditions.append("status = %(status)s")
        values["status"] = filters["status"]

    where = "WHERE " + " AND ".join(conditions) if conditions else ""

    return frappe.db.sql(
        f"""
        SELECT
            sales_person,
            calculation_month,
            salary,
            base_target,
            total_sales,
            achievement_percent,
            slab_applied,
            incentive_percent,
            incentive_amount,
            reward_percent,
            reward_amount,
            total_payout,
            status
        FROM `tabSA Incentive Calculation`
        {where}
        ORDER BY calculation_month DESC, sales_person ASC
        """,
        values,
        as_dict=True,
    )
