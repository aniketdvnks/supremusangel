"""Supremus Angel investor-portal notifications.

Declarative, document-event notifications (KYC verified/rejected, Purchase Note,
Payment Received, Shares Transferred, Invoice Generated) live as ``Notification``
fixtures in ``supremusangel/fixtures/notification.json`` — both email and the desk
"bell" (``send_system_notification``).

This module covers the triggers that cannot be expressed as a plain Notification:

* Welcome email with login credentials  -> ``User`` after_insert
* "Complete your KYC" reminder           -> on_login (once/day while pending)
* Payment Failed                         -> ``Payment Entry`` on_cancel
* Share Transfer Unsuccessful            -> ``Sales Invoice`` on_cancel
* MIP installment due reminders          -> daily scheduled task (5/2/1/0 days)

Branding is "Supremus Angel". Portal link / support details are left as
``[Portal Link]`` placeholders to be filled in later (per requirement).

NOTE: a couple of integration points are intentionally tolerant (wrapped in
try/except + logged) because the surrounding investor-portal data lives in the
``customer_portal`` app on the same site; if a field/function moves, the rest of
the notifications keep working and the failure is logged rather than fatal.
"""

from __future__ import annotations

import frappe
from frappe.utils import add_days, fmt_money, formatdate, getdate, random_string, today

PORTAL_LINK_PLACEHOLDER = "[Portal Link]"
TEAM_SIGNATURE = "Regards,<br>Team Supremus Angel"

# Website Users that already get their own welcome flow elsewhere — never touch them.
SKIP_WELCOME_ROLES = {"Stakeholder", "Scope Member", "System Manager"}

# Reminder offsets (days before the installment due date) -> short label.
MIP_REMINDER_OFFSETS = {5, 2, 1, 0}


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------
def _send(recipients, subject, message, doc=None, attach_print=False):
    """Send an email and mirror it to the desk system notification (bell)."""
    recipients = [r for r in (recipients if isinstance(recipients, (list, tuple)) else [recipients]) if r]
    if not recipients:
        return

    mail_args = {
        "recipients": recipients,
        "subject": subject,
        "message": message,
    }
    if doc is not None:
        mail_args["reference_doctype"] = doc.doctype
        mail_args["reference_name"] = doc.name
        if attach_print:
            mail_args["attachments"] = [
                frappe.attach_print(doc.doctype, doc.name, file_name=doc.name)
            ]
    frappe.sendmail(**mail_args)

    # System (bell) notification for the linked portal user, if we can resolve one.
    for recipient in recipients:
        user = recipient if frappe.db.exists("User", recipient) else None
        if user:
            _system_notification(user, subject, message, doc)


def _system_notification(user, subject, message, doc=None):
    try:
        notif = frappe.new_doc("Notification Log")
        notif.subject = subject
        notif.for_user = user
        notif.type = "Alert"
        notif.email_content = message
        if doc is not None:
            notif.document_type = doc.doctype
            notif.document_name = doc.name
        notif.insert(ignore_permissions=True)
    except Exception:
        frappe.log_error(frappe.get_traceback(), "SA system notification failed")


def _get_customer_for_user(user):
    """Resolve the Customer linked to a portal user (mirrors customer_portal logic)."""
    meta = frappe.get_meta("Customer")

    if meta.has_field("portal_users"):
        customer = frappe.db.get_value(
            "Portal User", {"user": user, "parenttype": "Customer"}, "parent"
        )
        if customer:
            return customer

    if meta.has_field("portal_user"):
        customer = frappe.db.get_value("Customer", {"portal_user": user}, "name")
        if customer:
            return customer

    contact = frappe.db.get_value("Contact", {"email_id": user}, "name")
    if contact:
        return frappe.db.get_value(
            "Dynamic Link",
            {"link_doctype": "Customer", "parent": contact, "parenttype": "Contact"},
            "link_name",
        )
    return None


def _portal_user_for_customer(customer_name):
    """Best-effort reverse lookup: the login User for a Customer."""
    if not customer_name:
        return None
    meta = frappe.get_meta("Customer")
    if meta.has_field("portal_users"):
        user = frappe.db.get_value(
            "Portal User", {"parent": customer_name, "parenttype": "Customer"}, "user"
        )
        if user:
            return user
    if meta.has_field("portal_user"):
        return frappe.db.get_value("Customer", customer_name, "portal_user")
    return None


