# Copyright (c) 2026, Aniket Shinde and contributors
# For license information, please see license.txt
"""Endpoints behind the two RM Performance desk pages.

`rm-eod-desk` is what a reporting manager opens; `rm-daily-entry` is what an RM
uses to log the day. Everything a manager can read is filtered through
`scoping`, so the board, the drill-down and the Excel export always agree.
"""

from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import add_days, cint, cstr, get_last_day, getdate, today

from supremusangel.rm_performance import kpi_engine, scoping

FLAG_ORDER = {"Red": 0, "Orange": 1, "Green": 2}


# ---------------------------------------------------------------- manager board


@frappe.whitelist()
def get_eod_board(
	date: str | None = None,
	branch: str | None = None,
	flag: str | None = None,
	search: str | None = None,
):
	"""Roster for one day: every RM in scope with their flag and headline numbers."""
	date = str(getdate(date or today()))
	settings = kpi_engine.get_settings()

	roster = kpi_engine.get_rm_roster(settings, branch=branch)
	allowed = scoping.visible_employees()
	if allowed is not None:
		roster = [r for r in roster if r["name"] in allowed]

	if search:
		term = search.lower()
		roster = [r for r in roster if term in (r.get("employee_name") or "").lower()]

	scorecards = {}
	if roster:
		for row in frappe.get_all(
			"RM Daily Scorecard",
			filters={"employee": ["in", [r["name"] for r in roster]], "scorecard_date": date},
			fields="*",
			limit_page_length=0,
			ignore_permissions=True,
		):
			scorecards[row.employee] = row

	manager_names = _employee_name_map([r.get("reports_to") for r in roster])

	rows = []
	for member in roster:
		card = scorecards.get(member["name"])
		rows.append(
			{
				"employee": member["name"],
				"employee_name": member.get("employee_name"),
				"branch": member.get("branch"),
				"designation": member.get("designation"),
				"manager": manager_names.get(member.get("reports_to"), ""),
				"date_of_joining": member.get("date_of_joining"),
				"status": member.get("status"),
				"has_scorecard": bool(card),
				"flag": (card.flag if card else "Red"),
				"points_met": (card.points_met if card else 0),
				"total_points": (card.total_points if card else 8),
				"compliance_percent": (card.compliance_percent if card else 0),
				"prospects": (card.kpi1_actual if card else 0),
				"prospect_target": (card.kpi1_target if card else settings.kpi1_target),
				"attendance_status": (card.attendance_status if card else ""),
				"working_hours": (card.working_hours if card else 0),
				"pointers": _pointer_list(card) if card else [],
			}
		)

	if flag:
		rows = [r for r in rows if r["flag"] == flag]

	rows.sort(key=lambda r: (FLAG_ORDER.get(r["flag"], 0), -(r["compliance_percent"] or 0)))

	return {
		"date": date,
		"evaluation_mode": settings.evaluation_mode,
		"summary": {
			"total": len(rows),
			"green": sum(1 for r in rows if r["flag"] == "Green"),
			"orange": sum(1 for r in rows if r["flag"] == "Orange"),
			"red": sum(1 for r in rows if r["flag"] == "Red"),
			"not_logged": sum(1 for r in rows if not r["prospects"]),
		},
		"rows": rows,
	}


def _pointer(no, label, met, actual, target, unit, period, note="", subs=None) -> dict:
	"""One pointer row for the drill-down.

	`gap` is what the reader actually wants: not "5 required" but "1 more".
	"""
	gap = 0
	if isinstance(actual, int) and isinstance(target, int):
		gap = max(0, target - actual)
	return {
		"no": no,
		"label": label,
		"met": bool(met),
		"actual": actual,
		"target": target,
		"unit": unit,
		"period": period,
		"gap": gap,
		"note": note,
		"subs": subs or [],
	}


