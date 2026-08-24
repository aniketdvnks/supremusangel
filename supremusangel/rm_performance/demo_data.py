# Copyright (c) 2026, Aniket Shinde and contributors
# For license information, please see license.txt
"""Seed believable RM activity so the EOD scorecard has something to show.

Nothing here is required at runtime -- it exists so the workspace, the reports
and the charts can be reviewed against realistic data before real logging
starts. Every record it writes carries a marker (see SEED_MARKERS) and
``clear_demo_data`` removes exactly those records and nothing else.

Run with:
    bench --site <site> execute supremusangel.rm_performance.demo_data.seed
    bench --site <site> execute supremusangel.rm_performance.demo_data.clear_demo_data
"""

from __future__ import annotations

import random

import frappe
from frappe.utils import add_days, getdate, today

from supremusangel.rm_performance import kpi_engine

SEED_KEY = "RM-EOD-SEED"
SEED_SUFFIX = "(Seed)"
SEED_EMAIL_DOMAIN = "rmseed.local"
SEED_EVENT_NOTE = "RM EOD seed data"

#: How each marker identifies its records, for both seeding and cleanup.
SEED_MARKERS = {
	"Lead": ("custom_sheet_import_key", SEED_KEY),
	"Event": ("description", SEED_EVENT_NOTE),
	"Scope Meeting": ("title", SEED_SUFFIX),
	"Job Applicant": ("email_id", SEED_EMAIL_DOMAIN),
}

DAYS = 30
LEAD_POOL = 200

FIRST_NAMES = [
	"Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Reyansh", "Krishna", "Ishaan",
	"Rohan", "Kabir", "Ananya", "Diya", "Aadhya", "Saanvi", "Ira", "Myra",
	"Riya", "Kavya", "Sneha", "Pooja", "Nikhil", "Rahul", "Amit", "Sagar",
	"Priya", "Neha", "Swati", "Manish", "Deepak", "Rupali",
]
LAST_NAMES = [
	"Sharma", "Patil", "Deshmukh", "Kulkarni", "Joshi", "Shah", "Mehta", "Gupta",
	"Iyer", "Nair", "Reddy", "Jadhav", "Pawar", "Chavan", "Bhosale", "More",
	"Kadam", "Shinde", "Gaikwad", "Salunkhe",
]
COMPANIES = [
	"Sunrise Textiles", "Vertex Logistics", "Blue Orbit Systems", "Kamal Traders",
	"Nexa Interiors", "Green Field Agro", "Orion Pharma", "Sahyadri Foods",
]
CHANNELS = ["Personal Networking", "Reference", "Digital Outreach", "Company Data"]
MODES = ["Call", "WhatsApp", "In Person", "Email"]
GOOD_OUTCOMES = ["Connected", "Interested"]
POOR_OUTCOMES = ["Not Picked", "Not Interested", "DND", "Wrong Number"]

#: Three performance shapes, so the flags are not uniformly green or red.
PROFILES = {
	"strong": {
		"prospects": (5, 8),
		"self_hosted_per_week": 3,
		"supported_per_month": 3,
		"office_per_month": 3,
		"team_meeting_rate": 1.0,
		"referrals": 2,
		"seminar_bookings": 3,
		"rating": ("Good", "Excellent"),
		"connect_rate": 0.65,
	},
	"mixed": {
		"prospects": (2, 6),
		"self_hosted_per_week": 2,
		"supported_per_month": 2,
		"office_per_month": 2,
		"team_meeting_rate": 0.7,
		"referrals": 1,
		"seminar_bookings": 1,
		"rating": ("Average", "Good"),
		"connect_rate": 0.45,
	},
	"weak": {
		"prospects": (0, 3),
		"self_hosted_per_week": 0,
		"supported_per_month": 0,
		"office_per_month": 0,
		"team_meeting_rate": 0.25,
		"referrals": 0,
		"seminar_bookings": 0,
		"rating": ("Not Rated", "Poor"),
		"connect_rate": 0.3,
	},
}


def seed(days: int = DAYS, rebuild: int = 1):
	"""Create the whole demo dataset, then build the scorecards over it."""
	days = int(days)
	rng = random.Random(20260819)

	settings = kpi_engine.get_settings()
	roster = kpi_engine.get_rm_roster(settings)
	if not roster:
		return {"error": "No RM employees found. Check RM KPI Settings -> RM Designation."}

	profiles = assign_profiles(roster, rng)
	window = working_days(days)

	report = {
		"rms": len(roster),
		"days": len(window),
		"leads": create_lead_pool(rng),
	}
	report["contacts"] = create_contacts(roster, profiles, window, rng)
	report["meetings"] = create_meetings(roster, profiles, window, rng)
	report["team_meetings"] = create_team_meetings(roster, profiles, window, rng)
	report["referrals"] = create_referrals(roster, profiles, rng)
	report["seminars"] = create_seminar_bookings(roster, profiles, rng)
	report["ratings"] = create_ratings(roster, profiles, rng)
	frappe.db.commit()

	if int(rebuild):
		report["scorecards"] = kpi_engine.build_range(window[0], window[-1])

	frappe.db.commit()
	return report


