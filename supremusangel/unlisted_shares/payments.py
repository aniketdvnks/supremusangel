"""Prevent a linked payout from diverging from the approved request."""
import frappe
from frappe.utils import flt


def validate(doc, method=None):
    if not doc.get("custom_withdrawal_request"):
        if doc.get("custom_sales_person"):
            frappe.throw("Agent payouts must originate from an approved Withdrawal Request.")
        return
    request = frappe.get_doc("Withdrawal Request", doc.custom_withdrawal_request)
    if request.docstatus != 1:
        frappe.throw("The linked Withdrawal Request must be approved.")
    if request.payment_entry and request.payment_entry != doc.name:
        frappe.throw("This Withdrawal Request already has a Payment Entry.")
    expected = {"payment_type": "Pay", "company": request.company, "party_type": "Supplier", "party": request.supplier,
                "custom_sales_person": request.sales_person, "paid_from": request.paid_from, "paid_to": request.paid_to}
    if any(doc.get(k) != v for k, v in expected.items()) or flt(doc.base_paid_amount) != flt(request.amount):
        frappe.throw("Payment party, accounts, agent, company and amount must match the approved withdrawal.")
