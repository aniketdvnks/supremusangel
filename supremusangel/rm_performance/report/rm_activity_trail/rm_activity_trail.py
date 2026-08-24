# Copyright (c) 2026, Aniket Shinde and contributors
# For license information, please see license.txt
"""RM Activity Trail -- every activity one RM has recorded, since they joined.

This is the drill-down behind a flag. Where the scorecard says a pointer was
missed, this shows the underlying records -- or their absence -- in one
chronological feed, so a reporting manager can tell "did not do the work" apart
from "did not log the work" before acting on it.
"""

import frappe
from frappe import _
from frappe.utils import getdate, today

from supremusangel.rm_performance import scoping


def execute(filters=None):
	filters = frappe._dict(filters or {})
	if not filters.get("employee"):
		frappe.throw(_("Select an RM to see their activity trail."))

	allowed = scoping.visible_employees()
	if allowed is not None and filters.employee not in allowed:
		frappe.throw(_("You are not permitted to view this employee."), frappe.PermissionError)

	return get_columns(), get_data(filters)


def get_columns():
	return [
		{"fieldname": "activity_date", "label": _("Date"), "fieldtype": "Date", "width": 100},
		{"fieldname": "activity_time", "label": _("Time"), "fieldtype": "Data", "width": 75},
		{"fieldname": "kpi", "label": _("KPI"), "fieldtype": "Data", "width": 65},
		{"fieldname": "activity", "label": _("Activity"), "fieldtype": "Data", "width": 165},
		{"fieldname": "detail", "label": _("Detail"), "fieldtype": "Data", "width": 300},
		{"fieldname": "outcome", "label": _("Outcome / Status"), "fieldtype": "Data", "width": 140},
		# Data, not Link/Dynamic Link. A Link to DocType puts the whole report
		# through Frappe's User Permission matching against `tabDocType`, which
		# every non-System-Manager user is refused outright. Row security here is
		# the employee check in execute(); the anchors keep the records clickable.
		{"fieldname": "reference_type", "label": _("Type"), "fieldtype": "Data", "width": 130},
		{"fieldname": "reference", "label": _("Reference"), "fieldtype": "Data", "width": 190},
	]


def date_window(filters, employee: str) -> tuple[str, str]:
	"""Defaults to the RM's whole tenure -- the report is about trajectory."""
	joining = frappe.db.get_value("Employee", employee, "date_of_joining")
	from_date = filters.get("from_date") or joining or "2000-01-01"
	to_date = filters.get("to_date") or today()
	return str(getdate(from_date)), str(getdate(to_date))


def get_data(filters):
	employee = filters.employee
	from_date, to_date = date_window(filters, employee)
	user_id = frappe.db.get_value("Employee", employee, "user_id")

	rows = []
	rows += _prospects(employee, from_date, to_date)
	rows += _meetings(employee, from_date, to_date)
	rows += _seminars(employee, from_date, to_date)
	rows += _team_meetings(employee, user_id, from_date, to_date)
	rows += _expansion(employee, from_date, to_date)
	rows += _ratings(employee, from_date, to_date)
	if filters.get("include_attendance"):
		rows += _attendance(employee, from_date, to_date)

	if filters.get("kpi"):
		rows = [r for r in rows if r["kpi"] == filters.kpi]

	rows.sort(key=lambda r: (str(r["activity_date"]), r.get("activity_time") or ""), reverse=True)
	for row in rows:
		row["reference"] = _doc_link(row.pop("reference_type", None), row.pop("reference_name", None))
		row["reference_type"] = row.get("_type", "")
	return rows


def _doc_link(doctype: str | None, name: str | None) -> str:
	if not (doctype and name):
		return ""
	route = doctype.lower().replace(" ", "-")
	label = frappe.utils.escape_html(str(name))
	return f'<a href="/app/{route}/{frappe.utils.quoted(name)}">{label}</a>'


