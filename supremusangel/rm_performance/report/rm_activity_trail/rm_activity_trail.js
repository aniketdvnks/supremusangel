// Copyright (c) 2026, Aniket Shinde and contributors
// For license information, please see license.txt

frappe.query_reports["RM Activity Trail"] = {
	filters: [
		{
			fieldname: "employee",
			label: __("RM"),
			fieldtype: "Link",
			options: "Employee",
			reqd: 1,
			get_query: () => ({ filters: { designation: "Wealth Relationship Manager" } }),
		},
		{
			fieldname: "from_date",
			label: __("From Date"),
			fieldtype: "Date",
			description: __("Blank means from the date they joined"),
		},
		{
			fieldname: "to_date",
			label: __("To Date"),
			fieldtype: "Date",
			default: frappe.datetime.get_today(),
		},
		{
			fieldname: "kpi",
			label: __("KPI"),
			fieldtype: "Select",
			options: ["", "1", "2", "3", "4", "5", "6", "7·8"],
		},
		{
			fieldname: "include_attendance",
			label: __("Include Attendance"),
			fieldtype: "Check",
			default: 0,
		},
	],
};
