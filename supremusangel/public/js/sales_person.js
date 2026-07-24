// Shows the derived Incentive Role (RM / TL / BM) on the Sales Person form.
//
// The role is computed from the tree position on every load (never stored by
// hand, so it can't go stale). Wired via `doctype_js` in supremusangel/hooks.py.

frappe.ui.form.on("Sales Person", {
	refresh(frm) {
		if (frm.is_new()) return;

		frappe.call({
			method: "supremusangel.supremus_angel.sales_person_create.get_incentive_role",
			args: { sales_person: frm.doc.name },
			callback(r) {
				if (!r.message) return;
				const label = r.message.label || "";
				// Set without dirtying the form (read-only, display-only value).
				if (frm.doc.custom_incentive_role !== label) {
					frm.doc.custom_incentive_role = label;
					frm.refresh_field("custom_incentive_role");
				}
				const tone = { SA: "blue", TL: "green", BM: "orange" }[r.message.role] || "gray";
				frm.dashboard.add_indicator(__("Incentive Role: {0}", [label]), tone);
			},
		});
	},
});