def _customer_email(customer_name, fallback=None):
    if fallback:
        return fallback
    if not customer_name:
        return None
    return frappe.db.get_value("Customer", customer_name, "email_id")


# ---------------------------------------------------------------------------
# Trigger 1 — Welcome email with login credentials (User.after_insert)
# ---------------------------------------------------------------------------
def send_customer_welcome_email(doc, method=None):
    """Email portal credentials when a customer/investor Website User is created."""
    if doc.user_type != "Website User":
        return
    if doc.name in ("Administrator", "Guest"):
        return

    roles = {r.role for r in (doc.get("roles") or [])}
    if roles & SKIP_WELCOME_ROLES:
        return

    try:
        temp_password = random_string(10)
        from frappe.utils.password import update_password

        update_password(doc.name, temp_password)

        subject = "Welcome to Supremus Angel"
        message = f"""
<p>Dear {doc.first_name or doc.full_name or "Customer"},</p>
<p>Welcome to Supremus Angel. We are delighted to have you as part of our investor community.</p>
<p>Your customer portal account has been successfully created. Through the portal you can manage
your investments, track transactions, access important documents, and stay updated with new opportunities.</p>
<p><strong>Your Login Credentials:</strong><br>
Portal Link: {PORTAL_LINK_PLACEHOLDER}<br>
User ID: {doc.name}<br>
Temporary Password: {temp_password}</p>
<p>For security purposes, we recommend changing your password after your first login.</p>
<p>Please complete your KYC verification to activate your account and begin using all portal services.</p>
<p>If you need any assistance, our support team is always available to help.</p>
<p>{TEAM_SIGNATURE}</p>
"""
        _send([doc.name], subject, message)
    except Exception:
        frappe.log_error(frappe.get_traceback(), "SA welcome email failed")


# ---------------------------------------------------------------------------
# Trigger 2 — "Complete your KYC" reminder on login (once per day while pending)
# ---------------------------------------------------------------------------
def send_kyc_reminder_on_login(login_manager):
    user = getattr(login_manager, "user", None)
    if not user or user in ("Administrator", "Guest"):
        return

    try:
        customer_name = _get_customer_for_user(user)
        if not customer_name:
            return

        customer = frappe.get_doc("Customer", customer_name)
        if customer.get("custom_kyc_verified"):
            return
        if (customer.get("custom_portal_onboarding_status") or "").lower() == "completed":
            return

        # Send at most once per day per user.
        cache_key = f"sa_kyc_login_reminder:{user}"
        if frappe.cache().get_value(cache_key):
            return
        frappe.cache().set_value(cache_key, 1, expires_in_sec=86400)

        subject = "Update Your KYC"
        message = f"""
<p>Dear {customer.customer_name},</p>
<p>Thank you for logging into your Supremus Angel customer portal.</p>
<p>To activate your account and access all investment services, please complete your KYC
verification by submitting the necessary details and documents.</p>
<p>We also recommend updating your password according to your preference for enhanced account security.</p>
<p>Complete Your KYC Here: {PORTAL_LINK_PLACEHOLDER}</p>
<p>Once your KYC is verified, you will receive a confirmation email from our team.</p>
<p>{TEAM_SIGNATURE}</p>
"""
        _send([user], subject, message)
    except Exception:
        frappe.log_error(frappe.get_traceback(), "SA KYC login reminder failed")


# ---------------------------------------------------------------------------
# Trigger 7 — Payment Failed (Payment Entry on_cancel)
# ---------------------------------------------------------------------------
def notify_payment_failed(doc, method=None):
    if not doc.get("custom_is_mip"):
        return

    email = _customer_email(doc.get("party"), fallback=doc.get("contact_email"))
    if not email:
        return

    subject = f"Payment Failed: Order {doc.name}"
    message = f"""
<p>Dear Customer,</p>
<p>Your recent payment attempt was unsuccessful. No funds were debited, or if deducted, they will
be automatically refunded by your bank.</p>
<ul>
<li>Reference: {doc.get("reference_no") or doc.name}</li>
<li>Action Required: Please log in to retry using the same or a different payment method.</li>
</ul>
<p>Retry Payment: {PORTAL_LINK_PLACEHOLDER}</p>
<p>Contact your Relationship Manager or our support team for any help.</p>
<p>Best regards,<br>Team Supremus Angel</p>
"""
    _send([email], subject, message, doc=doc)


