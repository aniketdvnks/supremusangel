// Copyright (c) 2026, Aniket Shinde and contributors
// For license information, please see license.txt

frappe.query_reports["Incentive Payout Summary"] = {
	filters: [
		{
			fieldname: "calculation_month",
			label: __("Month (YYYY-MM)"),
			fieldtype: "Data",
			default: frappe.datetime.get_today().substring(0, 7),
		},
		{
			fieldname: "person",
			label: __("Person"),
			fieldtype: "Link",
			options: "Sales Person",
		},
		{
			fieldname: "role",
			label: __("Role"),
			fieldtype: "Select",
			options: "\nSalesperson\nTeam Lead\nBranch Manager",
		},
		{
			fieldname: "status",
			label: __("Status"),
			fieldtype: "Select",
			options: "\nCalculated\nApproved\nPaid",
		},
	],
};
