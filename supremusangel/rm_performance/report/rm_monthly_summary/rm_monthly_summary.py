# Copyright (c) 2026, Aniket Shinde and contributors
# For license information, please see license.txt
"""RM Monthly Summary -- one row per RM for a month.

The daily scorecard answers "what happened yesterday". This answers "is this
person improving", which is the question that actually belongs in a performance
review. Green / Orange / Red day counts sit next to the month-end position of
each pointer and the RM's tenure, so a new joiner's numbers are read in context.
"""

import frappe
from frappe import _
from frappe.utils import date_diff, get_first_day, get_last_day, getdate, today

from supremusangel.rm_performance import scoping


def execute(filters=None):
	filters = frappe._dict(filters or {})
	data = get_data(filters)
	return get_columns(), data, None, get_chart(data)


def get_columns():
	return [
		# Data rather than Link -- see the note in rm_eod_scorecard.get_columns.
		{"fieldname": "employee", "label": _("Employee"), "fieldtype": "Data", "width": 100},
		{"fieldname": "employee_name", "label": _("Name"), "fieldtype": "Data", "width": 175},
		{"fieldname": "branch", "label": _("Branch"), "fieldtype": "Data", "width": 130},
		{"fieldname": "manager_name", "label": _("Reporting Manager"), "fieldtype": "Data", "width": 150},
		{"fieldname": "tenure_days", "label": _("Days Since Joining"), "fieldtype": "Int", "width": 130},
		{"fieldname": "days_scored", "label": _("Days Scored"), "fieldtype": "Int", "width": 100},
		{"fieldname": "green_days", "label": _("Green"), "fieldtype": "Int", "width": 70},
		{"fieldname": "orange_days", "label": _("Orange"), "fieldtype": "Int", "width": 75},
		{"fieldname": "red_days", "label": _("Red"), "fieldtype": "Int", "width": 70},
		{"fieldname": "avg_compliance", "label": _("Avg Compliance %"), "fieldtype": "Percent", "width": 135},
		{"fieldname": "prospect_days_met", "label": _("Days 5+ Prospects"), "fieldtype": "Int", "width": 135},
		{"fieldname": "total_prospects", "label": _("Total Prospects"), "fieldtype": "Int", "width": 120},
		{"fieldname": "kpi2a_final", "label": _("Self Hosted"), "fieldtype": "Data", "width": 100},
		{"fieldname": "kpi2b_final", "label": _("With Support"), "fieldtype": "Data", "width": 105},
		{"fieldname": "kpi3_final", "label": _("Office Meetings"), "fieldtype": "Data", "width": 120},
		{"fieldname": "kpi4_final", "label": _("Seminar Attendees"), "fieldtype": "Data", "width": 135},
		{"fieldname": "kpi5_final", "label": _("Team Meetings"), "fieldtype": "Data", "width": 115},
		{"fieldname": "kpi6_final", "label": _("Team Expansion"), "fieldtype": "Data", "width": 120},
		{"fieldname": "kpi7_rating", "label": _("KPI 7"), "fieldtype": "Data", "width": 90},
		{"fieldname": "kpi8_rating", "label": _("KPI 8"), "fieldtype": "Data", "width": 90},
	]


def get_data(filters):
	month = filters.get("month") or today()
	from_date = str(get_first_day(getdate(month)))
	to_date = str(get_last_day(getdate(month)))

	conditions = {"scorecard_date": ["between", [from_date, to_date]]}
	for field in ("branch", "employee"):
		if filters.get(field):
			conditions[field] = filters[field]

	conditions = scoping.apply_employee_scope(conditions)
	if conditions is None:
		return []

	rows = frappe.get_all(
		"RM Daily Scorecard",
		filters=conditions,
		fields="*",
		order_by="employee asc, scorecard_date asc",
		limit_page_length=0,
		ignore_permissions=True,
	)
	if not rows:
		return []

	grouped: dict[str, list] = {}
	for row in rows:
		grouped.setdefault(row.employee, []).append(row)

	managers = _manager_name_map(rows)
	out = []
	for employee, days in grouped.items():
		last = days[-1]  # month-to-date counters peak on the final scored day
		joining = frappe.db.get_value("Employee", employee, "date_of_joining")
		out.append(
			{
				"employee": f'<a href="/app/employee/{frappe.utils.quoted(employee)}">{employee}</a>',
				"employee_name": last.employee_name,
				"branch": last.branch,
				"manager_name": managers.get(last.reports_to, ""),
				"tenure_days": date_diff(to_date, joining) if joining else 0,
				"days_scored": len(days),
				"green_days": sum(1 for d in days if d.flag == "Green"),
				"orange_days": sum(1 for d in days if d.flag == "Orange"),
				"red_days": sum(1 for d in days if d.flag == "Red"),
				"avg_compliance": round(
					sum(d.compliance_percent or 0 for d in days) / len(days), 2
				),
				"prospect_days_met": sum(1 for d in days if d.kpi1_met),
				"total_prospects": sum(d.kpi1_actual or 0 for d in days),
				"kpi2a_final": _final(last.kpi2a_actual, last.kpi2a_target),
				"kpi2b_final": _final(last.kpi2b_actual, last.kpi2b_target),
				"kpi3_final": _final(last.kpi3_actual, last.kpi3_target),
				"kpi4_final": _final(last.kpi4_actual, last.kpi4_target),
				"kpi5_final": _final(last.kpi5_actual, last.kpi5_target),
				"kpi6_final": _final(last.kpi6_actual, last.kpi6_target),
				"kpi7_rating": last.kpi7_rating or "Not Rated",
				"kpi8_rating": last.kpi8_rating or "Not Rated",
			}
		)

	out.sort(key=lambda r: (-r["avg_compliance"], r["employee_name"] or ""))
	return out


def _final(actual, target) -> str:
	mark = "✓" if (actual or 0) >= (target or 0) else "✗"
	return f"{mark} {actual or 0}/{target or 0}"


def _manager_name_map(rows) -> dict:
	ids = {r.reports_to for r in rows if r.reports_to}
	if not ids:
		return {}
	return dict(
		frappe.get_all(
			"Employee",
			filters={"name": ["in", list(ids)]},
			fields=["name", "employee_name"],
			as_list=True,
		)
	)


def get_chart(data):
	"""Ranked by average compliance -- the ordering a review meeting wants."""
	if not data:
		return None
	top = data[:15]
	return {
		"data": {
			"labels": [row["employee_name"] for row in top],
			"datasets": [{"name": _("Avg Compliance %"), "values": [row["avg_compliance"] for row in top]}],
		},
		"type": "bar",
		"colors": ["#4f5d75"],
	}
