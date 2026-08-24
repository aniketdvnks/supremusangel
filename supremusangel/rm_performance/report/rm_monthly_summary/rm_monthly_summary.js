// Copyright (c) 2026, Aniket Shinde and contributors
// For license information, please see license.txt

frappe.query_reports["RM Monthly Summary"] = {
	filters: [
		{
			fieldname: "month",
			label: __("Any Date in Month"),
			fieldtype: "Date",
			default: frappe.datetime.get_today(),
			reqd: 1,
		},
		{ fieldname: "branch", label: __("Branch"), fieldtype: "Link", options: "Branch" },
		{
			fieldname: "employee",
			label: __("RM"),
			fieldtype: "Link",
			options: "Employee",
			get_query: () => ({ filters: { designation: "Wealth Relationship Manager" } }),
		},
	],
};
