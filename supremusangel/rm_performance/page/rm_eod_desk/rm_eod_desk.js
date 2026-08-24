// Copyright (c) 2026, Aniket Shinde and contributors
// For license information, please see license.txt

frappe.provide("supremusangel");

frappe.pages["rm-eod-desk"].on_page_load = function (wrapper) {
	if (!wrapper.rmEodDesk) {
		wrapper.rmEodDesk = new supremusangel.RMEodDesk(wrapper);
	}
};

frappe.pages["rm-eod-desk"].on_page_show = function (wrapper) {
	wrapper.rmEodDesk && wrapper.rmEodDesk.refresh();
};

supremusangel.RMEodDesk = class RMEodDesk {
	constructor(wrapper) {
		this.wrapper = wrapper;
		this.$wrapper = $(wrapper);
		this.rows = [];
		this.activeFlag = "";
		this.searchTimeout = null;

		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: __("RM EOD Desk"),
			single_column: true,
		});

		this.make_filters();
		this.make_actions();
		this.make_body();
		this.refresh();
	}

	make_filters() {
		this.date_field = this.page.add_field({
			fieldname: "date",
			label: __("Date"),
			fieldtype: "Date",
			default: frappe.datetime.get_today(),
			change: () => this.refresh(),
		});
		this.date_field.set_value(frappe.datetime.get_today());

		this.branch_field = this.page.add_field({
			fieldname: "branch",
			label: __("Branch"),
			fieldtype: "Link",
			options: "Branch",
			change: () => this.refresh(),
		});

		this.search_field = this.page.add_field({
			fieldname: "search",
			label: __("Search RM"),
			fieldtype: "Data",
			change: () => {
				clearTimeout(this.searchTimeout);
				this.searchTimeout = setTimeout(() => this.refresh(), 300);
			},
		});
	}

	make_actions() {
		this.page.set_secondary_action(__("Refresh"), () => this.refresh(), "refresh");

		this.page.add_inner_button(__("Rebuild This Day"), () => this.rebuild());
		this.page.add_inner_button(__("EOD Scorecard Report"), () =>
			frappe.set_route("query-report", "RM EOD Scorecard", {
				from_date: this.current_date(),
				to_date: this.current_date(),
			})
		);
		this.page.add_inner_button(__("Monthly Summary"), () =>
			frappe.set_route("query-report", "RM Monthly Summary", { month: this.current_date() })
		);
		this.page.add_inner_button(__("KPI Settings"), () =>
			frappe.set_route("Form", "RM KPI Settings")
		);
	}

	make_body() {
		this.$body = $(`
			<div class="rm-eod-root">
				<div class="rm-eod-mode-banner" style="display:none"></div>
				<div class="rm-eod-summary"></div>
				<div class="rm-eod-table-wrap"></div>
			</div>
		`).appendTo(this.page.main);

		this.$banner = this.$body.find(".rm-eod-mode-banner");
		this.$summary = this.$body.find(".rm-eod-summary");
		this.$table = this.$body.find(".rm-eod-table-wrap");
	}

	current_date() {
		return this.date_field.get_value() || frappe.datetime.get_today();
	}

	refresh() {
		frappe.call({
			method: "supremusangel.rm_performance.api.get_eod_board",
			args: {
				date: this.current_date(),
				branch: this.branch_field.get_value() || null,
				search: this.search_field.get_value() || null,
			},
			callback: (r) => {
				if (!r.message) return;
				this.data = r.message;
				this.rows = r.message.rows || [];
				this.render();
			},
		});
	}

	rebuild() {
		frappe.call({
			method: "supremusangel.rm_performance.api.rebuild",
			args: { date: this.current_date() },
			freeze: true,
			freeze_message: __("Rebuilding scorecards…"),
			callback: (r) => {
				frappe.show_alert({
					message: __("Rebuilt {0} scorecard(s)", [(r.message && r.message.built) || 0]),
					indicator: "green",
				});
				this.refresh();
			},
		});
	}

	render() {
		this.render_banner();
		this.render_summary();
		this.render_table();
	}

	render_banner() {
		if (this.data.evaluation_mode === "Observation Only") {
			this.$banner
				.html(
					__(
						"Observation mode — flags are visible for coaching but are not an official performance record. Change this in RM KPI Settings."
					)
				)
				.show();
		} else {
			this.$banner.hide();
		}
	}

	render_summary() {
		const s = this.data.summary || {};
		const cards = [
			{ key: "", label: __("RMs in View"), value: s.total || 0, cls: "" },
			{ key: "Green", label: __("Green"), value: s.green || 0, cls: "green" },
			{ key: "Orange", label: __("Orange"), value: s.orange || 0, cls: "orange" },
			{ key: "Red", label: __("Red"), value: s.red || 0, cls: "red" },
			{ key: "__notlogged", label: __("Logged Nothing"), value: s.not_logged || 0, cls: "" },
		];

		this.$summary.empty();
		cards.forEach((card) => {
			const active = this.activeFlag === card.key ? "is-active" : "";
			$(`
				<div class="rm-eod-stat ${card.cls} ${active}" data-key="${card.key}">
					<div class="label">${card.label}</div>
					<div class="value">${card.value}</div>
				</div>
			`)
				.appendTo(this.$summary)
				.on("click", () => {
					this.activeFlag = this.activeFlag === card.key ? "" : card.key;
					this.render();
				});
		});
	}

	visible_rows() {
		if (!this.activeFlag) return this.rows;
		if (this.activeFlag === "__notlogged") return this.rows.filter((r) => !r.prospects);
		return this.rows.filter((r) => r.flag === this.activeFlag);
	}

	render_table() {
		const rows = this.visible_rows();
		if (!rows.length) {
			this.$table.html(
				`<div class="rm-eod-empty">${__("No RMs match this view.")}</div>`
			);
			return;
		}

		const body = rows.map((row) => this.row_html(row)).join("");
		this.$table.html(`
			<table class="rm-eod-table">
				<thead>
					<tr>
						<th>${__("Flag")}</th>
						<th>${__("RM")}</th>
						<th>${__("Branch")}</th>
						<th>${__("Reporting Manager")}</th>
						<th>${__("Points")}</th>
						<th>${__("Pointers")}</th>
						<th>${__("Prospects")}</th>
						<th>${__("Attendance")}</th>
					</tr>
				</thead>
				<tbody>${body}</tbody>
			</table>
		`);

		this.$table.find("tbody tr").on("click", (e) => {
			this.show_day($(e.currentTarget).data("employee"));
		});
	}

	row_html(row) {
		const dots = (row.pointers || [])
			.map((p) => `<span class="${p.met ? "met" : ""}" title="${frappe.utils.escape_html(p.label)}">${p.no}</span>`)
			.join("");

		const prospects = `${row.prospects || 0} / ${row.prospect_target || 0}`;
		const missing = row.has_scorecard ? "" : ` <span class="text-muted">(${__("not built")})</span>`;

		return `
			<tr data-employee="${row.employee}">
				<td><span class="rm-flag ${(row.flag || "red").toLowerCase()}"></span>${row.flag || "-"}</td>
				<td>
					<div>${frappe.utils.escape_html(row.employee_name || row.employee)}</div>
					<div class="text-muted small">${frappe.utils.escape_html(row.employee)}</div>
				</td>
				<td>${frappe.utils.escape_html(row.branch || "-")}</td>
				<td>${frappe.utils.escape_html(row.manager || "-")}</td>
				<td>${row.points_met || 0} / ${row.total_points || 8}${missing}</td>
				<td><span class="rm-dots">${dots}</span></td>
				<td>${prospects}</td>
				<td>${frappe.utils.escape_html(row.attendance_status || "-")}</td>
			</tr>
		`;
	}

	show_day(employee) {
		frappe.call({
			method: "supremusangel.rm_performance.api.get_rm_day",
			args: { employee: employee, date: this.current_date() },
			freeze: true,
			callback: (r) => {
				if (!r.message) return;
				this.render_day_dialog(r.message);
			},
		});
	}

	render_day_dialog(data) {
		const emp = data.employee || {};
		const dialog = new frappe.ui.Dialog({
			title: __("{0} — {1}", [emp.employee_name || emp.name, data.date]),
			size: "large",
			fields: [{ fieldtype: "HTML", fieldname: "body" }],
		});

		dialog.fields_dict.body.$wrapper.html(this.day_html(data));
		dialog.set_primary_action(__("Full Activity Trail"), () => {
			dialog.hide();
			frappe.set_route("query-report", "RM Activity Trail", { employee: emp.name });
		});
		dialog.show();

		// Trend loads after the dialog is up so it never delays the drill-down.
		frappe.call({
			method: "supremusangel.rm_performance.api.get_rm_trend",
			args: { employee: emp.name, days: 30 },
			callback: (r) => {
				if (!r.message) return;
				dialog.fields_dict.body.$wrapper
					.find(".rm-trend")
					.html(this.trend_html(r.message.rows || []));
			},
		});
	}

	day_html(data) {
		const s = data.summary;
		const flag = (s && s.flag) || "Red";

		const header = s
			? `<div class="rm-day-head">
					<div class="rm-day-flag ${flag.toLowerCase()}">
						<span class="dot"></span>${flag}
					</div>
					<div class="rm-day-score">
						<b>${s.points_met} / ${s.total_points}</b>
						<span>${__("pointers met")} · ${s.compliance_percent || 0}%</span>
					</div>
					<div class="rm-day-att">
						${__("Attendance")}: <b>${frappe.utils.escape_html(s.attendance_status || "—")}</b>
						${s.working_hours ? ` · ${s.working_hours} ${__("hrs")}` : ""}
						${s.first_checkin ? `<br><span class="text-muted">${__("In")} ${String(s.first_checkin).slice(11, 16)}${s.last_checkout ? ` · ${__("Out")} ${String(s.last_checkout).slice(11, 16)}` : ""}</span>` : ""}
					</div>
				</div>`
			: `<div class="rm-day-head"><div class="text-muted">${__("No scorecard was built for this day.")}</div></div>`;

		const pointers = (data.pointers || []).map((p) => this.pointer_html(p)).join("");

		return `
			<div>
				${header}

				<div class="rm-day-section-title">${__("30-day trend")}
					<span class="rm-legend">
						<i class="green"></i>${__("Green")}
						<i class="orange"></i>${__("Orange")}
						<i class="red"></i>${__("Red")}
						<span class="text-muted">— ${__("bar height = pointers met")}</span>
					</span>
				</div>
				<div class="rm-trend"><span class="text-muted small">${__("Loading…")}</span></div>

				<div class="rm-day-section-title">${__("The eight pointers")}</div>
				${pointers || `<div class="text-muted">${__("Nothing to show.")}</div>`}

				${this.table_html(
					__("Prospects contacted today"),
					[__("Prospect"), __("Channel"), __("Mode"), __("Outcome")],
					(data.activity.prospects || []).map((p) => [
						`<a href="/app/lead/${encodeURIComponent(p.lead)}">${frappe.utils.escape_html(p.lead_name || p.lead)}</a>`,
						frappe.utils.escape_html(p.channel || "—"),
						frappe.utils.escape_html(p.mode || "—"),
						frappe.utils.escape_html(p.outcome || "—"),
					]),
					__("No prospect was logged on this day.")
				)}

				${this.table_html(
					__("Meetings today"),
					[__("Subject"), __("Support"), __("Venue"), __("Status")],
					(data.activity.meetings || []).map((m) => [
						`<a href="/app/event/${encodeURIComponent(m.name)}">${frappe.utils.escape_html(m.subject || m.name)}</a>`,
						frappe.utils.escape_html(m.custom_meeting_support || "—"),
						frappe.utils.escape_html(m.custom_venue_type || "—"),
						frappe.utils.escape_html(m.status || "—"),
					]),
					__("No meeting was logged on this day.")
				)}

				${this.table_html(
					__("Check-ins"),
					[__("Time"), __("Type"), __("Location")],
					(data.activity.checkins || []).map((c) => [
						String(c.time).slice(11, 16),
						frappe.utils.escape_html(c.log_type || "—"),
						c.latitude ? `${c.latitude}, ${c.longitude}` : "—",
					]),
					__("No check-in recorded on this day.")
				)}
			</div>
		`;
	}

	pointer_html(p) {
		// The gap is the useful number: not "5 required" but "1 more to go".
		let right = "";
		if (p.met) {
			right = `<span class="rm-p-ok">${__("Met")}</span>`;
		} else if (p.gap) {
			right = `<span class="rm-p-gap">${p.gap} ${__("more")}</span>`;
		} else {
			right = `<span class="rm-p-gap">${__("Not met")}</span>`;
		}

		const unit = p.unit ? ` ${frappe.utils.escape_html(p.unit)}` : "";
		const value =
			typeof p.actual === "number"
				? `<b>${p.actual}</b> ${__("of")} ${p.target}${unit}`
				: `<b>${frappe.utils.escape_html(String(p.actual))}</b> <span class="text-muted">(${__("needs")} ${frappe.utils.escape_html(String(p.target))})</span>`;

		const subs = (p.subs || [])
			.map(
				(sub) => `
				<div class="rm-p-sub ${sub.met ? "met" : ""}">
					<span>${sub.met ? "✓" : "✗"} ${frappe.utils.escape_html(sub.label)}</span>
					<span>${sub.actual} / ${sub.target} <span class="text-muted">${frappe.utils.escape_html(sub.period)}</span>${
						!sub.met && sub.gap ? ` — <b>${sub.gap} ${__("more")}</b>` : ""
					}</span>
				</div>`
			)
			.join("");

		return `
			<div class="rm-day-pointer ${p.met ? "met" : ""}">
				<div class="rm-p-main">
					<div class="rm-p-title">
						<span class="no">${p.no}</span>
						<span>${frappe.utils.escape_html(p.label)}</span>
					</div>
					<div class="rm-p-value">
						<div>${value}</div>
						<div class="meta">${frappe.utils.escape_html(p.period || "")}${p.note ? " · " + frappe.utils.escape_html(p.note) : ""}</div>
					</div>
					<div class="rm-p-verdict">${right}</div>
				</div>
				${subs ? `<div class="rm-p-subs">${subs}</div>` : ""}
			</div>
		`;
	}

	table_html(title, headers, rows, emptyText) {
		const head = headers.map((h) => `<th>${h}</th>`).join("");
		const body = rows.length
			? rows.map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")
			: `<tr><td colspan="${headers.length}" class="text-muted">${emptyText}</td></tr>`;
		return `
			<div class="rm-day-section-title">${title} <span class="text-muted">(${rows.length})</span></div>
			<table class="rm-eod-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
		`;
	}

	trend_html(rows) {
		if (!rows.length) return `<span class="text-muted small">${__("No history yet")}</span>`;
		const bars = rows
			.map((row) => {
				const pct = row.total_points
					? Math.round((row.points_met / row.total_points) * 100)
					: 0;
				const height = Math.max(4, Math.round((pct / 100) * 40));
				const cls = (row.flag || "Red").toLowerCase();
				const title = `${row.scorecard_date} — ${row.points_met}/${row.total_points} ${__("pointers")} · ${row.kpi1_actual || 0} ${__("prospects")}`;
				return `<i class="${cls}" style="height:${height}px" title="${title}"></i>`;
			})
			.join("");
		return `${bars}<span class="rm-trend-range">${rows[0].scorecard_date} → ${rows[rows.length - 1].scorecard_date}</span>`;
	}
};
