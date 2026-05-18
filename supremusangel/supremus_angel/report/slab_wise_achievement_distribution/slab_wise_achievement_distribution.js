frappe.query_reports["Slab-wise Achievement Distribution"] = {
	filters: [
		{
			fieldname: "calculation_month",
			label: __("Month (YYYY-MM)"),
			fieldtype: "Data",
			default: frappe.datetime.get_today().substring(0, 7),
		},
	],
};