def assign_profiles(roster, rng) -> dict:
	"""Roughly 25% strong, 45% mixed, 30% weak -- a believable spread."""
	profiles = {}
	for index, member in enumerate(sorted(roster, key=lambda r: r["name"])):
		roll = (index * 7 + 3) % 20
		if roll < 5:
			profiles[member["name"]] = "strong"
		elif roll < 14:
			profiles[member["name"]] = "mixed"
		else:
			profiles[member["name"]] = "weak"
	return profiles


def working_days(days: int) -> list:
	"""The last N days, Sundays dropped."""
	out = []
	for offset in range(days - 1, -1, -1):
		day = getdate(add_days(today(), -offset))
		if day.weekday() != 6:
			out.append(day)
	return out


# ---------------------------------------------------------------- leads


def create_lead_pool(rng) -> int:
	existing = frappe.get_all(
		"Lead", filters={"custom_sheet_import_key": SEED_KEY}, pluck="name"
	)
	if len(existing) >= LEAD_POOL:
		return 0

	branches = frappe.get_all("Branch", pluck="name")
	created = 0
	for index in range(len(existing), LEAD_POOL):
		first = rng.choice(FIRST_NAMES)
		last = rng.choice(LAST_NAMES)
		doc = frappe.get_doc(
			{
				"doctype": "Lead",
				"lead_name": f"{first} {last}",
				"company_name": rng.choice(COMPANIES),
				"mobile_no": f"9{rng.randint(100000000, 999999999)}",
				"email_id": f"{first.lower()}.{last.lower()}{index}@{SEED_EMAIL_DOMAIN}",
				"status": "Lead",
				"custom_sheet_import_key": SEED_KEY,
				"custom_branch": rng.choice(branches) if branches else None,
			}
		)
		doc.flags.ignore_permissions = True
		doc.flags.ignore_mandatory = True
		doc.insert()
		created += 1
		if created % 50 == 0:
			frappe.db.commit()
	frappe.db.commit()
	return created


def create_contacts(roster, profiles, window, rng) -> int:
	"""Plan every contact first, then write once per Lead.

	Appending row by row would mean thousands of full Lead saves; grouping by
	Lead keeps it to one save each.
	"""
	pool = frappe.get_all("Lead", filters={"custom_sheet_import_key": SEED_KEY}, pluck="name")
	if not pool:
		return 0

	planned: dict[str, list[dict]] = {}
	total = 0
	for member in roster:
		profile = PROFILES[profiles[member["name"]]]
		low, high = profile["prospects"]
		joined = member.get("date_of_joining")

		for day in window:
			if joined and day < getdate(joined):
				continue
			count = rng.randint(low, high)
			if not count:
				continue
			for lead in rng.sample(pool, min(count, len(pool))):
				connected = rng.random() < profile["connect_rate"]
				planned.setdefault(lead, []).append(
					{
						"contact_date": str(day),
						"rm": member["name"],
						"channel": rng.choice(CHANNELS),
						"mode": rng.choice(MODES),
						"outcome": rng.choice(GOOD_OUTCOMES if connected else POOR_OUTCOMES),
						"remark": "",
					}
				)
				total += 1

	written = 0
	for lead, rows in planned.items():
		doc = frappe.get_doc("Lead", lead)
		if doc.get("custom_contact_log"):
			continue  # already seeded on an earlier run
		for row in sorted(rows, key=lambda r: r["contact_date"]):
			doc.append("custom_contact_log", row)
		doc.flags.ignore_permissions = True
		doc.flags.ignore_mandatory = True
		doc.save()
		written += 1
		if written % 25 == 0:
			frappe.db.commit()
	frappe.db.commit()
	return total


# ---------------------------------------------------------------- meetings


