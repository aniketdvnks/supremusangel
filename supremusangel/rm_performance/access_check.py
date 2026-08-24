# Copyright (c) 2026, Aniket Shinde and contributors
# For license information, please see license.txt
"""Show what a given user would actually see, without logging in as them.

Impersonating notifies the real person and writes an Activity Log entry, which
is noise when you only want to confirm a permission rule. This runs the same
queries the reports and the desk run, under that user's identity, and prints
the row counts.

    bench --site <site> execute supremusangel.rm_performance.access_check.report
    bench --site <site> execute supremusangel.rm_performance.access_check.report --args "['someone@example.com']"
"""

from __future__ import annotations

import frappe
from frappe.desk.query_report import run
from frappe.utils import today

from supremusangel.rm_performance import api, scoping

FULL_ACCESS_ROLES = scoping.FULL_ACCESS_ROLES


def report(user: str | None = None, date: str | None = None):
	"""Print an access summary for one user, or for a sample of each access level."""
	date = date or today()
	users = [user] if user else sample_users()

	print(f"\nRM Performance access check — {date}\n" + "=" * 78)
	out = []
	for name in users:
		out.append(check(name, date))
	print("=" * 78)
	return out


def check(user: str, date: str) -> dict:
	original = frappe.session.user
	result = {"user": user}
	try:
		if not frappe.db.exists("User", user):
			print(f"{user:38} — no such User")
			return {**result, "error": "not found"}

		enabled = frappe.db.get_value("User", user, "enabled")
		frappe.set_user(user)

		roles = sorted(set(frappe.get_roles(user)) & (FULL_ACCESS_ROLES | {"Branch Manager", "Employee"}))
		visible = scoping.visible_employees()
		employee = frappe.db.get_value("Employee", {"user_id": user}, ["name", "employee_name"], as_dict=True)

		result.update(
			{
				"enabled": bool(enabled),
				"employee": employee.name if employee else None,
				"roles": roles,
				"visible_employees": "ALL" if visible is None else len(visible),
			}
		)

		for label, key, fn in [
			("EOD Scorecard", "eod", lambda: run("RM EOD Scorecard", filters={"from_date": date, "to_date": date}, ignore_prepared_report=True)["result"]),
			("Monthly Summary", "monthly", lambda: run("RM Monthly Summary", filters={"month": date}, ignore_prepared_report=True)["result"]),
			("Scorecard list", "list", lambda: frappe.get_list("RM Daily Scorecard", filters={"scorecard_date": date}, limit_page_length=0)),
		]:
			try:
				result[key] = len(fn())
			except Exception as exc:
				result[key] = type(exc).__name__

		try:
			result["desk_board"] = api.get_eod_board(date=date)["summary"]["total"]
		except Exception as exc:
			result["desk_board"] = type(exc).__name__

		print(
			f"{user:38} {'on ' if enabled else 'OFF'} "
			f"emp={result['employee'] or '-':8} "
			f"sees={str(result['visible_employees']):>4} | "
			f"EOD={str(result['eod']):>4}  Monthly={str(result['monthly']):>4}  "
			f"List={str(result['list']):>4}  Desk={str(result['desk_board']):>4}  "
			f"roles={','.join(roles) or '-'}"
		)
		return result
	finally:
		frappe.set_user(original)


def sample_users() -> list[str]:
	"""One live user from each access level, so the three rules are visible at once."""
	picked, seen = [], set()

	def add(user):
		if user and user not in seen:
			seen.add(user)
			picked.append(user)

	rows = frappe.db.sql(
		"""
		SELECT e.name, e.user_id, e.designation,
		       (SELECT COUNT(*) FROM tabEmployee c
		         WHERE c.reports_to = e.name
		           AND c.designation = 'Wealth Relationship Manager'
		           AND c.status = 'Active') AS rms
		FROM tabEmployee e
		JOIN tabUser u ON u.name = e.user_id
		WHERE e.status = 'Active' AND u.enabled = 1
		""",
		as_dict=True,
	)

	hr, managers, rms = [], [], []
	for row in rows:
		has_full = bool(FULL_ACCESS_ROLES & set(frappe.get_roles(row.user_id)))
		if has_full:
			hr.append(row.user_id)
		elif row.rms:
			managers.append(row.user_id)
		elif row.designation == "Wealth Relationship Manager":
			rms.append(row.user_id)

	add(hr[0] if hr else None)
	add(managers[0] if managers else None)
	add(rms[0] if rms else None)
	add("Administrator")
	return picked
