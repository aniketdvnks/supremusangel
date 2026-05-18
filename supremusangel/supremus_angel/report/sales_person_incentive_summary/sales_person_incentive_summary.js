frappe.query_reports["Sales Person Incentive Summary"] = {
	filters: [
		{
			fieldname: "calculation_month",
			label: __("Month (YYYY-MM)"),
			fieldtype: "Data",
			default: frappe.datetime.get_today().substring(0, 7),
		},
		{
			fieldname: "sales_person",
			label: __("Sales Person"),
			fieldtype: "Link",
			options: "Sales Person",
		},
		{
			fieldname: "status",
			label: __("Status"),
			fieldtype: "Select",
			options: "\nCalculated\nApproved\nPaid",
		},
	],
};
