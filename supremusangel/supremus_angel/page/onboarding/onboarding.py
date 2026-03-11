import frappe
from frappe import _

def get_context(context):
    """Page context for employee onboarding."""
    context.no_cache = 1
    
    # Check if user has permission
    if frappe.session.user == "Guest":
        frappe.throw(_("Please login to access this page"), frappe.PermissionError)
    
    return context
