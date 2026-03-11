# your_app/api/rm_activity.py
import frappe
from frappe import _


@frappe.whitelist()
def create_rm_event(
    activity_type,
    reference_doctype,
    reference_name,
    subject=None,
    starts_on=None,
    description=None,
    email=None
):
    """
    Create an Event for RM dashboard:
    - activity_type: 'Meeting', 'Call', 'Email'
    - reference_doctype: e.g. 'Lead' or 'Customer'
    - reference_name: the docname (e.g. CRM-LEAD-2026-00002)
    - subject: optional; default will be generated
    - starts_on: optional datetime string (YYYY-MM-DD HH:mm:ss); defaults now
    - description: optional HTML
    - email: optional participant email; if not given, tries from doc email field
    """

    activity_type = (activity_type or "").strip().title()
    if activity_type not in ("Meeting", "Call", "Email"):
        frappe.throw(_("Invalid activity type: {0}").format(activity_type))

    if not reference_doctype or not reference_name:
        frappe.throw(_("Reference DocType and name are required"))

    # Fetch reference doc to get default subject/email if needed
    ref_doc = frappe.get_doc(reference_doctype, reference_name)

    if not subject:
        subject = f"{activity_type} - {ref_doc.get('lead_name') or ref_doc.get('customer_name') or reference_name}"

    if not starts_on:
        # use now
        starts_on = frappe.utils.now()

    if not description:
        description = f'<div class="ql-editor read-mode"><p>{frappe.utils.escape_html(subject)}</p></div>'

    if not email:
        # try best-effort email fields
        email = ref_doc.get("email_id") or ref_doc.get("email") or frappe.session.user

    # Map activity_type -> Event fields
    event_category = "Meeting" if activity_type == "Meeting" else "Other"
    # we keep event_type simple
    event_type = "Private"

    event = frappe.get_doc({
        "doctype": "Event",
        "subject": subject,
        "event_category": event_category,
        "event_type": event_type,
        "status": "Open",
        "repeat_this_event": 0,
        "starts_on": starts_on,
        "all_day": 0,
        "sync_with_google_calendar": 0,
        "add_video_conferencing": 0,
        "pulled_from_google_calendar": 0,
        "send_reminder": 1,
        "description": description,
        "event_participants": [
            {
                "doctype": "Event Participants",
                "reference_doctype": reference_doctype,
                "reference_docname": reference_name,
                "email": email,
            }
        ],
        # You can also tag type in custom field if you have one, e.g. rm_activity_type
        # "rm_activity_type": activity_type
    })

    event.insert(ignore_permissions=True)
    frappe.db.commit()

    return {
        "name": event.name,
        "activity_type": activity_type,
        "subject": event.subject,
        "starts_on": event.starts_on,
    }
