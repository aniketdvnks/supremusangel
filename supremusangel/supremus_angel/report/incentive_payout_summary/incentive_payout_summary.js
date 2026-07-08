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
			// A Link control needs Read/Select on Sales Person. ESS users
			// (Branch Manager / Team Lead / Salesperson) only get report access
			// and are row-scoped to their own data, so fall back to a plain text
			// filter for them to avoid a permission error.
			fieldtype: (frappe.boot.user.can_read || []).includes("Sales Person") ? "Link" : "Data",
			options: (frappe.boot.user.can_read || []).includes("Sales Person")
				? "Sales Person"
				: undefined,
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
