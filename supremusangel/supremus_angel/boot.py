import frappe
# from supremusangel.supremus_angel.api import policy_ack
from supremusangel.supremus_angel.onboarding_api import check_onboarding_status

def boot_session(bootinfo):
    user = frappe.session.user
    if user in ("Guest", "Administrator"):
        return
    onboarding_status = check_onboarding_status()
    bootinfo.onboarding_status = onboarding_status.get("required")