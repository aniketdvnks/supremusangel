"""Direct Sales Partner mandate enforcement for Unlisted Shares invoices."""
import frappe
from frappe.utils import flt

GROUP = "Unlisted Shares"


def validate_invoice(doc, method=None):
    if not doc.get("custom_unlisted_shares") or doc.is_return:
        return

    mandate = get_invoice_mandate(doc)
    if not mandate:
        return

    if doc.company != mandate.company:
        frappe.throw("Direct Sales Mandate company must match the Sales Invoice company.")
    if doc.custom_primary_agent != mandate.sales_partner:
        frappe.throw("Primary Agent must match the Direct Sales Mandate sales partner.")

    items = get_share_items(doc)
    if len({row.item_code for row in items}) != 1 or items[0].item_code != mandate.deal:
        frappe.throw("A Direct Sales Mandate invoice must contain only its mandated deal item.")

    qty = sum(flt(row.qty) for row in items)
    if qty <= 0:
        frappe.throw("Direct Sales Mandate quantity must be greater than zero.")

    revision = get_active_revision(mandate.name, doc.posting_date)
    if not revision:
        frappe.throw("Submit a Direct Sales Rate Revision before booking this mandate.")

    for row in items:
        rate = flt(row.rate)
        if rate < flt(revision.minimum_selling_rate) or rate > flt(revision.maximum_selling_rate):
            frappe.throw(
                f"Rate for {row.item_code} must be between "
                f"{revision.minimum_selling_rate} and {revision.maximum_selling_rate}."
            )
        if rate < flt(revision.company_settlement_rate):
            frappe.throw("Selling rate cannot be below the company settlement rate.")

    already_sold = get_sold_quantity(mandate.name, exclude_invoice=doc.name)
    if already_sold + qty > flt(mandate.reserved_quantity):
        frappe.throw(
            f"Direct Sales Mandate has only {flt(mandate.reserved_quantity) - already_sold:g} shares remaining."
        )

    doc.custom_direct_sales_mandate = mandate.name
    doc.custom_direct_sales_rate_revision = revision.name
    doc.custom_company_settlement_rate = revision.company_settlement_rate
    doc.custom_direct_sales_partner_earning = sum(
        (flt(row.rate) - flt(revision.company_settlement_rate)) * flt(row.qty)
        for row in items
    )


def on_submit_invoice(doc, method=None):
    sync_mandate_from_invoice(doc)


def on_cancel_invoice(doc, method=None):
    sync_mandate_from_invoice(doc)


def sync_mandate_from_invoice(doc):
    if doc.get("custom_direct_sales_mandate"):
        update_mandate_quantities(doc.custom_direct_sales_mandate)


def get_invoice_mandate(doc):
    if doc.get("custom_direct_sales_mandate"):
        return frappe.get_doc("Direct Sales Mandate", doc.custom_direct_sales_mandate)

    items = get_share_items(doc)
    if not doc.custom_primary_agent or len({row.item_code for row in items}) != 1:
        return None

    names = frappe.get_all(
        "Direct Sales Mandate",
        filters={
            "sales_partner": doc.custom_primary_agent,
            "deal": items[0].item_code,
            "company": doc.company,
            "docstatus": 1,
            "status": ["!=", "Cancelled"],
        },
        pluck="name",
        order_by="mandate_date desc, creation desc",
        limit=2,
    )
    if len(names) > 1:
        frappe.throw("Multiple active Direct Sales Mandates match this invoice. Select one.")
    return frappe.get_doc("Direct Sales Mandate", names[0]) if names else None


def get_share_items(doc):
    return [
        row for row in doc.get("items", [])
        if row.item_code and frappe.db.get_value("Item", row.item_code, "item_group") == GROUP
    ]


def get_active_revision(mandate, posting_date=None):
    filters = {"mandate": mandate, "docstatus": 1}
    if posting_date:
        filters["effective_date"] = ["<=", posting_date]
    name = frappe.get_all(
        "Direct Sales Rate Revision",
        filters=filters,
        pluck="name",
        order_by="effective_date desc, creation desc",
        limit=1,
    )
    return frappe.get_doc("Direct Sales Rate Revision", name[0]) if name else None


def get_sold_quantity(mandate, exclude_invoice=None):
    conditions = [
        "si.docstatus = 1",
        "si.custom_direct_sales_mandate = %(mandate)s",
        "sii.parenttype = 'Sales Invoice'",
    ]
    values = {"mandate": mandate}
    if exclude_invoice:
        conditions.append("si.name != %(exclude_invoice)s")
        values["exclude_invoice"] = exclude_invoice
    return flt(frappe.db.sql(
        f"""select coalesce(sum(sii.qty), 0)
            from `tabSales Invoice Item` sii
            join `tabSales Invoice` si on si.name = sii.parent
            where {' and '.join(conditions)}""",
        values,
    )[0][0])


def update_mandate_quantities(mandate):
    doc = frappe.get_doc("Direct Sales Mandate", mandate)
    sold = get_sold_quantity(mandate)
    remaining = max(flt(doc.reserved_quantity) - sold, 0)
    status = "Completed" if doc.docstatus == 1 and remaining <= 0 else ("Active" if doc.docstatus == 1 else doc.status)
    frappe.db.set_value("Direct Sales Mandate", mandate, {
        "sold_quantity": sold,
        "remaining_quantity": remaining,
        "status": status,
    })