def _pointer_list(card) -> list[dict]:
	"""The eight pointers of one scorecard, in policy order."""
	left = _period_remaining(card.scorecard_date)
	month_note = _remaining_note(left["days_left_month"])
	week_note = _remaining_note(left["days_left_week"])

	kpi2_met = bool(card.kpi2a_met and card.kpi2b_met)
	kpi2_actual = (card.kpi2a_actual or 0) + (card.kpi2b_actual or 0)
	kpi2_target = (card.kpi2a_target or 0) + (card.kpi2b_target or 0)

	return [
		_pointer(
			"1", _("Daily Potential Client Count"), card.kpi1_met,
			card.kpi1_actual, card.kpi1_target, _("prospects"), _("Today"),
			_("Resets tomorrow"),
		),
		_pointer(
			"2", _("Client Meetings"), kpi2_met, kpi2_actual, kpi2_target,
			_("meetings"), _("This week + this month"), "",
			subs=[
				{
					"label": _("Self hosted"),
					"actual": card.kpi2a_actual,
					"target": card.kpi2a_target,
					"met": bool(card.kpi2a_met),
					"period": _("this week"),
					"gap": max(0, (card.kpi2a_target or 0) - (card.kpi2a_actual or 0)),
				},
				{
					"label": _("With support"),
					"actual": card.kpi2b_actual,
					"target": card.kpi2b_target,
					"met": bool(card.kpi2b_met),
					"period": _("this month"),
					"gap": max(0, (card.kpi2b_target or 0) - (card.kpi2b_actual or 0)),
				},
			],
		),
		_pointer(
			"3", _("Client Meetings at Office"), card.kpi3_met,
			card.kpi3_actual, card.kpi3_target, _("meetings"), _("This month"), month_note,
		),
		_pointer(
			"4", _("Monthly Seminar Participation"), card.kpi4_met,
			card.kpi4_actual, card.kpi4_target, _("attendees"), _("This month"), month_note,
		),
		_pointer(
			"5", _("Weekly Team Meetings"), card.kpi5_met,
			card.kpi5_actual, card.kpi5_target, _("attended"), _("This month"), month_note,
		),
		_pointer(
			"6", _("Team Expansion"), card.kpi6_met,
			card.kpi6_actual, card.kpi6_target, _("additions"), _("This month"), month_note,
		),
		_pointer(
			"7", _("Contribution to Office Activities"), card.kpi7_met,
			card.kpi7_rating or _("Not Rated"), _("Average or better"), "", _("This month"),
			_("Set by the reporting manager") if card.kpi7_rating != "Not Rated"
			else _("Manager has not rated this month yet"),
		),
		_pointer(
			"8", _("Initiatives & Ideas"), card.kpi8_met,
			card.kpi8_rating or _("Not Rated"), _("Average or better"), "", _("This month"),
			_("Set by the reporting manager") if card.kpi8_rating != "Not Rated"
			else _("Manager has not rated this month yet"),
		),
	]


def _period_remaining(date) -> dict:
	"""Working room left in the week and the month, as of this scorecard date."""
	day = getdate(date)
	month_end = get_last_day(day)
	week_end = add_days(day, 6 - day.weekday())
	return {
		"days_left_month": max(0, (month_end - day).days),
		"days_left_week": max(0, (week_end - day).days),
	}


def _remaining_note(days_left: int) -> str:
	if days_left <= 0:
		return _("Period closed")
	if days_left <= 3:
		return _("Only {0} day(s) left").format(days_left)
	return _("{0} days left").format(days_left)


@frappe.whitelist()
def get_rm_day(employee: str, date: str | None = None):
	"""Drill-down for one RM on one date: pointers plus the records behind them."""
	_ensure_can_view(employee)
	date = str(getdate(date or today()))

	name = f"RMSC-{employee}-{date}"
	card = (
		frappe.get_doc("RM Daily Scorecard", name)
		if frappe.db.exists("RM Daily Scorecard", name)
		else None
	)

	employee_doc = frappe.db.get_value(
		"Employee",
		employee,
		["name", "employee_name", "branch", "designation", "date_of_joining", "reports_to", "user_id", "image"],
		as_dict=True,
	)

	summary = None
	if card:
		summary = {
			"flag": card.flag,
			"points_met": card.points_met,
			"total_points": card.total_points,
			"compliance_percent": card.compliance_percent,
			"attendance_status": card.attendance_status or "",
			"first_checkin": card.first_checkin,
			"last_checkout": card.last_checkout,
			"working_hours": card.working_hours,
			"evaluation_mode": card.evaluation_mode,
			"missed": [p["no"] for p in _pointer_list(card) if not p["met"]],
		}

	return {
		"date": date,
		"employee": employee_doc,
		"scorecard": card.as_dict() if card else None,
		"summary": summary,
		"pointers": _pointer_list(card) if card else [],
		"activity": _day_activity(employee, date),
	}


