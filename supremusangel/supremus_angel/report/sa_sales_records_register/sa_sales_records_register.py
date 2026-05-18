import frappe
from frappe.utils import getdate


def execute(filters=None):
    filters = filters or {}
    columns = get_columns()
    data = get_data(filters)
    return columns, data


def get_columns():
    return [
        {"label": "Record", "fieldname": "name", "fieldtype": "Link", "options": "SA Sales Record", "width": 160},
        {"label": "Sales Person", "fieldname": "sales_person", "fieldtype": "Link", "options": "Sales Person", "width": 170},
        {"label": "Posting Date", "fieldname": "posting_date", "fieldtype": "Date", "width": 110},
        {"label": "Merchandise", "fieldname": "merchandise", "fieldtype": "Link", "options": "SA Merchandise", "width": 200},
        {"label": "Units Sold", "fieldname": "units_sold", "fieldtype": "Float", "width": 90},
        {"label": "Unit Value", "fieldname": "unit_value_inr", "fieldtype": "Currency", "width": 120},
        {"label": "Total Sales Value", "fieldname": "total_sales_value", "fieldtype": "Currency", "width": 140},
        {"label": "Status", "fieldname": "status", "fieldtype": "Data", "width": 90},
        {"label": "Reference", "fieldname": "reference_name", "fieldtype": "Dynamic Link", "options": "reference_doctype", "width": 150},
        {"label": "Notes", "fieldname": "notes", "fieldtype": "Small Text", "width": 200},
    ]


def get_data(filters):
    conditions = []
    values = {}

    if filters.get("from_date"):
        conditions.append("posting_date >= %(from_date)s")
        values["from_date"] = filters["from_date"]

    if filters.get("to_date"):
        conditions.append("posting_date <= %(to_date)s")
        values["to_date"] = filters["to_date"]

    if filters.get("sales_person"):
        conditions.append("sales_person = %(sales_person)s")
        values["sales_person"] = filters["sales_person"]

    if filters.get("merchandise"):
        conditions.append("merchandise = %(merchandise)s")
        values["merchandise"] = filters["merchandise"]

    if filters.get("status"):
        conditions.append("status = %(status)s")
        values["status"] = filters["status"]

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    return frappe.db.sql(
        f"""
        SELECT
            name,
            sales_person,
            posting_date,
            merchandise,
            units_sold,
            unit_value_inr,
            total_sales_value,
            status,
            reference_doctype,
            reference_name,
            notes
        FROM `tabSA Sales Record`
        {where}
        ORDER BY posting_date DESC, sales_person ASC
        """,
        values,
        as_dict=True,
    )
