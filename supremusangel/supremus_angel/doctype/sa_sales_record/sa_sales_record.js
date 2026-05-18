// Copyright (c) 2026, Aniket Shinde and contributors
// For license information, please see license.txt

frappe.ui.form.on('SA Sales Record', {
	merchandise: function (frm) {
		if (!frm.doc.merchandise) return;
		frappe.db.get_doc('SA Merchandise', frm.doc.merchandise).then(doc => {
			frm.set_value('unit_definition', doc.unit_definition);
			frm.set_value('is_variable_value', doc.is_variable_value);
			if (!doc.is_variable_value) {
				frm.set_value('unit_value_inr', doc.unit_value_inr);
				_recalculate_total(frm, doc.unit_value_inr);
			} else {
				frm.set_value('unit_value_inr', 0);
				frm.set_value('total_sales_value', 0);
			}
		});
	},

	units_sold: function (frm) {
		_recalculate_total(frm, frm.doc.unit_value_inr);
	},

	unit_value_inr: function (frm) {
		_recalculate_total(frm, frm.doc.unit_value_inr);
	},
});

function _recalculate_total(frm, unit_value) {
	frm.set_value('total_sales_value', flt(frm.doc.units_sold) * flt(unit_value));
}
