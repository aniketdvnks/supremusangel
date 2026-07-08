// Copyright (c) 2026, Aniket Shinde and contributors
// For license information, please see license.txt

frappe.ui.form.on('SA BM Incentive Calculation', {
	refresh: function (frm) {
		if (frm.doc.docstatus === 0) {
			frm.add_custom_button(__('Calculate'), function () {
				frm.call('calculate').then(() => {
					frm.reload_doc();
				});
			});
		}
	},

	calculation_month: function (frm) {
		const val = frm.doc.calculation_month || '';
		if (val.length >= 7 && !/^\d{4}-\d{2}$/.test(val)) {
			frappe.msgprint(__('Calculation Month must be in YYYY-MM format, e.g. 2026-05'));
		}
	},
});