def _prospects(employee, from_date, to_date):
	logs = frappe.db.sql(
		"""
		SELECT c.parent, c.contact_date, c.channel, c.mode, c.outcome, c.remark, l.lead_name
		FROM `tabLead Contact Log` c
		LEFT JOIN `tabLead` l ON l.name = c.parent
		WHERE c.rm = %(rm)s AND c.parenttype = 'Lead'
		  AND c.contact_date BETWEEN %(from_date)s AND %(to_date)s
		ORDER BY c.contact_date DESC
		""",
		{"rm": employee, "from_date": from_date, "to_date": to_date},
		as_dict=True,
	)
	return [
		{
			"activity_date": row.contact_date,
			"activity_time": "",
			"kpi": "1",
			"activity": "Prospect Contact",
			"detail": " · ".join(filter(None, [row.lead_name or row.parent, row.channel, row.mode])),
			"outcome": row.outcome or "",
			"reference_type": "Lead", "_type": "Lead",
			"reference_name": row.parent,
		}
		for row in logs
	]


def _meetings(employee, from_date, to_date):
	events = frappe.db.sql(
		"""
		SELECT name, subject, starts_on, status, custom_meeting_support,
		       custom_venue_type, custom_event_mode, custom_location_address
		FROM `tabEvent`
		WHERE event_category = 'Meeting' AND custom_rm = %(rm)s
		  AND DATE(starts_on) BETWEEN %(from_date)s AND %(to_date)s
		ORDER BY starts_on DESC
		""",
		{"rm": employee, "from_date": from_date, "to_date": to_date},
		as_dict=True,
	)
	out = []
	for row in events:
		kpi = "3" if row.custom_venue_type == "Office" else "2"
		detail = " · ".join(
			filter(
				None,
				[
					row.subject,
					row.custom_meeting_support,
					row.custom_venue_type or row.custom_event_mode,
				],
			)
		)
		out.append(
			{
				"activity_date": getdate(row.starts_on),
				"activity_time": str(row.starts_on)[11:16] if row.starts_on else "",
				"kpi": kpi,
				"activity": "Client Meeting",
				"detail": detail,
				"outcome": row.status or "",
				"reference_type": "Event", "_type": "Event",
				"reference_name": row.name,
			}
		)
	return out


def _seminars(employee, from_date, to_date):
	if not frappe.db.table_exists("Event Booking"):
		return []
	bookings = frappe.db.sql(
		"""
		SELECT b.name, b.event, b.creation, b.status, COUNT(a.name) AS attendees
		FROM `tabEvent Booking` b
		LEFT JOIN `tabEvent Booking Attendee` a ON a.parent = b.name
		WHERE b.custom_credited_rm = %(rm)s
		  AND DATE(b.creation) BETWEEN %(from_date)s AND %(to_date)s
		GROUP BY b.name, b.event, b.creation, b.status
		ORDER BY b.creation DESC
		""",
		{"rm": employee, "from_date": from_date, "to_date": to_date},
		as_dict=True,
	)
	return [
		{
			"activity_date": getdate(row.creation),
			"activity_time": str(row.creation)[11:16],
			"kpi": "4",
			"activity": "Seminar Booking",
			"detail": f"{row.event} — {row.attendees} attendee(s)",
			"outcome": row.status or "",
			"reference_type": "Event Booking", "_type": "Event Booking",
			"reference_name": row.name,
		}
		for row in bookings
	]


