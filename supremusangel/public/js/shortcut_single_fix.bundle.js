frappe.provide("frappe.widget");

/*
 * Fix: workspace shortcuts pointing to a Single DocType raise a server-side
 * TableMissingError on every workspace load.
 *
 * Root cause (Frappe core, shortcut_widget.js -> set_actions):
 *     let filters = frappe.utils.process_filter_expression(this.stats_filter);
 *     if (this.type == "DocType" && this.doc_view != "New" && filters) {
 *         frappe.db.count(this.link_to, { filters });  // -> reportview.get_count
 *     }
 * process_filter_expression(undefined) returns [] which is TRUTHY in JS, so the
 * count badge is fetched even for shortcuts without a stats_filter. Single
 * DocTypes have no table (data lives in `tabSingles`), so get_count throws
 * TableMissingError. Frappe's own widget_dialog.js already special-cases singles
 * (hides filters/views); this patches the runtime widget to match.
 *
 * Approach: for Single-doctype shortcuts only, temporarily present doc_view as
 * "New" during set_actions() so the core guard short-circuits. set_actions()
 * uses doc_view nowhere else, and it is restored immediately, so click routing
 * and every other behaviour are untouched.
 */
$(document).on("app_ready", function () {
	const factory = frappe.widget && frappe.widget.widget_factory;
	const ShortcutWidget = factory && factory.shortcut;
	const proto = ShortcutWidget && ShortcutWidget.prototype;

	if (!proto || proto.__sa_single_count_patch) {
		return;
	}

	const orig_set_actions = proto.set_actions;
	if (typeof orig_set_actions !== "function") {
		return;
	}

	proto.set_actions = function () {
		const singles = (frappe.boot && frappe.boot.single_types) || [];
		const is_single = this.type === "DocType" && singles.includes(this.link_to);

		if (!is_single) {
			return orig_set_actions.apply(this, arguments);
		}

		const saved_doc_view = this.doc_view;
		this.doc_view = "New";
		try {
			return orig_set_actions.apply(this, arguments);
		} finally {
			this.doc_view = saved_doc_view;
		}
	};

	proto.__sa_single_count_patch = true;
});
