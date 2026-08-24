# Copyright (c) 2026, Aniket Shinde and contributors
# For license information, please see license.txt
"""Keep the legacy Lead call fields in step with the new contact log.

`custom_last_call_date`, `custom_call_outcome` and `custom_telecalling_status`
predate the contact log and are still read by the telecalling desk and the
Telecalling reports. They hold only the latest call, which is exactly why the
scorecard cannot use them -- but nothing downstream should break, so the newest
log row is mirrored back onto them.
"""

import frappe
from frappe.utils import getdate

#: Contact-log outcomes that map cleanly onto the older telecalling status.
OUTCOME_TO_STATUS = {
	"Interested": "Interested",
	"Not Interested": "Not Interested",
	"DND": "DND",
	"Connected": "Open",
	"Not Picked": "Open",
	"Wrong Number": "Cancelled",
}


def sync_contact_log(doc, method=None):
	rows = [r for r in (doc.get("custom_contact_log") or []) if r.contact_date]
	if not rows:
		return

	latest = max(rows, key=lambda r: (getdate(r.contact_date), r.idx or 0))
	doc.custom_last_call_date = latest.contact_date

	if latest.next_follow_up:
		doc.custom_next_follow_up_date = latest.next_follow_up

	status = OUTCOME_TO_STATUS.get(latest.outcome)
	if status and _has_option(doc, "custom_telecalling_status", status):
		doc.custom_telecalling_status = status

	# Default the Lead's RM from whoever has been working it, without
	# overriding an RM someone set deliberately.
	if not doc.get("custom_rm") and latest.rm:
		doc.custom_rm = latest.rm


def _has_option(doc, fieldname: str, value: str) -> bool:
	field = doc.meta.get_field(fieldname)
	return bool(field) and value in (field.options or "").split("\n")
