import frappe
from frappe.utils import getdate, nowdate
from erpnext.accounts.report.financial_statements import get_period_list
from supremusangel.supremus_angel.api.target import *

@frappe.whitelist()
def get_logged_in_sales_person_target_variance(filters=None):
    """
    Detects current logged-in user, finds linked Sales Person,
    and returns current month + current quarter target variance
    only for that Sales Person.

    Expected filters:
        {
            "company": "Your Company",
            "fiscal_year": "2025-2026",
            "doctype": "Sales Invoice",
            "target_on": "Amount"
        }
    """

    filters = frappe._dict(
        frappe.parse_json(filters) if isinstance(filters, str) else filters or {}
    )

    validate_target_variance_filters(filters)

    user = frappe.session.user

    if user == "Guest":
        frappe.throw("Guest user is not allowed to access sales target variance.")

    sales_person = get_sales_person_for_user(user)

    if not sales_person:
        frappe.throw(
            f"No Sales Person is linked with user {user}."
        )

    current_month_data = get_current_period_target_variance_for_sales_person(
        filters=filters,
        sales_person=sales_person,
        period_type="Monthly",
        response_label="Current Month"
    )

    current_quarter_data = get_current_period_target_variance_for_sales_person(
        filters=filters,
        sales_person=sales_person,
        period_type="Quarterly",
        response_label="Current Quarter"
    )

    return {
        "user": user,
        "sales_person": sales_person,
        "current_month": current_month_data,
        "current_quarter": current_quarter_data
    }


def get_sales_person_for_user(user):
    """
    Finds Sales Person linked to current User.

    Preferred flow:
        User -> Employee -> Sales Person

    Standard ERPNext linkage:
        Employee.user_id = User.email/name
        Sales Person.employee = Employee.name
    """

    employee = frappe.db.get_value(
        "Employee",
        {
            "user_id": user,
            "status": "Active"
        },
        "name"
    )

    if not employee:
        return None

    sales_person = frappe.db.get_value(
        "Sales Person",
        {
            "employee": employee,
            "enabled": 1
        },
        "name"
    )

    return sales_person


def get_current_period_target_variance_for_sales_person(
    filters,
    sales_person,
    period_type,
    response_label
):
    """
    Returns current month or current quarter target variance
    for one Sales Person only.
    """

    current_date = getdate(nowdate())

    period_list = get_period_list(
        filters.fiscal_year,
        filters.fiscal_year,
        "",
        "",
        "Fiscal Year",
        period_type,
        company=filters.company,
    )

    current_periods = [
        period for period in period_list
        if period.from_date <= current_date <= period.to_date
    ]

    if not current_periods:
        return {
            "period_type": response_label,
            "sales_person": sales_person,
            "target": 0,
            "achieved": 0,
            "variance": 0,
            "data": []
        }

    rows = get_data_for_single_sales_person(
        filters=filters,
        period_list=current_periods,
        sales_person=sales_person
    )

    return build_single_sales_person_response(
        rows=rows,
        period_list=current_periods,
        sales_person=sales_person,
        period_type=response_label
    )


def get_data_for_single_sales_person(filters, period_list, sales_person):
    """
    Same idea as original get_data(),
    but restricted to the logged-in user's Sales Person.
    """

    sales_field = "sales_person"

    sales_users_data = get_target_details_for_sales_person(
        filters=filters,
        sales_person=sales_person
    )

    if not sales_users_data:
        return {}

    sales_user_wise_item_groups = {
        sales_person: []
    }

    for d in sales_users_data:
        if d.item_group:
            sales_user_wise_item_groups.setdefault(sales_person, [])
            sales_user_wise_item_groups[sales_person].append(d.item_group)

    date_field = "transaction_date" if filters.get("doctype") == "Sales Order" else "posting_date"

    actual_data = get_actual_data(
        filters=filters,
        sales_users_or_territory_data=[sales_person],
        date_field=date_field,
        sales_field=sales_field
    )

    return prepare_data(
        filters=filters,
        sales_users_data=sales_users_data,
        sales_user_wise_item_groups=sales_user_wise_item_groups,
        actual_data=actual_data,
        date_field=date_field,
        period_list=period_list,
        sales_field=sales_field,
    )


def get_target_details_for_sales_person(filters, sales_person):
    """
    Fetches Target Detail only for the logged-in user's Sales Person.
    """

    target_qty_amt_field = (
        "target_qty" if filters.get("target_on") == "Quantity" else "target_amount"
    )

    filters_dict = {
        "parenttype": "Sales Person",
        "parent": sales_person
    }

    if filters.get("fiscal_year"):
        filters_dict["fiscal_year"] = filters.get("fiscal_year")

    return frappe.get_all(
        "Target Detail",
        filters=filters_dict,
        fields=[
            "parent",
            "item_group",
            target_qty_amt_field,
            "fiscal_year",
            "distribution_id"
        ],
    )


def build_single_sales_person_response(rows, period_list, sales_person, period_type):
    """
    Builds clean response for logged-in Sales Person.
    """

    if not rows:
        return {
            "period_type": period_type,
            "sales_person": sales_person,
            "target": 0,
            "achieved": 0,
            "variance": 0,
            "data": []
        }

    data = []

    grand_target = 0
    grand_achieved = 0
    grand_variance = 0

    for key, value in rows.items():
        item_group = key[1]

        row_target = 0
        row_achieved = 0
        row_variance = 0

        period_details = []

        for period in period_list:
            target_key = f"target_{period.key}"
            variance_key = f"variance_{period.key}"

            target = value.get(target_key, 0)
            achieved = value.get(period.key, 0)
            variance = value.get(variance_key, achieved - target)

            row_target += target
            row_achieved += achieved
            row_variance += variance

            period_details.append({
                "period": period.label,
                "from_date": period.from_date,
                "to_date": period.to_date,
                "target": target,
                "achieved": achieved,
                "variance": variance
            })

        grand_target += row_target
        grand_achieved += row_achieved
        grand_variance += row_variance

        data.append({
            "sales_person": sales_person,
            "item_group": item_group,
            "target": row_target,
            "achieved": row_achieved,
            "variance": row_variance,
            "period_details": period_details
        })

    return {
        "period_type": period_type,
        "sales_person": sales_person,
        "target": grand_target,
        "achieved": grand_achieved,
        "variance": grand_variance,
        "data": data
    }


def validate_target_variance_filters(filters):
    """
    Validates required filters.
    """

    required_fields = [
        "company",
        "fiscal_year",
        "doctype",
        "target_on"
    ]

    for field in required_fields:
        if not filters.get(field):
            frappe.throw(f"Missing required filter: {field}")

    if filters.get("doctype") not in ["Sales Order", "Sales Invoice"]:
        frappe.throw("doctype must be either Sales Order or Sales Invoice")

    if filters.get("target_on") not in ["Amount", "Quantity"]:
        frappe.throw("target_on must be either Amount or Quantity")
