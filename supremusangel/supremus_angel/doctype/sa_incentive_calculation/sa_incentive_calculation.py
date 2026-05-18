# Copyright (c) 2026, Aniket Shinde and contributors
# For license information, please see license.txt

import calendar
from datetime import date

import frappe
from frappe.model.document import Document
from frappe.utils import flt


class SAIncentiveCalculation(Document):
	def before_save(self):
		if self.calculation_month and not self.from_date:
			self._set_date_range()

	@frappe.whitelist()
	def calculate(self):
		if not self.salary:
			frappe.throw(frappe._("Please enter the monthly salary before calculating."))
		if not self.calculation_month:
			frappe.throw(frappe._("Please enter a calculation month (YYYY-MM)."))
		if not self.sales_person:
			frappe.throw(frappe._("Please select a sales person."))

		salary = flt(self.salary)
		base_target = salary * 10
		minimum_target = base_target * 0.7

		self.base_target = base_target
		self.minimum_target = minimum_target

		self._set_date_range()

		records = frappe.get_all(
			"SA Sales Record",
			filters={
				"sales_person": self.sales_person,
				"posting_date": ["between", [self.from_date, self.to_date]],
				"status": "Confirmed",
			},
			fields=["name", "posting_date", "merchandise", "units_sold", "total_sales_value"],
		)

		total_sales = sum(flt(r.total_sales_value) for r in records)
		self.total_sales = total_sales
		self.achievement_percent = (total_sales / base_target * 100) if base_target else 0

		slab = self._get_applicable_slab(self.achievement_percent)
		if slab:
			self.slab_applied = slab.name
			self.incentive_percent = flt(slab.incentive_percent)
			self.reward_percent = flt(slab.reward_percent)
		else:
			self.slab_applied = None
			self.incentive_percent = 0
			self.reward_percent = 0

		self.incentive_amount = salary * (self.incentive_percent / 100)
		self.reward_amount = (
			(total_sales - base_target) * (self.reward_percent / 100)
			if total_sales > base_target
			else 0
		)
		self.total_payout = self.incentive_amount + self.reward_amount

		self.set("sales_details", [])
		for r in records:
			self.append(
				"sales_details",
				{
					"sales_record": r.name,
					"posting_date": r.posting_date,
					"merchandise": r.merchandise,
					"units_sold": r.units_sold,
					"total_sales_value": r.total_sales_value,
				},
			)

		self.status = "Calculated"
		self.save()

	def _set_date_range(self):
		if not self.calculation_month or len(self.calculation_month) < 7:
			return
		try:
			year = int(self.calculation_month[:4])
			month = int(self.calculation_month[5:7])
			self.from_date = date(year, month, 1).strftime("%Y-%m-%d")
			last_day = calendar.monthrange(year, month)[1]
			self.to_date = date(year, month, last_day).strftime("%Y-%m-%d")
		except (ValueError, IndexError):
			frappe.throw(frappe._("Invalid calculation month format. Use YYYY-MM."))

	def _get_applicable_slab(self, achievement_percent):
		slabs = frappe.get_all(
			"SA Incentive Slab",
			fields=[
				"name",
				"min_achievement",
				"max_achievement",
				"has_no_upper_limit",
				"incentive_percent",
				"reward_percent",
			],
			order_by="min_achievement desc",
		)
		for slab in slabs:
			if flt(achievement_percent) < flt(slab.min_achievement):
				continue
			if slab.has_no_upper_limit or flt(achievement_percent) < flt(slab.max_achievement):
				return slab
		return None
