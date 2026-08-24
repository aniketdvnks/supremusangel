# Copyright (c) 2026, Aniket Shinde and contributors
# For license information, please see license.txt
"""Scoring engine for the RM EOD scorecard.

Turns the eight WRM minimum-performance standards into numbers that can be
counted from live records. Nothing here duplicates source data -- every KPI is
recomputed from the originating doctype, so a corrected Lead or a cancelled
meeting is reflected the next time the scorecard is built.

Only KPI 1 is genuinely daily. KPIs 2-6 are weekly or monthly targets, so on any
given day they report *pace to date* within the period the policy names. KPIs 7
and 8 are deliberately subjective and are carried from the reporting manager's
`RM Monthly Rating` for that month -- they are never inferred.
"""

from __future__ import annotations

import frappe
from frappe.utils import add_days, flt, get_first_day, getdate, now_datetime

SETTINGS_DT = "RM KPI Settings"
SCORECARD_DT = "RM Daily Scorecard"
RATING_DT = "RM Monthly Rating"

#: Outcomes that mean a conversation actually took place.
CONNECTED_OUTCOMES = ("Connected", "Interested", "Not Interested")

#: Every pointer that contributes one point to the flag, in policy order.
POINT_KEYS = ("kpi1", "kpi2", "kpi3", "kpi4", "kpi5", "kpi6", "kpi7", "kpi8")


# ---------------------------------------------------------------- settings


def get_settings():
	return frappe.get_cached_doc(SETTINGS_DT)


def rm_designations(settings=None) -> list[str]:
	settings = settings or get_settings()
	raw = settings.rm_designation or "Wealth Relationship Manager"
	return [d.strip() for d in raw.split(",") if d.strip()]


def get_rm_roster(settings=None, branch: str | None = None) -> list[dict]:
	"""Every Employee the scorecard applies to."""
	settings = settings or get_settings()
	filters = {"designation": ["in", rm_designations(settings)]}
	if not settings.include_left_employees:
		filters["status"] = "Active"
	if branch:
		filters["branch"] = branch
	return frappe.get_all(
		"Employee",
		filters=filters,
		fields=[
			"name",
			"employee_name",
			"branch",
			"reports_to",
			"designation",
			"user_id",
			"date_of_joining",
			"status",
		],
		order_by="employee_name asc",
	)


# ---------------------------------------------------------------- periods


def week_start(date) -> str:
	"""Monday of the week the date falls in."""
	d = getdate(date)
	return str(add_days(d, -d.weekday()))


def month_start(date) -> str:
	return str(get_first_day(getdate(date)))


def month_key(date) -> str:
	d = getdate(date)
	return f"{d.year:04d}-{d.month:02d}"


# ---------------------------------------------------------------- counters
# Each counter answers one question for one employee over one window. They are
# deliberately independent so a KPI can be re-scoped without touching the rest.


def count_prospects(employee: str, date, settings) -> int:
	"""KPI 1 -- distinct Leads this RM made contact with on this date.

	Distinct on the Lead, not on the log row: five calls to the same person is
	one prospect, not five.
	"""
	conditions = "rm = %(rm)s AND contact_date = %(date)s AND parenttype = 'Lead'"
	params = {"rm": employee, "date": str(getdate(date))}
	if settings.kpi1_count_mode == "Connected Only":
		conditions += " AND outcome IN %(outcomes)s"
		params["outcomes"] = CONNECTED_OUTCOMES
	return frappe.db.sql(
		f"SELECT COUNT(DISTINCT parent) FROM `tabLead Contact Log` WHERE {conditions}",
		params,
	)[0][0] or 0


def _count_meetings(employee: str, from_date, to_date, extra_conditions: str, params: dict) -> int:
	params = {
		**params,
		"rm": employee,
		"from_date": str(getdate(from_date)),
		"to_date": str(getdate(to_date)),
	}
	return frappe.db.sql(
		f"""
		SELECT COUNT(*) FROM `tabEvent`
		WHERE event_category = 'Meeting'
		  AND custom_rm = %(rm)s
		  AND status != 'Cancelled'
		  AND DATE(starts_on) BETWEEN %(from_date)s AND %(to_date)s
		  {extra_conditions}
		""",
		params,
	)[0][0] or 0