def _day_activity(employee: str, date: str) -> dict:
	"""The raw records that produced the day's KPI 1, plus that day's meetings."""
	prospects = frappe.db.sql(
		"""
		SELECT c.parent AS lead, l.lead_name, c.channel, c.mode, c.outcome, c.remark
		FROM `tabLead Contact Log` c
		LEFT JOIN `tabLead` l ON l.name = c.parent
		WHERE c.rm = %(rm)s AND c.contact_date = %(date)s AND c.parenttype = 'Lead'
		ORDER BY c.idx
		""",
		{"rm": employee, "date": date},
		as_dict=True,
	)
	meetings = frappe.db.sql(
		"""
		SELECT name, subject, starts_on, status, custom_meeting_support, custom_venue_type
		FROM `tabEvent`
		WHERE event_category = 'Meeting' AND custom_rm = %(rm)s AND DATE(starts_on) = %(date)s
		ORDER BY starts_on
		""",
		{"rm": employee, "date": date},
		as_dict=True,
	)
	checkins = frappe.get_all(
		"Employee Checkin",
		filters={"employee": employee, "time": ["between", [f"{date} 00:00:00", f"{date} 23:59:59"]]},
		fields=["name", "time", "log_type", "latitude", "longitude"],
		order_by="time asc",
	)
	return {"prospects": prospects, "meetings": meetings, "checkins": checkins}


@frappe.whitelist()
def get_rm_trend(employee: str, days: int = 30):
	"""Flag history, newest last -- the trajectory view."""
	_ensure_can_view(employee)
	days = max(7, min(cint(days) or 30, 365))
	from_date = str(add_days(today(), -(days - 1)))

	rows = frappe.get_all(
		"RM Daily Scorecard",
		filters={"employee": employee, "scorecard_date": ["between", [from_date, today()]]},
		fields=["scorecard_date", "flag", "points_met", "total_points", "compliance_percent", "kpi1_actual"],
		order_by="scorecard_date asc",
		limit_page_length=0,
		ignore_permissions=True,
	)
	return {"employee": employee, "from_date": from_date, "to_date": today(), "rows": rows}


@frappe.whitelist()
def rebuild(date: str | None = None, employee: str | None = None):
	"""Recompute stored scorecards. HR / System Manager only."""
	if not scoping.has_full_access():
		frappe.throw(_("Only HR can rebuild scorecards."), frappe.PermissionError)

	date = str(getdate(date or today()))
	settings = kpi_engine.get_settings()

	if employee:
		row = frappe.db.get_value(
			"Employee",
			employee,
			["name", "employee_name", "branch", "reports_to", "designation", "user_id", "date_of_joining"],
			as_dict=True,
		)
		if not row:
			frappe.throw(_("Employee not found"))
		kpi_engine.build_scorecard(row, date, settings)
		frappe.db.commit()
		return {"built": 1, "date": date}

	return kpi_engine.build_for_date(date)


# ---------------------------------------------------------------- RM daily entry


@frappe.whitelist()
def get_my_context():
	"""Who the logged-in RM is, and what today looks like so far."""
	employee = _current_employee()
	if not employee:
		return {"employee": None}

	settings = kpi_engine.get_settings()
	logged = kpi_engine.count_prospects(employee.name, today(), settings)
	return {
		"employee": employee,
		"date": today(),
		"target": settings.kpi1_target,
		"logged": logged,
		"remaining": max(0, (settings.kpi1_target or 0) - logged),
		"entries": _todays_entries(employee.name),
	}


def _todays_entries(employee: str) -> list[dict]:
	return frappe.db.sql(
		"""
		SELECT c.name AS row_name, c.parent AS lead, l.lead_name, l.mobile_no,
		       c.channel, c.mode, c.outcome, c.remark, c.next_follow_up
		FROM `tabLead Contact Log` c
		LEFT JOIN `tabLead` l ON l.name = c.parent
		WHERE c.rm = %(rm)s AND c.contact_date = %(date)s AND c.parenttype = 'Lead'
		ORDER BY c.creation DESC
		""",
		{"rm": employee, "date": today()},
		as_dict=True,
	)


@frappe.whitelist()
def search_leads(query: str = "", limit: int = 10):
	"""Type-ahead for logging a contact against a Lead that already exists."""
	employee = _current_employee()
	if not employee:
		frappe.throw(_("No Employee record is linked to your user."))

	query = (query or "").strip()
	if len(query) < 2:
		return []

	like = f"%{query}%"
	return frappe.db.sql(
		"""
		SELECT name, lead_name, mobile_no, status, custom_telecalling_status
		FROM `tabLead`
		WHERE (lead_name LIKE %(like)s OR mobile_no LIKE %(like)s OR name LIKE %(like)s)
		ORDER BY modified DESC
		LIMIT %(limit)s
		""",
		{"like": like, "limit": cint(limit) or 10},
		as_dict=True,
	)


