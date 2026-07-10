// Adds a "Create Sales Person" button to the Customer form.
//
// Creates a Sales Person named after the customer and places it under a chosen
// parent, so it lands in the right spot of the Sales Person tree — which is what
// the incentive engine uses to decide RM / TL / BM. Wired via `doctype_js` in
// supremusangel/hooks.py.

frappe.ui.form.on("Customer", {
	refresh(frm) {
		if (frm.is_new()) return;

		frm.add_custom_button(
			__("Create Sales Person"),
			() => open_create_sales_person_dialog(frm),
			__("Create"),
		);
	},
});

function open_create_sales_person_dialog(frm) {
	const d = new frappe.ui.Dialog({
		title: __("Create Sales Person"),
		fields: [
			{
				fieldname: "sales_person_name",
				fieldtype: "Data",
				label: __("Sales Person Name"),
				default: frm.doc.customer_name || frm.doc.name,
				reqd: 1,
			},
			{
				fieldname: "parent_sales_person",
				fieldtype: "Link",
				options: "Sales Person",
				label: __("Parent (where it falls in the tree)"),
				reqd: 1,
				description: __("The manager this person reports to. A leaf parent is promoted to a group automatically."),
			},
			{
				fieldname: "is_group",
				fieldtype: "Check",
				label: __("Is Manager (will lead a team)"),
				description: __("Tick for a Team Lead / Branch Manager so they classify correctly even before a team is added."),
			},
		],
		primary_action_label: __("Create"),
		primary_action(values) {
			frappe.call({
				method: "supremusangel.supremus_angel.sales_person_create.create_from_customer",
				args: {
					customer: frm.doc.name,
					sales_person_name: values.sales_person_name,
					parent_sales_person: values.parent_sales_person,
					is_group: values.is_group ? 1 : 0,
				},
				freeze: true,
				freeze_message: __("Creating Sales Person…"),
				callback(r) {
					if (!r.message) return;
					d.hide();
					const m = r.message;
					if (m.created) {
						let msg = __("Sales Person {0} created.", [m.sales_person]);
						if (m.promoted_parent) {
							msg += " " + __("Parent {0} was promoted to a group.", [m.parent]);
						}
						frappe.show_alert({ message: msg, indicator: "green" });
					} else {
						frappe.show_alert({
							message: __("This customer already has a Sales Person: {0}", [m.sales_person]),
							indicator: "orange",
						});
					}
					frappe.set_route("Form", "Sales Person", m.sales_person);
				},
			});
		},
	});
	d.show();
}