def count_self_hosted_meetings(employee: str, date) -> int:
	"""KPI 2a -- self-hosted client meetings, week to date."""
	return _count_meetings(
		employee, week_start(date), date, "AND custom_meeting_support = 'Self Hosted'", {}
	)


def count_supported_meetings(employee: str, date) -> int:
	"""KPI 2b -- client meetings run with senior support, month to date."""
	return _count_meetings(
		employee, month_start(date), date, "AND custom_meeting_support = 'With Support'", {}
	)


def count_office_meetings(employee: str, date) -> int:
	"""KPI 3 -- client meetings held at the office, month to date."""
	return _count_meetings(
		employee, month_start(date), date, "AND custom_venue_type = 'Office'", {}
	)


def count_seminar_attendees(employee: str, date) -> int:
	"""KPI 4 -- attendees this RM brought to company seminars, month to date.

	Counts attendee rows, not bookings: one booking that brings four people is
	four attendees against the target of seven.
	"""
	if not frappe.db.table_exists("Event Booking"):
		return 0
	return frappe.db.sql(
		"""
		SELECT COUNT(a.name)
		FROM `tabEvent Booking Attendee` a
		INNER JOIN `tabEvent Booking` b ON b.name = a.parent
		WHERE b.custom_credited_rm = %(rm)s
		  AND b.docstatus < 2
		  AND DATE(b.creation) BETWEEN %(from_date)s AND %(to_date)s
		""",
		{"rm": employee, "from_date": month_start(date), "to_date": str(getdate(date))},
	)[0][0] or 0


def count_team_meetings(employee: str, user_id: str | None, date) -> int:
	"""KPI 5 -- team meetings this RM was actually present at, month to date."""
	if not frappe.db.table_exists("Scope Meeting"):
		return 0
	return frappe.db.sql(
		"""
		SELECT COUNT(DISTINCT m.name)
		FROM `tabScope Meeting` m
		INNER JOIN `tabScope Meeting Attendee` a ON a.parent = m.name
		WHERE m.category_type = 'Team Meeting'
		  AND m.status != 'Cancelled'
		  AND a.attendance = 'Present'
		  AND (
		        (a.party_type = 'Employee' AND a.party = %(employee)s)
		     OR (%(user_id)s IS NOT NULL AND a.user = %(user_id)s)
		  )
		  AND DATE(m.meeting_start_time) BETWEEN %(from_date)s AND %(to_date)s
		""",
		{
			"employee": employee,
			"user_id": user_id or None,
			"from_date": month_start(date),
			"to_date": str(getdate(date)),
		},
	)[0][0] or 0


def count_team_additions(employee: str, date) -> int:
	"""KPI 6 -- people this RM brought into the org, month to date.

	Two routes count, matching the policy wording "Agent/Recruitment":
	a Job Applicant they referred, or a Sales Person opened beneath them.
	"""
	from_date, to_date = month_start(date), str(getdate(date))
	total = frappe.db.sql(
		"""
		SELECT COUNT(*) FROM `tabJob Applicant`
		WHERE custom_referred_by_rm = %(rm)s
		  AND DATE(creation) BETWEEN %(from_date)s AND %(to_date)s
		""",
		{"rm": employee, "from_date": from_date, "to_date": to_date},
	)[0][0] or 0

	own_sales_person = frappe.db.get_value("Sales Person", {"employee": employee}, "name")
	if own_sales_person:
		total += frappe.db.sql(
			"""
			SELECT COUNT(*) FROM `tabSales Person`
			WHERE parent_sales_person = %(parent)s
			  AND DATE(creation) BETWEEN %(from_date)s AND %(to_date)s
			""",
			{"parent": own_sales_person, "from_date": from_date, "to_date": to_date},
		)[0][0] or 0
	return total


def get_monthly_rating(employee: str, date) -> dict:
	"""KPI 7 and 8 -- carried from the manager's rating, never inferred."""
	name = frappe.db.get_value(
		RATING_DT, {"employee": employee, "month_key": month_key(date)}, "name"
	)
	if not name:
		return {}
	return (
		frappe.db.get_value(
			RATING_DT,
			name,
			["name", "kpi7_met", "kpi7_rating", "kpi8_met", "kpi8_rating"],
			as_dict=True,
		)
		or {}
	)


