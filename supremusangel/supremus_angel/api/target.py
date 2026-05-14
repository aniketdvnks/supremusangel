import frappe
from frappe.utils import getdate, nowdate
from erpnext.accounts.report.financial_statements import get_period_list
from erpnext.selling.report.sales_partner_target_variance_based_on_item_group.item_group_wise_sales_target_variance import get_data

@frappe.whitelist()
def get_current_month_target_variance(filters=None, partner_doctype="Sales Person"):
    """
    Returns current month target, achieved and variance.

    Example:
        get_current_month_target_variance({
            "company": "My Company",
            "fiscal_year": "2025-2026",
            "period": "Monthly",
            "doctype": "Sales Invoice",
            "target_on": "Amount"
        }, "Sales Person")
    """

    filters = frappe._dict(frappe.parse_json(filters) if isinstance(filters, str) else filters or {})

    validate_target_variance_filters(filters)

    current_date = getdate(nowdate())

    period_list = get_period_list(
        filters.fiscal_year,
        filters.fiscal_year,
        "",
        "",
        "Fiscal Year",
        "Monthly",
        company=filters.company,
    )

    current_month_periods = [
        period for period in period_list
        if period.from_date <= current_date <= period.to_date
    ]

    if not current_month_periods:
        return {
            "period_type": "Current Month",
            "message": "No current month period found for selected fiscal year.",
            "data": []
        }

    rows = get_data(filters, current_month_periods, partner_doctype)

    return build_target_variance_response(
        rows=rows,
        period_list=current_month_periods,
        partner_doctype=partner_doctype,
        period_type="Current Month"
    )


@frappe.whitelist()
def get_current_quarter_target_variance(filters=None, partner_doctype="Sales Person"):
    """
    Returns current quarter target, achieved and variance.

    Example:
        get_current_quarter_target_variance({
            "company": "My Company",
            "fiscal_year": "2025-2026",
            "period": "Quarterly",
            "doctype": "Sales Invoice",
            "target_on": "Amount"
        }, "Sales Person")
    """

    filters = frappe._dict(frappe.parse_json(filters) if isinstance(filters, str) else filters or {})

    validate_target_variance_filters(filters)

    current_date = getdate(nowdate())

    period_list = get_period_list(
        filters.fiscal_year,
        filters.fiscal_year,
        "",
        "",
        "Fiscal Year",
        "Quarterly",
        company=filters.company,
    )

    current_quarter_periods = [
        period for period in period_list
        if period.from_date <= current_date <= period.to_date
    ]

    if not current_quarter_periods:
        return {
            "period_type": "Current Quarter",
            "message": "No current quarter period found for selected fiscal year.",
            "data": []
        }

    rows = get_data(filters, current_quarter_periods, partner_doctype)

    return build_target_variance_response(
        rows=rows,
        period_list=current_quarter_periods,
        partner_doctype=partner_doctype,
        period_type="Current Quarter"
    )


def validate_target_variance_filters(filters):
    """
    Validates required filters for target variance methods.
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


def build_target_variance_response(rows, period_list, partner_doctype, period_type):
    """
    Converts prepare_data() result into clean API response.
    """

    if not rows:
        return {
            "period_type": period_type,
            "data": []
        }

    partner_field = frappe.scrub(partner_doctype)
    data = []

    for key, value in rows.items():
        partner_name = key[0]
        item_group = key[1]

        total_target = 0
        total_achieved = 0
        total_variance = 0

        period_details = []

        for period in period_list:
            target_key = f"target_{period.key}"
            variance_key = f"variance_{period.key}"

            target = value.get(target_key, 0)
            achieved = value.get(period.key, 0)
            variance = value.get(variance_key, achieved - target)

            total_target += target
            total_achieved += achieved
            total_variance += variance

            period_details.append({
                "period": period.label,
                "from_date": period.from_date,
                "to_date": period.to_date,
                "target": target,
                "achieved": achieved,
                "variance": variance
            })

        data.append({
            partner_field: partner_name,
            "item_group": item_group,
            "period_type": period_type,
            "target": total_target,
            "achieved": total_achieved,
            "variance": total_variance,
            "period_details": period_details
        })

    return {
        "period_type": period_type,
        "data": data
    }