def create_meetings(roster, profiles, window, rng) -> int:
	if frappe.db.count("Event", {"description": SEED_EVENT_NOTE}):
		return 0

	pool = frappe.get_all("Lead", filters={"custom_sheet_import_key": SEED_KEY}, pluck="name")
	created = 0

	for member in roster:
		profile = PROFILES[profiles[member["name"]]]
		weeks = max(1, len(window) // 6)

		plan = []
		plan += [("Self Hosted", "Client Place")] * (profile["self_hosted_per_week"] * weeks)
		plan += [("With Support", "Client Place")] * profile["supported_per_month"]
		plan += [("Self Hosted", "Office")] * profile["office_per_month"]

		for support, venue in plan:
			day = rng.choice(window)
			lead = rng.choice(pool) if pool else None
			lead_name = frappe.db.get_value("Lead", lead, "lead_name") if lead else "Client"
			doc = frappe.get_doc(
				{
					"doctype": "Event",
					"subject": f"Client Meeting — {lead_name} {SEED_SUFFIX}",
					"event_type": "Private",
					"event_category": "Meeting",
					"status": "Open",
					"starts_on": f"{day} {rng.randint(10, 18):02d}:{rng.choice(['00','30'])}:00",
					"description": SEED_EVENT_NOTE,
					"custom_rm": member["name"],
					"custom_branch": member.get("branch"),
					"custom_event_mode": "Offline",
					"custom_meeting_support": support,
					"custom_venue_type": venue,
				}
			)
			if lead:
				doc.append("event_participants", {"reference_doctype": "Lead", "reference_docname": lead})
			doc.flags.ignore_permissions = True
			doc.insert()
			created += 1
		if created % 40 == 0:
			frappe.db.commit()
	frappe.db.commit()
	return created


def create_team_meetings(roster, profiles, window, rng) -> int:
	if not frappe.db.table_exists("Scope Meeting"):
		return 0
	if frappe.db.count("Scope Meeting", {"title": ["like", f"%{SEED_SUFFIX}"]}):
		return 0

	# Every third working day, per branch. A strictly weekly cadence cannot
	# satisfy a "4 per month" target part-way through a month, which would leave
	# the seeded data with no Green flags at all.
	branches = sorted({m.get("branch") for m in roster if m.get("branch")})
	slots = list(range(0, len(window), 3))
	created = 0

	for branch in branches or [None]:
		members = [m for m in roster if m.get("branch") == branch] or roster
		for index, slot in enumerate(slots):
			day = window[slot]
			doc = frappe.get_doc(
				{
					"doctype": "Scope Meeting",
					"title": f"Team Meeting — {branch or 'All'} #{index + 1} {SEED_SUFFIX}",
					"category_type": "Team Meeting",
					"meeting_type": "Offline",
					"status": "Completed",
					"branch": branch,
					"meeting_start_time": f"{day} 10:00:00",
					"meeting_end_time": f"{day} 11:00:00",
				}
			)
			for member in members:
				profile = PROFILES[profiles[member["name"]]]
				present = rng.random() < profile["team_meeting_rate"]
				doc.append(
					"attendees",
					{
						"party_type": "Employee",
						"party": member["name"],
						"party_name": member.get("employee_name"),
						"user": member.get("user_id"),
						"status": "Accepted",
						"attendance": "Present" if present else "Absent",
					},
				)
			doc.flags.ignore_permissions = True
			doc.flags.ignore_mandatory = True
			doc.insert()
			created += 1
	frappe.db.commit()
	return created


# ---------------------------------------------------------------- expansion


def create_referrals(roster, profiles, rng) -> int:
	if frappe.db.count("Job Applicant", {"email_id": ["like", f"%@{SEED_EMAIL_DOMAIN}"]}):
		return 0

	opening = frappe.db.get_value("Job Opening", {}, "name")
	created = 0
	for member in roster:
		profile = PROFILES[profiles[member["name"]]]
		for index in range(profile["referrals"]):
			first, last = rng.choice(FIRST_NAMES), rng.choice(LAST_NAMES)
			doc = frappe.get_doc(
				{
					"doctype": "Job Applicant",
					"applicant_name": f"{first} {last}",
					"email_id": f"{first.lower()}.{last.lower()}.{member['name']}.{index}@{SEED_EMAIL_DOMAIN}",
					"status": "Open",
					"job_title": opening,
					"custom_referred_by_rm": member["name"],
				}
			)
			doc.flags.ignore_permissions = True
			doc.flags.ignore_mandatory = True
			doc.insert()
			_backdate(doc.doctype, doc.name, rng)
			created += 1
	frappe.db.commit()
	return created


def create_seminar_bookings(roster, profiles, rng) -> int:
	"""KPI 4 -- cloned from an existing booking so every mandatory field is real.

	Without a template booking on the site there is nothing safe to copy, so
	this is skipped rather than guessed at.
	"""
	if not frappe.db.table_exists("Event Booking"):
		return 0

	template_name = frappe.db.get_value(
		"Event Booking", {"docstatus": ["<", 2]}, "name", order_by="creation asc"
	)
	if not template_name:
		return 0
	if frappe.db.count("Event Booking", {"custom_credited_rm": ["is", "set"]}):
		return 0

	created = 0
	for member in roster:
		profile = PROFILES[profiles[member["name"]]]
		if not profile["seminar_bookings"]:
			continue
		for index in range(profile["seminar_bookings"]):
			try:
				doc = frappe.copy_doc(frappe.get_doc("Event Booking", template_name))
				doc.custom_credited_rm = member["name"]
				# Three attendees a booking gets a strong RM past the target of seven.
				base = doc.attendees[0] if doc.attendees else None
				doc.attendees = []
				for seat in range(3):
					first, last = rng.choice(FIRST_NAMES), rng.choice(LAST_NAMES)
					row = {
						"first_name": first,
						"last_name": last,
						"email": f"{first.lower()}{seat}.{member['name']}.{index}@{SEED_EMAIL_DOMAIN}",
						"currency": (base.currency if base else "INR"),
					}
					if base and base.get("ticket_type"):
						row["ticket_type"] = base.ticket_type
					doc.append("attendees", row)
				doc.flags.ignore_permissions = True
				doc.flags.ignore_mandatory = True
				doc.insert()
				_backdate(doc.doctype, doc.name, rng)
				created += 1
			except Exception:
				frappe.log_error(
					frappe.get_traceback(), "RM Performance seed: Event Booking skipped"
				)
				return created
	frappe.db.commit()
	return created



def _backdate(doctype: str, name: str, rng) -> None:
	"""Move a record back into the current month.

	KPI 4 and KPI 6 count month to date off ``creation``. Records inserted today
	would only ever register on today's scorecard, which makes the seeded
	history look emptier than the activity it represents.
	"""
	day = getdate(today())
	earliest = day.replace(day=1)
	span = (day - earliest).days
	offset = rng.randint(0, span) if span > 0 else 0
	stamp = f"{add_days(day, -offset)} {rng.randint(9, 18):02d}:{rng.randint(0, 59):02d}:00"
	frappe.db.set_value(doctype, name, "creation", stamp, update_modified=False)


def create_ratings(roster, profiles, rng) -> int:
	month = kpi_engine.month_key(today())
	created = 0
	for member in roster:
		profile = PROFILES[profiles[member["name"]]]
		name = f"RMR-{member['name']}-{month}"
		if frappe.db.exists("RM Monthly Rating", name):
			continue
		doc = frappe.get_doc(
			{
				"doctype": "RM Monthly Rating",
				"employee": member["name"],
				"month_key": month,
				"kpi7_rating": rng.choice(profile["rating"]),
				"kpi8_rating": rng.choice(profile["rating"]),
				"manager_remark": "Seeded rating for review of the EOD scorecard.",
			}
		)
		doc.flags.ignore_permissions = True
		doc.insert()
		created += 1
	frappe.db.commit()
	return created


# ---------------------------------------------------------------- cleanup


def clear_demo_data():
	"""Remove every seeded record -- and only seeded records."""
	removed = {}

	removed["RM Daily Scorecard"] = _delete_all("RM Daily Scorecard", {})
	removed["RM Monthly Rating"] = _delete_all(
		"RM Monthly Rating",
		{"manager_remark": ["like", "%Seeded rating%"]},
	)
	removed["Event"] = _delete_all("Event", {"description": SEED_EVENT_NOTE})
	removed["Scope Meeting"] = _delete_all("Scope Meeting", {"title": ["like", f"%{SEED_SUFFIX}"]})
	removed["Job Applicant"] = _delete_all(
		"Job Applicant", {"email_id": ["like", f"%@{SEED_EMAIL_DOMAIN}"]}
	)
	removed["Event Booking"] = _delete_all(
		"Event Booking", {"custom_credited_rm": ["is", "set"]}, cancel_first=True
	)
	removed["Lead"] = _delete_all("Lead", {"custom_sheet_import_key": SEED_KEY})

	frappe.db.commit()
	return removed


def _delete_all(doctype: str, filters: dict, cancel_first: bool = False) -> int:
	if not frappe.db.table_exists(doctype):
		return 0
	names = frappe.get_all(doctype, filters=filters, pluck="name")
	count = 0
	for name in names:
		try:
			if cancel_first:
				doc = frappe.get_doc(doctype, name)
				if doc.docstatus == 1:
					doc.cancel()
			frappe.delete_doc(doctype, name, force=1, ignore_permissions=True, delete_permanently=True)
			count += 1
		except Exception:
			frappe.log_error(frappe.get_traceback(), f"RM Performance cleanup: {doctype} {name}")
	frappe.db.commit()
	return count
