# Copyright (c) 2026, Aniket Shinde and contributors
# For license information, please see license.txt
"""RM EOD Scorecard -- the report Sushmitha exports to Excel.

One row per RM per day: the eight pointers with actual against target, the
points met, and the flag. Scoped so a reporting manager sees only their own
tree while HR sees every branch.
"""

import frappe
from frappe import _
from frappe.utils import add_days, getdate, today

from supremusangel.rm_performance import scoping

FLAG_INDICATOR = {"Green": "green", "Orange": "orange", "Red": "red"}


def execute(filters=None):
	filters = frappe._dict(filters or {})
	data = get_data(filters)
	return get_columns(), data, None, get_chart(data), get_summary(data)


def get_columns():
	return [
		{"fieldname": "scorecard_date", "label": _("Date"), "fieldtype": "Date", "width": 95},
		# Deliberately Data, not Link. A Link column here would put every row
		# through Frappe's User Permission matching, and on this site HR and all
		# five RM managers carry an "Employee = <themselves>" user permission --
		# which would collapse the report to a single row for exactly the people
		# it is built for. Row security is enforced once, in rm_performance.scoping.
		# The anchor keeps the record one click away.
		{"fieldname": "employee", "label": _("Employee"), "fieldtype": "Data", "width": 100},
		{"fieldname": "employee_name", "label": _("Name"), "fieldtype": "Data", "width": 170},
		{"fieldname": "branch", "label": _("Branch"), "fieldtype": "Data", "width": 130},
		{"fieldname": "manager_name", "label": _("Reporting Manager"), "fieldtype": "Data", "width": 150},
		{"fieldname": "flag", "label": _("Flag"), "fieldtype": "Data", "width": 80},
		{"fieldname": "points_met", "label": _("Points"), "fieldtype": "Data", "width": 70},
		{"fieldname": "compliance_percent", "label": _("Compliance %"), "fieldtype": "Percent", "width": 110},
		{"fieldname": "kpi1", "label": _("1. Prospects/Day"), "fieldtype": "Data", "width": 120},
		{"fieldname": "kpi2", "label": _("2. Client Meetings"), "fieldtype": "Data", "width": 135},
		{"fieldname": "kpi3", "label": _("3. Office Meetings"), "fieldtype": "Data", "width": 125},
		{"fieldname": "kpi4", "label": _("4. Seminar Attendees"), "fieldtype": "Data", "width": 140},
		{"fieldname": "kpi5", "label": _("5. Team Meetings"), "fieldtype": "Data", "width": 125},
		{"fieldname": "kpi6", "label": _("6. Team Expansion"), "fieldtype": "Data", "width": 130},
		{"fieldname": "kpi7", "label": _("7. Office Activities"), "fieldtype": "Data", "width": 125},
		{"fieldname": "kpi8", "label": _("8. Initiatives"), "fieldtype": "Data", "width": 115},
		{"fieldname": "attendance_status", "label": _("Attendance"), "fieldtype": "Data", "width": 100},
		{"fieldname": "working_hours", "label": _("Hours"), "fieldtype": "Float", "width": 70},
	]


def get_conditions(filters) -> dict | None:
	conditions = {}

	from_date = filters.get("from_date") or add_days(today(), -6)
	to_date = filters.get("to_date") or today()
	conditions["scorecard_date"] = ["between", [str(getdate(from_date)), str(getdate(to_date))]]

	for field in ("branch", "flag", "employee"):
		if filters.get(field):
			conditions[field] = filters[field]

	if filters.get("reports_to"):
		conditions["reports_to"] = filters["reports_to"]

	return scoping.apply_employee_scope(conditions)