def get_attendance(employee: str, date) -> dict:
	"""First check-in, last check-out and hours for the day."""
	out = {
		"attendance_status": "",
		"first_checkin": None,
		"last_checkout": None,
		"working_hours": 0.0,
	}
	day = str(getdate(date))

	status = frappe.db.get_value(
		"Attendance",
		{"employee": employee, "attendance_date": day, "docstatus": 1},
		["status", "working_hours"],
		as_dict=True,
	)
	if status:
		out["attendance_status"] = status.status or ""
		out["working_hours"] = flt(status.working_hours)

	rows = frappe.db.sql(
		"""
		SELECT log_type, MIN(time) AS first_time, MAX(time) AS last_time
		FROM `tabEmployee Checkin`
		WHERE employee = %(employee)s AND DATE(time) = %(day)s
		GROUP BY log_type
		""",
		{"employee": employee, "day": day},
		as_dict=True,
	)
	for row in rows:
		if row.log_type == "IN":
			out["first_checkin"] = row.first_time
		elif row.log_type == "OUT":
			out["last_checkout"] = row.last_time
	# Fall back to raw check-ins when no log_type is recorded by the device.
	if not out["first_checkin"] and not out["last_checkout"]:
		bounds = frappe.db.sql(
			"""
			SELECT MIN(time) AS first_time, MAX(time) AS last_time
			FROM `tabEmployee Checkin`
			WHERE employee = %(employee)s AND DATE(time) = %(day)s
			""",
			{"employee": employee, "day": day},
			as_dict=True,
		)
		if bounds and bounds[0].first_time:
			out["first_checkin"] = bounds[0].first_time
			out["last_checkout"] = bounds[0].last_time
	return out


# ---------------------------------------------------------------- scoring


def compute(employee_row: dict, date, settings=None) -> dict:
	"""Compute -- but do not save -- one RM's scorecard for one date."""
	settings = settings or get_settings()
	employee = employee_row["name"]
	date = getdate(date)

	result = {
		"employee": employee,
		"employee_name": employee_row.get("employee_name"),
		"scorecard_date": str(date),
		"branch": employee_row.get("branch"),
		"reports_to": employee_row.get("reports_to"),
		"designation": employee_row.get("designation"),
		"date_of_joining": employee_row.get("date_of_joining"),
		"evaluation_mode": settings.evaluation_mode,
		"kpi1_period": "Daily",
		"kpi2a_period": "Week to date",
		"kpi2b_period": "Month to date",
		"kpi3_period": "Month to date",
		"kpi4_period": "Month to date",
		"kpi5_period": "Month to date",
		"kpi6_period": "Month to date",
	}

	# --- KPI 1
	result["kpi1_target"] = settings.kpi1_target
	result["kpi1_actual"] = count_prospects(employee, date, settings)
	result["kpi1_met"] = int(result["kpi1_actual"] >= settings.kpi1_target)

	# --- KPI 2 (two sub-targets, one point)
	result["kpi2a_target"] = settings.kpi2_self_hosted_target
	result["kpi2a_actual"] = count_self_hosted_meetings(employee, date)
	result["kpi2a_met"] = int(result["kpi2a_actual"] >= settings.kpi2_self_hosted_target)
	result["kpi2b_target"] = settings.kpi2_with_support_target
	result["kpi2b_actual"] = count_supported_meetings(employee, date)
	result["kpi2b_met"] = int(result["kpi2b_actual"] >= settings.kpi2_with_support_target)

	# --- KPI 3
	result["kpi3_target"] = settings.kpi3_target
	result["kpi3_actual"] = count_office_meetings(employee, date)
	result["kpi3_met"] = int(result["kpi3_actual"] >= settings.kpi3_target)

	# --- KPI 4
	result["kpi4_target"] = settings.kpi4_target
	result["kpi4_actual"] = count_seminar_attendees(employee, date)
	result["kpi4_met"] = int(result["kpi4_actual"] >= settings.kpi4_target)

	# --- KPI 5
	result["kpi5_target"] = settings.kpi5_target
	result["kpi5_actual"] = count_team_meetings(employee, employee_row.get("user_id"), date)
	result["kpi5_met"] = int(result["kpi5_actual"] >= settings.kpi5_target)

	# --- KPI 6
	result["kpi6_target"] = settings.kpi6_target
	result["kpi6_actual"] = count_team_additions(employee, date)
	result["kpi6_met"] = int(result["kpi6_actual"] >= settings.kpi6_target)

	# --- KPI 7 & 8
	rating = get_monthly_rating(employee, date)
	result["monthly_rating"] = rating.get("name")
	result["kpi7_met"] = int(rating.get("kpi7_met") or 0)
	result["kpi7_rating"] = rating.get("kpi7_rating") or "Not Rated"
	result["kpi8_met"] = int(rating.get("kpi8_met") or 0)
	result["kpi8_rating"] = rating.get("kpi8_rating") or "Not Rated"

	# --- attendance
	result.update(get_attendance(employee, date))

	# --- points and flag
	met = {
		"kpi1": result["kpi1_met"],
		"kpi2": int(bool(result["kpi2a_met"] and result["kpi2b_met"])),
		"kpi3": result["kpi3_met"],
		"kpi4": result["kpi4_met"],
		"kpi5": result["kpi5_met"],
		"kpi6": result["kpi6_met"],
		"kpi7": result["kpi7_met"],
		"kpi8": result["kpi8_met"],
	}
	applicable = [k for k in POINT_KEYS if settings.get(f"{k}_enabled")]
	result["total_points"] = len(applicable)
	result["points_met"] = sum(met[k] for k in applicable)
	result["compliance_percent"] = (
		round(result["points_met"] * 100.0 / result["total_points"], 2)
		if result["total_points"]
		else 0
	)
	result["flag"] = flag_for(result["points_met"], settings)
	result["generated_on"] = now_datetime()
	return result


