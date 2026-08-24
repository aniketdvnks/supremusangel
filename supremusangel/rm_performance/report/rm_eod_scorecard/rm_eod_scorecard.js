// Copyright (c) 2026, Aniket Shinde and contributors
// For license information, please see license.txt

frappe.query_reports["RM EOD Scorecard"] = {
	filters: [
		{
			fieldname: "from_date",
			label: __("From Date"),
			fieldtype: "Date",
			default: frappe.datetime.add_days(frappe.datetime.get_today(), -6),
			reqd: 1,
		},
		{
			fieldname: "to_date",
			label: __("To Date"),
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
		{
			fieldname: "reports_to",
			label: __("Reporting Manager"),
			fieldtype: "Link",
			options: "Employee",
		},
		{
			fieldname: "flag",
			label: __("Flag"),
			fieldtype: "Select",
			options: ["", "Green", "Orange", "Red"],
		},
	],
};
