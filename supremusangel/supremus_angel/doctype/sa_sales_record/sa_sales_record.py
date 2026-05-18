# Copyright (c) 2026, Aniket Shinde and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt


class SASalesRecord(Document):
	def before_save(self):
		self._calculate_total_sales_value()

	def _calculate_total_sales_value(self):
		if not self.merchandise:
			# auto-posted records have total_sales_value set directly
			return
		if self.is_variable_value:
			self.total_sales_value = flt(self.units_sold) * flt(self.unit_value_inr)
		else:
			unit_val = frappe.db.get_value("SA Merchandise", self.merchandise, "unit_value_inr")
			self.total_sales_value = flt(self.units_sold) * flt(unit_val)
