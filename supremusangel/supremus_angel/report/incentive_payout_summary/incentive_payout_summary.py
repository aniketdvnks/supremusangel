# Copyright (c) 2026, Aniket Shinde and contributors
# For license information, please see license.txt

"""One monthly payout sheet across all three incentive schemes.

Unions Salesperson (`SA Incentive Calculation`), Team Lead
(`SA TL Incentive Calculation`) and Branch Manager
(`SA BM Incentive Calculation`) into a single table so payroll can read every
person's personal payout, team/branch commission and grand total in one place.
"""

import frappe


def execute(filters=None):
	filters = filters or {}
	return get_columns(), get_data(filters)


def get_columns():
	return [
		{"label": "Person", "fieldname": "person", "fieldtype": "Link", "options": "Sales Person", "width": 180},
		{"label": "Role", "fieldname": "role", "fieldtype": "Data", "width": 120},
		{"label": "Month", "fieldname": "calculation_month", "fieldtype": "Data", "width": 90},
		{"label": "Salary", "fieldname": "salary", "fieldtype": "Currency", "width": 110},
		{"label": "Own Sales", "fieldname": "own_sales", "fieldtype": "Currency", "width": 130},
		{"label": "Achievement %", "fieldname": "achievement_percent", "fieldtype": "Float", "precision": 2, "width": 120},
		{"label": "Personal Payout", "fieldname": "personal_payout", "fieldtype": "Currency", "width": 140},
		{"label": "Team/Branch Commission", "fieldname": "commission", "fieldtype": "Currency", "width": 180},
		{"label": "Total Payout", "fieldname": "total_payout", "fieldtype": "Currency", "width": 140},
		{"label": "Status", "fieldname": "status", "fieldtype": "Data", "width": 90},
		{"label": "Document", "fieldname": "document", "fieldtype": "Dynamic Link", "options": "document_type", "width": 170},
		{"label": "Document Type", "fieldname": "document_type", "fieldtype": "Data", "width": 1, "hidden": 1},
	]


def get_data(filters):
	conditions = ["t.status != 'Draft'"]
	values = {}

	if filters.get("calculation_month"):
		conditions.append("t.calculation_month = %(calculation_month)s")
		values["calculation_month"] = filters["calculation_month"]
	if filters.get("person"):
		conditions.append("t.person = %(person)s")
		values["person"] = filters["person"]
	if filters.get("role"):
		conditions.append("t.role = %(role)s")
		values["role"] = filters["role"]
	if filters.get("status"):
		conditions.append("t.status = %(status)s")
		values["status"] = filters["status"]

	where = "WHERE " + " AND ".join(conditions)

	return frappe.db.sql(
		f"""
		SELECT * FROM (
			SELECT
				sales_person AS person,
				'Salesperson' AS role,
				calculation_month, salary,
				total_sales AS own_sales,
				achievement_percent,
				total_payout AS personal_payout,
				0 AS commission,
				total_payout,
				status,
				name AS document,
				'SA Incentive Calculation' AS document_type
			FROM `tabSA Incentive Calculation`

			UNION ALL

			SELECT
				team_lead AS person,
				'Team Lead' AS role,
				calculation_month, salary,
				personal_sales AS own_sales,
				personal_achievement_percent AS achievement_percent,
				personal_payout,
				team_commission_amount AS commission,
				total_payout,
				status,
				name AS document,
				'SA TL Incentive Calculation' AS document_type
			FROM `tabSA TL Incentive Calculation`

			UNION ALL

			SELECT
				branch_manager AS person,
				'Branch Manager' AS role,
				calculation_month, salary,
				personal_sales AS own_sales,
				personal_achievement_percent AS achievement_percent,
				personal_payout,
				branch_commission_amount AS commission,
				total_payout,
				status,
				name AS document,
				'SA BM Incentive Calculation' AS document_type
			FROM `tabSA BM Incentive Calculation`
		) t
		{where}
		ORDER BY t.calculation_month DESC,
		         FIELD(t.role, 'Branch Manager', 'Team Lead', 'Salesperson'),
		         t.person ASC
		""",
		values,
		as_dict=True,
	)
