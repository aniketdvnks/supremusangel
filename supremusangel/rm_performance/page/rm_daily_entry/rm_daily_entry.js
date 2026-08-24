// Copyright (c) 2026, Aniket Shinde and contributors
// For license information, please see license.txt

frappe.provide("supremusangel");

frappe.pages["rm-daily-entry"].on_page_load = function (wrapper) {
	if (!wrapper.rmDailyEntry) {
		wrapper.rmDailyEntry = new supremusangel.RMDailyEntry(wrapper);
	}
};

frappe.pages["rm-daily-entry"].on_page_show = function (wrapper) {
	wrapper.rmDailyEntry && wrapper.rmDailyEntry.refresh();
};

supremusangel.RMDailyEntry = class RMDailyEntry {
	constructor(wrapper) {
		this.wrapper = wrapper;
		this.selectedLead = null;
		this.searchTimeout = null;

		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: __("My Daily Prospects"),
			single_column: true,
		});

		this.make_body();
		this.refresh();
	}

	make_body() {
		this.$body = $(`
			<div class="rm-entry-root">
				<div class="rm-entry-progress"></div>
				<div class="rm-entry-form"></div>
				<h5>${__("Logged today")}</h5>
				<div class="rm-entry-list"></div>
			</div>
		`).appendTo(this.page.main);

		this.$progress = this.$body.find(".rm-entry-progress");
		this.$form = this.$body.find(".rm-entry-form");
		this.$list = this.$body.find(".rm-entry-list");

		this.make_form();
	}

	make_form() {
		this.$form.html(`
			<div class="row">
				<div class="col-sm-6 rm-f-name"></div>
				<div class="col-sm-6 rm-f-mobile"></div>
			</div>
			<div class="rm-entry-suggestions" style="display:none"></div>
			<div class="row">
				<div class="col-sm-4 rm-f-channel"></div>
				<div class="col-sm-4 rm-f-mode"></div>
				<div class="col-sm-4 rm-f-outcome"></div>
			</div>
			<div class="row">
				<div class="col-sm-6 rm-f-followup"></div>
				<div class="col-sm-6 rm-f-remark"></div>
			</div>
			<div style="margin-top:12px">
				<button class="btn btn-primary btn-sm rm-save">${__("Log Contact")}</button>
				<button class="btn btn-default btn-sm rm-clear">${__("Clear")}</button>
				<span class="rm-linked text-muted small" style="margin-left:10px"></span>
			</div>
		`);

		const mk = (selector, opts) =>
			frappe.ui.form.make_control({
				parent: this.$form.find(selector),
				df: opts,
				render_input: true,
			});

		this.f_name = mk(".rm-f-name", {
			fieldname: "lead_name",
			label: __("Prospect Name"),
			fieldtype: "Data",
			reqd: 1,
			change: () => this.on_name_typed(),
		});
		this.f_mobile = mk(".rm-f-mobile", {
			fieldname: "mobile_no",
			label: __("Mobile No"),
			fieldtype: "Data",
		});
		this.f_channel = mk(".rm-f-channel", {
			fieldname: "channel",
			label: __("Channel"),
			fieldtype: "Select",
			options: [
				"",
				"Personal Networking",
				"Reference",
				"Digital Outreach",
				"Company Data",
			],
			reqd: 1,
		});
		this.f_mode = mk(".rm-f-mode", {
			fieldname: "mode",
			label: __("Mode"),
			fieldtype: "Select",
			options: ["", "Call", "WhatsApp", "Email", "In Person", "Meeting"],
		});
		this.f_outcome = mk(".rm-f-outcome", {
			fieldname: "outcome",
			label: __("Outcome"),
			fieldtype: "Select",
			options: [
				"",
				"Connected",
				"Not Picked",
				"Wrong Number",
				"Interested",
				"Not Interested",
				"DND",
			],
		});
		this.f_followup = mk(".rm-f-followup", {
			fieldname: "next_follow_up",
			label: __("Next Follow Up"),
			fieldtype: "Date",
		});
		this.f_remark = mk(".rm-f-remark", {
			fieldname: "remark",
			label: __("Remark"),
			fieldtype: "Data",
		});

		this.$suggestions = this.$form.find(".rm-entry-suggestions");
		this.$form.find(".rm-save").on("click", () => this.save());
		this.$form.find(".rm-clear").on("click", () => this.clear());
	}

	on_name_typed() {
		const value = this.f_name.get_value();
		// Typing a fresh name detaches any previously picked Lead.
		this.selectedLead = null;
		this.$form.find(".rm-linked").text("");

		clearTimeout(this.searchTimeout);
		if (!value || value.length < 2) {
			this.$suggestions.hide();
			return;
		}
		this.searchTimeout = setTimeout(() => {
			frappe.call({
				method: "supremusangel.rm_performance.api.search_leads",
				args: { query: value },
				callback: (r) => this.render_suggestions(r.message || []),
			});
		}, 300);
	}

	render_suggestions(rows) {
		if (!rows.length) {
			this.$suggestions.hide();
			return;
		}
		this.$suggestions
			.html(
				rows
					.map(
						(row) =>
							`<div data-lead="${row.name}" data-name="${frappe.utils.escape_html(row.lead_name || "")}">
								<b>${frappe.utils.escape_html(row.lead_name || row.name)}</b>
								<span class="text-muted">${frappe.utils.escape_html(row.mobile_no || "")} · ${frappe.utils.escape_html(row.status || "")}</span>
							</div>`
					)
					.join("")
			)
			.show();

		this.$suggestions.find("div").on("click", (e) => {
			const $el = $(e.currentTarget);
			this.selectedLead = $el.data("lead");
			this.f_name.set_value($el.data("name") || this.selectedLead);
			this.$form
				.find(".rm-linked")
				.text(__("Logging against existing lead {0}", [this.selectedLead]));
			this.$suggestions.hide();
		});
	}

	save() {
		if (!this.f_name.get_value()) {
			frappe.msgprint(__("Enter the prospect's name."));
			return;
		}
		if (!this.f_channel.get_value()) {
			frappe.msgprint(__("Choose how you reached this prospect."));
			return;
		}

		frappe.call({
			method: "supremusangel.rm_performance.api.log_prospect",
			args: {
				lead: this.selectedLead || null,
				lead_name: this.f_name.get_value(),
				mobile_no: this.f_mobile.get_value(),
				channel: this.f_channel.get_value(),
				mode: this.f_mode.get_value(),
				outcome: this.f_outcome.get_value(),
				next_follow_up: this.f_followup.get_value(),
				remark: this.f_remark.get_value(),
			},
			freeze: true,
			freeze_message: __("Saving…"),
			callback: (r) => {
				if (!r.message) return;
				frappe.show_alert({ message: __("Contact logged"), indicator: "green" });
				this.clear();
				this.render(r.message);
			},
		});
	}

	clear() {
		this.selectedLead = null;
		[
			this.f_name,
			this.f_mobile,
			this.f_mode,
			this.f_outcome,
			this.f_followup,
			this.f_remark,
		].forEach((f) => f.set_value(""));
		this.$form.find(".rm-linked").text("");
		this.$suggestions.hide();
	}

	refresh() {
		frappe.call({
			method: "supremusangel.rm_performance.api.get_my_context",
			callback: (r) => r.message && this.render(r.message),
		});
	}

	render(data) {
		if (!data.employee) {
			this.$progress.html(
				`<div class="rm-entry-empty">${__(
					"Your user is not linked to an Employee record, so nothing can be logged against you. Ask HR to set the User ID on your Employee."
				)}</div>`
			);
			this.$form.hide();
			return;
		}

		const target = data.target || 0;
		const logged = data.logged || 0;
		const pct = target ? Math.min(100, Math.round((logged / target) * 100)) : 0;
		const done = logged >= target;

		this.$progress.html(`
			<div class="headline">
				<div>
					<span class="count">${logged}</span>
					<span class="of">/ ${target} ${__("prospects today")}</span>
				</div>
				<div class="text-muted">${frappe.utils.escape_html(data.employee.employee_name || "")} · ${data.date}</div>
			</div>
			<div class="rm-entry-bar"><div class="${done ? "done" : ""}" style="width:${pct}%"></div></div>
			<div class="text-muted small" style="margin-top:8px">
				${done ? __("Target met for today.") : __("{0} more to hit today's minimum.", [data.remaining])}
			</div>
		`);

		this.render_list(data.entries || []);
	}

	render_list(entries) {
		if (!entries.length) {
			this.$list.html(`<div class="rm-entry-empty">${__("Nothing logged yet today.")}</div>`);
			return;
		}
		this.$list.html(
			entries
				.map(
					(row) => `
			<div class="rm-entry-list-item">
				<div>
					<div><a href="/app/lead/${encodeURIComponent(row.lead)}">${frappe.utils.escape_html(row.lead_name || row.lead)}</a></div>
					<div class="meta">
						${frappe.utils.escape_html(row.mobile_no || "")}
						${row.channel ? "· " + frappe.utils.escape_html(row.channel) : ""}
						${row.outcome ? "· " + frappe.utils.escape_html(row.outcome) : ""}
					</div>
				</div>
				<button class="btn btn-xs btn-default rm-del" data-row="${row.row_name}">${__("Remove")}</button>
			</div>`
				)
				.join("")
		);

		this.$list.find(".rm-del").on("click", (e) => {
			const rowName = $(e.currentTarget).data("row");
			frappe.confirm(__("Remove this entry?"), () => {
				frappe.call({
					method: "supremusangel.rm_performance.api.delete_entry",
					args: { row_name: rowName },
					callback: (r) => r.message && this.render(r.message),
				});
			});
		});
	}
};