# ---------------------------------------------------------------------------
# Trigger 9 — Share Transfer Unsuccessful (Sales Invoice on_cancel)
# ---------------------------------------------------------------------------
def notify_share_transfer_failed(doc, method=None):
    if not doc.get("update_stock"):
        return

    email = _customer_email(doc.get("customer"), fallback=doc.get("contact_email"))
    if not email:
        return

    subject = f"Notification: Share Transfer Request Failed {doc.name}"
    message = f"""
<p>Dear Customer,</p>
<p>We are writing to inform you that your recent share transfer request could not be processed
successfully.</p>
<ul>
<li>Reference: {doc.name}</li>
</ul>
<p>Please log in to your portal to review your request and re-submit the necessary details or
documentation.</p>
<p>Log In to Portal: {PORTAL_LINK_PLACEHOLDER}</p>
<p>For assistance, please contact your Relationship Manager or Support Team.</p>
<p>Best regards,<br>Team Supremus Angel</p>
"""
    _send([email], subject, message, doc=doc)


# ---------------------------------------------------------------------------
# Triggers 12-15 — MIP installment due reminders (daily scheduled task)
# ---------------------------------------------------------------------------
def _reminder_message(customer_name, amount, due_date, days_out):
    amount_str = fmt_money(amount, currency="INR")
    due_str = formatdate(due_date)
    if days_out == 0:
        body = (
            f"<p>Your MIP installment payment of {amount_str} is due today. Kindly complete the "
            f"payment to avoid any interruption in your investment cycle. Thank you.</p>"
        )
    elif days_out == 1:
        body = (
            f"<p>This is a reminder that your MIP payment of {amount_str} is due tomorrow "
            f"({due_str}). Please complete the payment to continue your investment plan smoothly.</p>"
        )
    elif days_out == 2:
        body = (
            f"<p>Your MIP installment of {amount_str} is due in 2 days on {due_str}. "
            f"Kindly ensure the payment is completed on time.</p>"
        )
    else:
        body = (
            f"<p>This is a reminder that your upcoming MIP installment of {amount_str} is due on "
            f"{due_str}. We request you to ensure timely payment for uninterrupted investment "
            f"processing.</p>"
        )
    return f"<p>Dear {customer_name},</p>\n{body}\n<p>Team Supremus Angel</p>"


def send_mip_due_reminders():
    """Daily: email investors whose next MIP installment is due in 5/2/1/0 days."""
    try:
        from customer_portal.customer_portal.api.cp_api import (
            _build_customer_mip_portal_context,
        )
    except Exception:
        frappe.log_error(frappe.get_traceback(), "SA MIP reminder: cp_api import failed")
        return

    today_date = getdate(today())
    customers = frappe.get_all(
        "Customer",
        filters={"custom_is_mip": 1, "disabled": 0},
        pluck="name",
    )

    for name in customers:
        try:
            customer = frappe.get_doc("Customer", name)
            email = customer.get("email_id")
            if not email:
                continue

            context = _build_customer_mip_portal_context(customer) or {}
            for plan in context.get("plans", []):
                for entry in plan.get("upcoming_entries", []) or []:
                    scheduled = entry.get("scheduled_date")
                    if not scheduled:
                        continue
                    days_out = (getdate(scheduled) - today_date).days
                    if days_out not in MIP_REMINDER_OFFSETS:
                        continue

                    subject = "Reminder: MIP Installment Payment Due"
                    message = _reminder_message(
                        customer.customer_name,
                        entry.get("amount") or 0,
                        scheduled,
                        days_out,
                    )
                    _send([email], subject, message)
        except Exception:
            frappe.log_error(frappe.get_traceback(), f"SA MIP reminder failed for {name}")