def get_data(filters):
	conditions = get_conditions(filters)
	if conditions is None:
		return []

	rows = frappe.get_all(
		"RM Daily Scorecard",
		filters=conditions,
		fields="*",
		order_by="scorecard_date desc, employee_name asc",
		limit_page_length=0,
		ignore_permissions=True,
	)

	manager_names = _manager_name_map(rows)
	out = []
	for row in rows:
		out.append(
			{
				"scorecard_date": row.scorecard_date,
				"employee": _employee_link(row.employee),
				"employee_name": row.employee_name,
				"branch": row.branch,
				"manager_name": manager_names.get(row.reports_to, ""),
				"flag": _flag_label(row.flag),
				"points_met": f"{row.points_met} / {row.total_points}",
				"compliance_percent": row.compliance_percent,
				"kpi1": _pair(row.kpi1_met, row.kpi1_actual, row.kpi1_target),
				"kpi2": _kpi2(row),
				"kpi3": _pair(row.kpi3_met, row.kpi3_actual, row.kpi3_target),
				"kpi4": _pair(row.kpi4_met, row.kpi4_actual, row.kpi4_target),
				"kpi5": _pair(row.kpi5_met, row.kpi5_actual, row.kpi5_target),
				"kpi6": _pair(row.kpi6_met, row.kpi6_actual, row.kpi6_target),
				"kpi7": _rated(row.kpi7_met, row.kpi7_rating),
				"kpi8": _rated(row.kpi8_met, row.kpi8_rating),
				"attendance_status": row.attendance_status,
				"working_hours": row.working_hours,
				"_flag": row.flag,
			}
		)
	return out



def _employee_link(employee: str) -> str:
	if not employee:
		return ""
	return f'<a href="/app/employee/{frappe.utils.quoted(employee)}">{employee}</a>'


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


def _flag_label(flag: str) -> str:
	return f"""<span class="indicator-pill {FLAG_INDICATOR.get(flag, 'gray')}">{flag or '-'}</span>"""


def _pair(met, actual, target) -> str:
	mark = "✓" if met else "✗"
	return f"{mark} {actual or 0} / {target or 0}"


def _kpi2(row) -> str:
	"""KPI 2 carries two sub-targets but scores as one pointer."""
	mark = "✓" if (row.kpi2a_met and row.kpi2b_met) else "✗"
	return (
		f"{mark} self {row.kpi2a_actual or 0}/{row.kpi2a_target or 0} · "
		f"sup {row.kpi2b_actual or 0}/{row.kpi2b_target or 0}"
	)


def _rated(met, rating) -> str:
	mark = "✓" if met else "✗"
	return f"{mark} {rating or 'Not Rated'}"


def get_chart(data):
	"""Which of the eight pointers is failing most across everyone in view."""
	if not data:
		return None
	labels = [
		"1 Prospects",
		"2 Meetings",
		"3 Office",
		"4 Seminar",
		"5 Team",
		"6 Expansion",
		"7 Activities",
		"8 Initiatives",
	]
	keys = ["kpi1", "kpi2", "kpi3", "kpi4", "kpi5", "kpi6", "kpi7", "kpi8"]
	met = [sum(1 for row in data if str(row.get(k, "")).startswith("✓")) for k in keys]
	missed = [len(data) - value for value in met]
	return {
		"data": {
			"labels": labels,
			"datasets": [
				{"name": _("Met"), "values": met},
				{"name": _("Missed"), "values": missed},
			],
		},
		"type": "bar",
		"barOptions": {"stacked": 1},
		"colors": ["#28a745", "#e24c4c"],
	}


def get_summary(data):
	if not data:
		return []
	counts = {"Green": 0, "Orange": 0, "Red": 0}
	for row in data:
		if row.get("_flag") in counts:
			counts[row["_flag"]] += 1
	return [
		{"label": _("Rows"), "value": len(data), "indicator": "Blue", "datatype": "Int"},
		{"label": _("Green"), "value": counts["Green"], "indicator": "Green", "datatype": "Int"},
		{"label": _("Orange"), "value": counts["Orange"], "indicator": "Orange", "datatype": "Int"},
		{"label": _("Red"), "value": counts["Red"], "indicator": "Red", "datatype": "Int"},
	]