def _team_meetings(employee, user_id, from_date, to_date):
	if not frappe.db.table_exists("Scope Meeting"):
		return []
	meetings = frappe.db.sql(
		"""
		SELECT m.name, m.title, m.meeting_start_time, a.attendance
		FROM `tabScope Meeting` m
		INNER JOIN `tabScope Meeting Attendee` a ON a.parent = m.name
		WHERE m.category_type = 'Team Meeting'
		  AND ((a.party_type = 'Employee' AND a.party = %(employee)s)
		       OR (%(user_id)s IS NOT NULL AND a.user = %(user_id)s))
		  AND DATE(m.meeting_start_time) BETWEEN %(from_date)s AND %(to_date)s
		ORDER BY m.meeting_start_time DESC
		""",
		{"employee": employee, "user_id": user_id or None, "from_date": from_date, "to_date": to_date},
		as_dict=True,
	)
	return [
		{
			"activity_date": getdate(row.meeting_start_time),
			"activity_time": str(row.meeting_start_time)[11:16] if row.meeting_start_time else "",
			"kpi": "5",
			"activity": "Team Meeting",
			"detail": row.title or row.name,
			"outcome": row.attendance or "Not Marked",
			"reference_type": "Scope Meeting", "_type": "Scope Meeting",
			"reference_name": row.name,
		}
		for row in meetings
	]


def _expansion(employee, from_date, to_date):
	out = []
	applicants = frappe.db.sql(
		"""
		SELECT name, applicant_name, status, creation
		FROM `tabJob Applicant`
		WHERE custom_referred_by_rm = %(rm)s
		  AND DATE(creation) BETWEEN %(from_date)s AND %(to_date)s
		""",
		{"rm": employee, "from_date": from_date, "to_date": to_date},
		as_dict=True,
	)
	out += [
		{
			"activity_date": getdate(row.creation),
			"activity_time": str(row.creation)[11:16],
			"kpi": "6",
			"activity": "Recruitment Referral",
			"detail": row.applicant_name or row.name,
			"outcome": row.status or "",
			"reference_type": "Job Applicant", "_type": "Job Applicant",
			"reference_name": row.name,
		}
		for row in applicants
	]

	own = frappe.db.get_value("Sales Person", {"employee": employee}, "name")
	if own:
		agents = frappe.db.sql(
			"""
			SELECT name, sales_person_name, creation
			FROM `tabSales Person`
			WHERE parent_sales_person = %(parent)s
			  AND DATE(creation) BETWEEN %(from_date)s AND %(to_date)s
			""",
			{"parent": own, "from_date": from_date, "to_date": to_date},
			as_dict=True,
		)
		out += [
			{
				"activity_date": getdate(row.creation),
				"activity_time": str(row.creation)[11:16],
				"kpi": "6",
				"activity": "Agent Added",
				"detail": row.sales_person_name or row.name,
				"outcome": "Active",
				"reference_type": "Sales Person", "_type": "Sales Person",
				"reference_name": row.name,
			}
			for row in agents
		]
	return out


def _ratings(employee, from_date, to_date):
	ratings = frappe.get_all(
		"RM Monthly Rating",
		filters={"employee": employee},
		fields=["name", "month_key", "kpi7_rating", "kpi8_rating", "manager_remark", "rated_on"],
	)
	out = []
	for row in ratings:
		try:
			year, month = row.month_key.split("-")
			activity_date = getdate(f"{year}-{month}-01")
		except (ValueError, AttributeError):
			continue
		if not (getdate(from_date) <= activity_date <= getdate(to_date)):
			continue
		out.append(
			{
				"activity_date": activity_date,
				"activity_time": "",
				"kpi": "7·8",
				"activity": "Manager Rating",
				"detail": (row.manager_remark or "")[:160],
				"outcome": f"7: {row.kpi7_rating} · 8: {row.kpi8_rating}",
				"reference_type": "RM Monthly Rating", "_type": "RM Monthly Rating",
				"reference_name": row.name,
			}
		)
	return out


def _attendance(employee, from_date, to_date):
	records = frappe.get_all(
		"Attendance",
		filters={
			"employee": employee,
			"docstatus": 1,
			"attendance_date": ["between", [from_date, to_date]],
		},
		fields=["name", "attendance_date", "status", "working_hours"],
	)
	return [
		{
			"activity_date": row.attendance_date,
			"activity_time": "",
			"kpi": "—",
			"activity": "Attendance",
			"detail": f"{row.working_hours or 0} hours",
			"outcome": row.status or "",
			"reference_type": "Attendance", "_type": "Attendance",
			"reference_name": row.name,
		}
		for row in records
	]
