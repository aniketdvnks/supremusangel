# Copyright (c) 2026, Aniket Shinde and contributors
# For license information, please see license.txt
"""Who may see which RM.

One rule, shared by every report and page in this module, so the desk board and
the Excel export can never disagree about what a given user is allowed to see.

  * HR and System Manager -- every RM, every branch. This is the access
    Sushmitha needs to pull the EOD report company-wide.
  * Anyone else with an Employee record -- themselves plus everyone reporting
    into them, at any depth of the reports_to chain.
  * Branch Manager -- additionally, everyone in their own branch.
  * No Employee record and no HR role -- nothing.
"""

import frappe

#: Roles that see the whole company.
FULL_ACCESS_ROLES = {"Administrator", "System Manager", "HR Manager", "HR User"}

#: Roles that additionally see their whole branch, not just their direct tree.
BRANCH_ACCESS_ROLES = {"Branch Manager"}


def has_full_access(user: str | None = None) -> bool:
	user = user or frappe.session.user
	if user == "Administrator":
		return True
	return bool(FULL_ACCESS_ROLES & set(frappe.get_roles(user)))


def visible_employees(user: str | None = None) -> list[str] | None:
	"""Employee names this user may see. ``None`` means no restriction at all."""
	user = user or frappe.session.user
	if has_full_access(user):
		return None

	roles = set(frappe.get_roles(user))
	own = frappe.db.get_value("Employee", {"user_id": user}, "name")
	if not own:
		return []

	allowed = {own} | descendants_of(own)

	if BRANCH_ACCESS_ROLES & roles:
		branch = frappe.db.get_value("Employee", own, "branch")
		if branch:
			allowed.update(
				frappe.get_all("Employee", filters={"branch": branch}, pluck="name")
			)
	return sorted(allowed)


def descendants_of(employee: str) -> set[str]:
	"""Every employee below this one in the reports_to chain."""
	found: set[str] = set()
	frontier = [employee]
	# Bounded so a reports_to cycle can never spin forever.
	for _ in range(20):
		if not frontier:
			break
		children = frappe.get_all(
			"Employee", filters={"reports_to": ["in", frontier]}, pluck="name"
		)
		fresh = [c for c in children if c not in found and c != employee]
		if not fresh:
			break
		found.update(fresh)
		frontier = fresh
	return found


def apply_employee_scope(filters: dict, fieldname: str = "employee") -> dict | None:
	"""Fold the caller's scope into a filter dict.

	Returns ``None`` when the caller may see nothing, so the caller can return an
	empty result instead of running a query that would match everything.
	"""
	allowed = visible_employees()
	if allowed is None:
		return filters
	if not allowed:
		return None
	requested = filters.get(fieldname)
	if requested:
		if requested not in allowed:
			return None
		return filters
	filters[fieldname] = ["in", allowed]
	return filters


# ---------------------------------------------------------------- row security


def scorecard_query_conditions(user: str | None = None, doctype: str | None = None) -> str:
	"""Row filter for RM Daily Scorecard list views and reports.

	The reports are open to every Employee so a reporting manager needs no extra
	role, which means the doctype itself has to enforce the same rule -- without
	this, opening the list view directly would show the whole company.
	"""
	return _row_conditions("tabRM Daily Scorecard", user)


def rating_query_conditions(user: str | None = None, doctype: str | None = None) -> str:
	return _row_conditions("tabRM Monthly Rating", user)


def _row_conditions(table: str, user: str | None) -> str:
	user = user or frappe.session.user
	allowed = visible_employees(user)
	if allowed is None:
		return ""
	if not allowed:
		return "1=0"
	quoted = ", ".join(frappe.db.escape(name) for name in allowed)
	return f"`{table}`.`employee` in ({quoted})"


def scorecard_has_permission(doc, ptype=None, user=None) -> bool:
	allowed = visible_employees(user or frappe.session.user)
	if allowed is None:
		return True
	return doc.employee in allowed
