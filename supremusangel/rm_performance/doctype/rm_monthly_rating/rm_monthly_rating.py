# Copyright (c) 2026, Aniket Shinde and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime

#: Ratings at or above this level count the pointer as met.
MET_RATINGS = {"Average", "Good", "Excellent"}


class RMMonthlyRating(Document):
	def validate(self):
		self.validate_month_key()
		self.kpi7_met = 1 if self.kpi7_rating in MET_RATINGS else 0
		self.kpi8_met = 1 if self.kpi8_rating in MET_RATINGS else 0
		self.rated_by = frappe.session.user
		self.rated_on = now_datetime()

	def validate_month_key(self):
		"""month_key drives the docname and the scorecard join, so it has to be
		exactly YYYY-MM -- anything else silently detaches the rating from every
		scorecard in that month."""
		value = (self.month_key or "").strip()
		parts = value.split("-")
		if len(parts) != 2 or len(parts[0]) != 4 or len(parts[1]) != 2:
			frappe.throw("Month must be in YYYY-MM format, for example 2026-08")
		try:
			year, month = int(parts[0]), int(parts[1])
		except ValueError:
			frappe.throw("Month must be in YYYY-MM format, for example 2026-08")
		if not (1 <= month <= 12):
			frappe.throw("Month must be between 01 and 12")
		if not (2000 <= year <= 2100):
			frappe.throw("Year looks wrong — expected something between 2000 and 2100")
		self.month_key = f"{year:04d}-{month:02d}"
