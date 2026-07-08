# Copyright (c) 2026, Aniket Shinde and contributors
# For license information, please see license.txt

import calendar
from datetime import date

import frappe
from frappe.model.document import Document
from frappe.utils import flt

from supremusangel.supremus_angel.incentive_source import get_sales_rows, get_settings


class SABMIncentiveCalculation(Document):
	def before_save(self):
		if self.calculation_month and not self.from_date:
			self._set_date_range()

	@frappe.whitelist()
	def calculate(self):
		if not self.salary:
			frappe.throw(frappe._("Please enter the BM monthly salary before calculating."))
		if not self.calculation_month:
			frappe.throw(frappe._("Please enter a calculation month (YYYY-MM)."))
		if not self.branch_manager:
			frappe.throw(frappe._("Please select a branch manager (Sales Person)."))

		self._set_date_range()

		settings = get_settings()
		self._calculate_personal(settings)
		self._calculate_branch(settings)

		self.total_payout = flt(self.personal_payout) + flt(self.branch_commission_amount)
		self.status = "Calculated"
		self.save()

	# ------------------------------------------------------------------ personal

	def _calculate_personal(self, settings):
		salary = flt(self.salary)
		personal_target = salary * flt(settings.target_multiple)
		self.personal_target = personal_target
		self.minimum_target = salary * flt(settings.minimum_multiple)

		records = self._get_sales_records(self.branch_manager)
		personal_sales = sum(flt(r.credited_amount) for r in records)
		self.personal_sales = personal_sales
		self.personal_achievement_percent = (
			(personal_sales / personal_target * 100) if personal_target else 0
		)

		# Base Target Achievement Bonus — flat % of personal target by slab.
		bonus_slab = self._get_bonus_slab(settings, self.personal_achievement_percent)
		if bonus_slab:
			self.bonus_slab = bonus_slab.slab_label
			self.bonus_percent = flt(bonus_slab.bonus_percent)
		else:
			self.bonus_slab = None
			self.bonus_percent = 0
		self.bonus_amount = personal_target * (flt(self.bonus_percent) / 100)

		# Personal incentive — marginal across bands on sales above target.
		self.personal_incentive_amount = self._marginal_incentive(settings, personal_sales, personal_target)

		self.personal_payout = flt(self.bonus_amount) + flt(self.personal_incentive_amount)

		self.set("personal_sales_details", [])
		for r in records:
			self.append(
				"personal_sales_details",
				{
					"sales_invoice": r.sales_invoice,
					"posting_date": r.posting_date,
					"customer": r.customer,
					"allocated_percentage": r.allocated_percentage,
					"total_sales_value": r.credited_amount,
				},
			)

	def _marginal_incentive(self, settings, personal_sales, personal_target):
		"""Sum incentive over each band, applying the band rate only to the
		portion of personal_sales that falls inside that band. Bands are defined
		as % of personal_target (100 => 10x)."""
		if not personal_target or personal_sales <= personal_target:
			return 0

		bands = sorted(
			settings.manager_incentive_bands, key=lambda b: flt(b.from_achievement)
		)

		total = 0.0
		for band in bands:
			lower = personal_target * flt(band.from_achievement) / 100
			if band.has_no_upper_limit or not band.to_achievement:
				upper = personal_sales
			else:
				upper = personal_target * flt(band.to_achievement) / 100
			portion = min(personal_sales, upper) - lower
			if portion > 0:
				total += portion * (flt(band.incentive_percent) / 100)
		return total

	def _get_bonus_slab(self, settings, achievement_percent):
		slabs = sorted(
			settings.manager_bonus_slabs, key=lambda s: flt(s.min_achievement), reverse=True
		)
		for slab in slabs:
			if flt(achievement_percent) < flt(slab.min_achievement):
				continue
			if slab.has_no_upper_limit or flt(achievement_percent) < flt(slab.max_achievement):
				return slab
		return None

	# ------------------------------------------------------------------- branch

	def _calculate_branch(self, settings):
		members = self._get_branch_members()
		self.set("branch_details", [])

		full_branch_target = 0.0
		branch_revenue = 0.0
		missing_calc = []

		for member in members:
			member_sales = sum(
				flt(r.credited_amount) for r in self._get_sales_records(member)
			)
			branch_revenue += member_sales

			member_calc = frappe.get_all(
				"SA Incentive Calculation",
				filters={"sales_person": member, "calculation_month": self.calculation_month},
				fields=["salary", "base_target"],
				limit=1,
			)
			if member_calc:
				member_salary = flt(member_calc[0].salary)
				member_target = flt(member_calc[0].base_target) or member_salary * flt(settings.target_multiple)
				has_calc = 1
			else:
				member_salary = 0
				member_target = 0
				has_calc = 0
				missing_calc.append(member)

			full_branch_target += member_target

			self.append(
				"branch_details",
				{
					"member": member,
					"member_salary": member_salary,
					"member_target": member_target,
					"member_sales": member_sales,
					"member_achievement_percent": (
						(member_sales / member_target * 100) if member_target else 0
					),
					"has_calculation": has_calc,
				},
			)

		self.branch_member_count = len(members)
		self.full_branch_target = full_branch_target
		self.branch_target = full_branch_target * (flt(settings.branch_commission_min_achievement) / 100)
		self.branch_revenue = branch_revenue
		self.branch_achievement_percent = (
			(branch_revenue / full_branch_target * 100) if full_branch_target else 0
		)

		rate = self._branch_commission_rate(settings, self.branch_achievement_percent)
		self.branch_commission_percent = rate
		self.branch_commission_amount = branch_revenue * (rate / 100)

		if missing_calc:
			frappe.msgprint(
				frappe._(
					"No SA Incentive Calculation found for {0} for {1}; their sales were counted "
					"but their target could not be included in the branch target. Calculate their "
					"incentive first for an accurate branch target."
				).format(", ".join(missing_calc), self.calculation_month),
				indicator="orange",
				title=frappe._("Branch Target Incomplete"),
			)

	def _branch_commission_rate(self, settings, achievement_percent):
		"""Tiered branch commission rate by branch achievement %:
		below min -> 0; min to 100% -> on-target %; above 100% (overachieved) -> overachieved %."""
		ach = flt(achievement_percent)
		if ach < flt(settings.branch_commission_min_achievement):
			return 0.0
		if ach <= 100:
			return flt(settings.branch_commission_on_target_percent)
		return flt(settings.branch_commission_overachieved_percent)

	def _get_branch_members(self):
		"""All non-group Sales Person nodes in the branch manager's subtree
		(the 'whole branch'), excluding the branch manager itself."""
		bm = frappe.db.get_value("Sales Person", self.branch_manager, ["lft", "rgt"], as_dict=True)
		if not bm:
			return []
		members = frappe.get_all(
			"Sales Person",
			filters={
				"lft": [">", bm.lft],
				"rgt": ["<", bm.rgt],
				"is_group": 0,
			},
			pluck="name",
		)
		return members

	# -------------------------------------------------------------------- shared

	def _get_sales_records(self, sales_person):
		return get_sales_rows(sales_person, self.from_date, self.to_date)

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
