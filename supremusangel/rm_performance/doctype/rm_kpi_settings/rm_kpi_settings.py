# Copyright (c) 2026, Aniket Shinde and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class RMKPISettings(Document):
	def validate(self):
		if self.green_min_points < self.orange_min_points:
			frappe.throw("Green threshold cannot be lower than the Orange threshold.")
		if self.kpi1_target < 0:
			frappe.throw("Prospects per day cannot be negative.")

	def on_update(self):
		# The engine reads these through get_cached_doc on every scorecard build.
		frappe.clear_document_cache("RM KPI Settings", "RM KPI Settings")
