import frappe
from supremusangel.supremus_angel.api import policy_ack


def boot_session(bootinfo):
    user = frappe.session.user
    if user in ("Guest", "Administrator"):
        return

    pending = policy_ack.get_pending_policies()
    bootinfo.pending_policies = pending