@frappe.whitelist()
def log_prospect(
	lead: str | None = None,
	lead_name: str | None = None,
	mobile_no: str | None = None,
	channel: str | None = None,
	mode: str | None = None,
	outcome: str | None = None,
	next_follow_up: str | None = None,
	remark: str | None = None,
	contact_date: str | None = None,
):
	"""Log one contact. Creates the Lead first when this is a brand-new prospect."""
	employee = _current_employee()
	if not employee:
		frappe.throw(_("No Employee record is linked to your user."))

	contact_date = str(getdate(contact_date or today()))
	if getdate(contact_date) > getdate(today()):
		frappe.throw(_("You cannot log a contact for a future date."))

	if lead:
		if not frappe.db.exists("Lead", lead):
			frappe.throw(_("Lead not found"))
		lead_doc = frappe.get_doc("Lead", lead)
	else:
		if not (lead_name or "").strip():
			frappe.throw(_("Enter a name for the prospect."))
		lead_doc = _create_lead(employee, lead_name, mobile_no)

	lead_doc.append(
		"custom_contact_log",
		{
			"contact_date": contact_date,
			"rm": employee.name,
			"channel": channel,
			"mode": mode,
			"outcome": outcome,
			"next_follow_up": next_follow_up or None,
			"remark": remark,
		},
	)
	lead_doc.flags.ignore_permissions = True
	lead_doc.save()

	# Keep today's card current so the RM sees the count move immediately.
	kpi_engine.build_scorecard(_employee_row(employee.name), contact_date)
	frappe.db.commit()

	return get_my_context()


def _create_lead(employee, lead_name: str, mobile_no: str | None):
	existing = None
	if mobile_no:
		existing = frappe.db.get_value("Lead", {"mobile_no": mobile_no.strip()}, "name")
	if existing:
		# Don't create a duplicate Lead just because the RM typed the name again.
		return frappe.get_doc("Lead", existing)

	doc = frappe.get_doc(
		{
			"doctype": "Lead",
			"lead_name": cstr(lead_name).strip(),
			"mobile_no": cstr(mobile_no).strip() or None,
			"custom_rm": employee.name,
			"custom_branch": employee.branch,
			"lead_owner": frappe.session.user,
			"status": "Lead",
		}
	)
	doc.flags.ignore_permissions = True
	doc.insert()
	return doc


@frappe.whitelist()
def delete_entry(row_name: str):
	"""Remove a contact row the RM logged by mistake, today only."""
	employee = _current_employee()
	if not employee:
		frappe.throw(_("No Employee record is linked to your user."))

	row = frappe.db.get_value(
		"Lead Contact Log", row_name, ["parent", "rm", "contact_date"], as_dict=True
	)
	if not row:
		frappe.throw(_("Entry not found"))
	if row.rm != employee.name and not scoping.has_full_access():
		frappe.throw(_("You can only remove your own entries."), frappe.PermissionError)
	if str(getdate(row.contact_date)) != today() and not scoping.has_full_access():
		frappe.throw(_("Only today's entries can be removed."))

	lead_doc = frappe.get_doc("Lead", row.parent)
	lead_doc.custom_contact_log = [r for r in lead_doc.custom_contact_log if r.name != row_name]
	lead_doc.flags.ignore_permissions = True
	lead_doc.save()

	kpi_engine.build_scorecard(_employee_row(employee.name), row.contact_date)
	frappe.db.commit()
	return get_my_context()


# ---------------------------------------------------------------- helpers


def _current_employee():
	return frappe.db.get_value(
		"Employee",
		{"user_id": frappe.session.user},
		["name", "employee_name", "branch", "designation", "date_of_joining", "image"],
		as_dict=True,
	)


def _employee_row(employee: str) -> dict:
	return frappe.db.get_value(
		"Employee",
		employee,
		["name", "employee_name", "branch", "reports_to", "designation", "user_id", "date_of_joining"],
		as_dict=True,
	)


def _ensure_can_view(employee: str):
	allowed = scoping.visible_employees()
	if allowed is not None and employee not in allowed:
		frappe.throw(_("You are not permitted to view this employee."), frappe.PermissionError)


def _employee_name_map(ids) -> dict:
	ids = [i for i in set(ids or []) if i]
	if not ids:
		return {}
	return dict(
		frappe.get_all(
			"Employee", filters={"name": ["in", ids]}, fields=["name", "employee_name"], as_list=True
		)
	)
