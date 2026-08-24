# Copyright (c) 2026, Aniket Shinde and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class RMDailyScorecard(Document):
	"""Snapshot written by supremusangel.rm_performance.kpi_engine.

	Every value here is derived. Nothing edits it by hand -- rebuilding the
	scorecard for that date is what corrects it.
	"""

	pass