def flag_for(points: int, settings=None) -> str:
	settings = settings or get_settings()
	if points >= (settings.green_min_points or 8):
		return "Green"
	if points >= (settings.orange_min_points or 4):
		return "Orange"
	return "Red"


# ---------------------------------------------------------------- persistence


def build_scorecard(employee_row: dict, date, settings=None) -> str:
	"""Compute and upsert the stored scorecard. Returns the docname."""
	values = compute(employee_row, date, settings)
	name = f"RMSC-{values['employee']}-{values['scorecard_date']}"

	if frappe.db.exists(SCORECARD_DT, name):
		doc = frappe.get_doc(SCORECARD_DT, name)
		doc.update(values)
		doc.save(ignore_permissions=True)
	else:
		doc = frappe.get_doc({"doctype": SCORECARD_DT, **values})
		doc.insert(ignore_permissions=True)
	return doc.name


def build_for_date(date, branch: str | None = None) -> dict:
	"""Build scorecards for every RM on one date."""
	settings = get_settings()
	if not settings.enabled:
		return {"skipped": "RM KPI Settings is disabled", "built": 0}

	built, skipped = 0, 0
	for row in get_rm_roster(settings, branch=branch):
		# Nothing to score before someone joined.
		if row.get("date_of_joining") and getdate(date) < getdate(row["date_of_joining"]):
			skipped += 1
			continue
		build_scorecard(row, date, settings)
		built += 1
	frappe.db.commit()
	return {"date": str(getdate(date)), "built": built, "skipped": skipped}


def build_range(from_date, to_date, branch: str | None = None) -> dict:
	"""Backfill a span of dates. Used for history and for seeding."""
	current, last = getdate(from_date), getdate(to_date)
	total = 0
	while current <= last:
		total += build_for_date(current, branch=branch).get("built", 0)
		current = getdate(add_days(current, 1))
	return {"from_date": str(getdate(from_date)), "to_date": str(last), "built": total}


# ---------------------------------------------------------------- scheduler


def build_yesterday():
	"""Nightly job -- snapshot the day that just closed."""
	from frappe.utils import today

	settings = get_settings()
	if not settings.enabled:
		return
	build_for_date(add_days(today(), -1))
