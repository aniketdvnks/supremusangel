frappe.pages["interview_wizard"].on_page_load = function (wrapper) {
    frappe.ui.make_app_page({ parent: wrapper, title: __("Interview Clearing Wizard"), single_column: true });
    wrapper.__wizard = new InterviewWizard(wrapper);
};

frappe.pages["interview_wizard"].on_page_show = function (wrapper) {
    if (wrapper.__wizard) wrapper.__wizard.on_show();
};

/* ═══════════════════════════════════════════════════════════════════ */
class InterviewWizard {
    constructor(wrapper) {
        this.$w = $(wrapper).find(".page-content");
        this.applicant = null;          // selected applicant id
        this.applicant_doc = null;
        this.interviews = [];
        this.search_term = "";
        this._render_layout();
        this._load_list();
    }

    on_show() { /* nothing needed */ }

    /* ── LAYOUT ─────────────────────────────────────────────────── */
    _render_layout() {
        this.$w.addClass("iw-root").html(`
            <div class="iw-shell">
                <div class="iw-left">
                    <div class="iw-search-wrap">
                        <input class="iw-search form-control" placeholder="${__("Search applicant…")}" />
                    </div>
                    <div class="iw-list" id="iw-list">
                        <div class="iw-list-msg">${this._spin()} ${__("Loading…")}</div>
                    </div>
                </div>
                <div class="iw-right" id="iw-right">${this._empty_state()}</div>
            </div>
        `);

        let t;
        this.$w.find(".iw-search").on("input", e => {
            clearTimeout(t);
            t = setTimeout(() => { this.search_term = e.target.value.trim(); this._load_list(); }, 280);
        });
    }

    /* ── APPLICANT LIST ─────────────────────────────────────────── */
    async _load_list() {
        const $list = this.$w.find("#iw-list");
        try {
            const r = await frappe.call({
                method: "supremusangel.supremus_angel.interview_wizard_api.get_job_applicants",
                args: { search_term: this.search_term },
            });
            this._render_list(r.message || [], $list);
        } catch (_) {
            $list.html(`<div class="iw-list-msg text-danger">${__("Failed to load")}</div>`);
        }
    }

    _render_list(rows, $list) {
        if (!rows.length) {
            $list.html(`<div class="iw-list-msg text-muted">${__("No applicants found")}</div>`);
            return;
        }
        $list.html(rows.map(a => {
            const active = a.name === this.applicant ? " iw-row-active" : "";
            const sc = { Open: "open", Replied: "replied", Hold: "hold" }[a.status] || "open";
            return `
            <div class="iw-row${active}" data-id="${a.name}">
                <div class="iw-av">${(a.applicant_name || "?")[0].toUpperCase()}</div>
                <div class="iw-row-body">
                    <div class="iw-row-name">${frappe.utils.escape_html(a.applicant_name)}</div>
                    <div class="iw-row-sub">${frappe.utils.escape_html(a.email_id || "")}</div>
                    ${a.job_title ? `<div class="iw-row-sub">${frappe.utils.escape_html(a.job_title)}</div>` : ""}
                </div>
                <span class="iw-dot iw-dot-${sc}"></span>
            </div>`;
        }).join(""));

        $list.find(".iw-row").on("click", e => {
            const id = $(e.currentTarget).data("id");
            this._select(id);
        });
    }

    /* ── SELECT APPLICANT ───────────────────────────────────────── */
    async _select(id) {
        if (this.applicant === id) return;
        this.applicant = id;
        this.$w.find(".iw-row").removeClass("iw-row-active");
        this.$w.find(`.iw-row[data-id="${id}"]`).addClass("iw-row-active");
        this._set_right(`<div class="iw-right-loading">${this._spin("lg")} <span>${__("Loading rounds…")}</span></div>`);
        await this._load_right();
    }

    async _load_right() {
        try {
            const [dr, ir] = await Promise.all([
                frappe.call({ method: "supremusangel.supremus_angel.interview_wizard_api.get_applicant_details", args: { job_applicant: this.applicant } }),
                frappe.call({ method: "supremusangel.supremus_angel.interview_wizard_api.get_applicant_interviews", args: { job_applicant: this.applicant } }),
            ]);
            this.applicant_doc = dr.message;
            this.interviews = ir.message || [];
            this._render_right();
        } catch (e) {
            this._set_right(`<div class="iw-right-loading text-danger">${e.message || __("Error loading data")}</div>`);
        }
    }

    /* ── RIGHT PANEL ────────────────────────────────────────────── */
    _render_right() {
        const d = this.applicant_doc;
        const ivs = this.interviews;
        const total = ivs.length;
        const cleared = ivs.filter(i => i.status === "Cleared" && i.docstatus === 1).length;
        const all_clear = total > 0 && cleared === total;
        const pct = total ? Math.round(cleared / total * 100) : 0;

        const status_color = { Open: "open", Replied: "replied", Hold: "hold", Accepted: "cleared" }[d.status] || "open";

        const rounds_html = total
            ? ivs.map((iv, idx) => this._round_card(iv, idx)).join("")
            : `<div class="iw-no-rounds">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".35"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <p>${__("No interview rounds scheduled yet.")}</p>
              </div>`;

        this._set_right(`
        <div class="iw-detail-wrap">

            <!-- Applicant header -->
            <div class="iw-appl-header">
                <div class="iw-av iw-av-lg">
				 ${(d.applicant_name || "?")[0].toUpperCase()}</div>
                <div class="iw-appl-info">
                    <div class="iw-appl-name"><a href="/app/job-applicant/${d.email_id}">${frappe.utils.escape_html(d.applicant_name)}</a></div>
                    <div class="iw-appl-meta">
                        ${d.email_id ? `<span>${frappe.utils.escape_html(d.email_id)}</span>` : ""}
                        ${d.phone_number ? `<span>${frappe.utils.escape_html(d.phone_number)}</span>` : ""}
                        ${d.job_title ? `<span>${frappe.utils.escape_html(d.job_title)}</span>` : ""}
                        ${d.designation ? `<span>${frappe.utils.escape_html(d.designation)}</span>` : ""}
                    </div>
                </div>
                <div class="iw-appl-actions">Status
                    <span class="iw-badge iw-badge-${status_color}">${__(d.status)}</span>
                    <button class="btn btn-xs btn-default iw-refresh-btn" title="${__("Refresh")}">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                    </button>
                </div>
            </div>

            <!-- Progress bar -->
            <div class="iw-prog-wrap">
                <div class="iw-prog-row">
                    <span class="iw-prog-label">${__("Rounds Cleared")}</span>
                    <span class="iw-prog-count"><strong>${cleared}</strong> / ${total}</span>
                </div>
                <div class="iw-prog-track"><div class="iw-prog-fill" style="width:${pct}%"></div></div>
            </div>

            <!-- Round cards -->
            <div class="iw-rounds" id="iw-rounds">${rounds_html}</div>

            <!-- Footer actions -->
            <div class="iw-footer-actions">
                <button class="btn btn-default iw-add-btn" id="iw-add-round">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    ${__("Schedule Interview Round")}
                </button>
                ${all_clear ? `
                <button class="btn btn-success iw-accept-btn" id="iw-accept">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    ${__("Mark as Selected")}
                </button>` : ""}
            </div>

        </div>`);

        /* bind events */
        this.$w.find(".iw-refresh-btn").on("click", () => this._load_right());
        this.$w.find("#iw-add-round").on("click", () => this._open_schedule_dialog());
        this.$w.find("#iw-accept").on("click", () => this._mark_accepted());

        this.$w.find(".iw-edit-btn").on("click", e => {
            const name = $(e.currentTarget).data("name");
            const iv = this.interviews.find(i => i.name === name);
            if (iv) this._open_schedule_dialog(iv);
        });

        this.$w.find(".iw-toggle-fb").on("click", e => {
            const name = $(e.currentTarget).data("name");
            this.$w.find(`#fb-${name}`).slideToggle(160);
            const $ico = $(e.currentTarget).find(".iw-chevron");
            $ico.toggleClass("iw-chevron-open");
        });
    }

    /* ── ROUND CARD ─────────────────────────────────────────────── */
    _round_card(iv, idx) {
        const s = iv.status;
        const submitted = iv.docstatus === 1;

        let state, icon;
        if (!submitted) {
            state = "draft"; icon = this._ico_clock();
        } else if (s === "Cleared") {
            state = "cleared"; icon = this._ico_check();
        } else if (s === "Rejected") {
            state = "rejected"; icon = this._ico_x();
        } else if (s === "Selected") {
                    state = "selected"; icon = this._ico_check();
                } else if (s === "Under Review") {
            state = "review"; icon = this._ico_eye();
        } else {
            state = "pending"; icon = this._ico_clock();
        }

        const label = submitted ? __(s) : __("Draft – Not Submitted");

        const date_str = iv.scheduled_on
            ? frappe.datetime.str_to_user(iv.scheduled_on)
            : `<em class="text-muted">${__("Date not set")}</em>`;

        const time_str = (iv.from_time && iv.to_time)
            ? `${iv.from_time.substring(0,5)} – ${iv.to_time.substring(0,5)}`
            : "";

        const interviewers_html = (iv.interviewers || []).length
            ? iv.interviewers.map(u => `<span class="iw-chip">${frappe.utils.escape_html(u)}</span>`).join("")
            : `<span class="text-muted">${__("No interviewers assigned")}</span>`;

        const rating_html = iv.average_rating
            ? `<div class="iw-card-row">${this._stars(iv.average_rating)}<span class="iw-rating-num">${(iv.average_rating * 5).toFixed(1)}/5</span></div>`
            : "";

        const fb_count = (iv.feedback_list || []).length;
        const fb_section = fb_count ? `
            <button class="iw-toggle-fb" data-name="${iv.name}">
                <svg class="iw-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                ${__("Feedback")} (${fb_count})
            </button>
            <div class="iw-fb-body" id="fb-${iv.name}" style="display:none">
                ${iv.feedback_list.map(f => `
                    <div class="iw-fb-item">
                        <div class="iw-fb-top">
                            <span class="iw-fb-who">${frappe.utils.escape_html(f.interviewer)}</span>
                            <span class="iw-badge iw-badge-sm iw-badge-${f.result === "Cleared" ? "cleared" : "rejected"}">${__(f.result)}</span>
                            ${f.average_rating ? this._stars(f.average_rating) : ""}
                        </div>
                        ${f.feedback ? `<div class="iw-fb-text">${frappe.utils.escape_html(f.feedback)}</div>` : ""}
                    </div>`).join("")}
            </div>` : "";

        const edit_btn = (iv.docstatus === 0)
            ? `<button class="btn btn-xs btn-default iw-edit-btn" data-name="${iv.name}">${__("Edit Schedule")}</button>`
            : "";

        const hrms_btn = `<a href="/app/interview/${iv.name}" target="_blank" class="btn btn-xs btn-default">${__("Open in HRMS")}</a>`;

        return `
        <div class="iw-card iw-card-${state}">
            <div class="iw-card-left">
                <div class="iw-card-icon iw-icon-${state}">${icon}</div>
            </div>
            <div class="iw-card-body">
                <div class="iw-card-head">
                    <div>
                        <span class="iw-round-num">${__("Round")} ${idx + 1}</span>
                        <span class="iw-round-name">${frappe.utils.escape_html(iv.round_name || iv.interview_round)}</span>
                        ${iv.interview_type ? `<span class="iw-round-type">${frappe.utils.escape_html(iv.interview_type)}</span>` : ""}
                    </div>
                    <span class="iw-badge iw-badge-${state}">${label}</span>
                </div>

                <div class="iw-card-row iw-card-datetime">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span>${date_str}</span>
                    ${time_str ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span>${time_str}</span>` : ""}
                </div>

                <div class="iw-card-row iw-card-interviewers">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    <div class="iw-chips">${interviewers_html}</div>
                </div>

                ${rating_html}

                ${iv.interview_summary ? `<div class="iw-summary">${frappe.utils.escape_html(iv.interview_summary)}</div>` : ""}

                ${fb_section}

                <div class="iw-card-actions">
                    ${edit_btn}
                    ${hrms_btn}
                </div>
            </div>
        </div>`;
    }

    /* ── SCHEDULE DIALOG ────────────────────────────────────────── */
    _open_schedule_dialog(existing = null) {
        const is_edit = !!existing;
        const d = new frappe.ui.Dialog({
            title: is_edit ? __("Edit Interview Schedule") : __("Schedule Interview Round"),
            fields: [
                {
                    label: __("Interview Round"), fieldname: "interview_round",
                    fieldtype: "Link", options: "Interview Round", reqd: 1,
                    read_only: is_edit ? 1 : 0,
                },
                { fieldtype: "Column Break" },
                {
                    label: __("Scheduled Date"), fieldname: "scheduled_on",
                    fieldtype: "Date", reqd: 1,
                },
                { fieldtype: "Section Break" },
                {
                    label: __("From Time"), fieldname: "from_time",
                    fieldtype: "Time", reqd: 1,
                },
                { fieldtype: "Column Break" },
                {
                    label: __("To Time"), fieldname: "to_time",
                    fieldtype: "Time", reqd: 1,
                },
                { fieldtype: "Section Break", label: __("Interviewers") },
                {
                    label: __("Interviewers"), fieldname: "interviewers",
                    fieldtype: "Table", options: "Interview Detail",
                    fields: [{
                        label: __("Interviewer"), fieldname: "interviewer",
                        fieldtype: "Link", options: "User", in_list_view: 1, reqd: 1,
                    }],
                },
            ],
            primary_action_label: is_edit ? __("Update") : __("Schedule"),
            primary_action: async (vals) => {
                const users = (vals.interviewers || []).map(r => r.interviewer).filter(Boolean);
                d.hide();
                frappe.dom.freeze(__("Saving…"));
                try {
                    if (is_edit) {
                        await frappe.call({
                            method: "supremusangel.supremus_angel.interview_wizard_api.update_interview_schedule",
                            args: {
                                interview_name: existing.name,
                                scheduled_on: vals.scheduled_on,
                                from_time: vals.from_time,
                                to_time: vals.to_time,
                                interviewers: JSON.stringify(users),
                            },
                        });
                    } else {
                        await frappe.call({
                            method: "supremusangel.supremus_angel.interview_wizard_api.schedule_interview",
                            args: {
                                job_applicant: this.applicant,
                                interview_round: vals.interview_round,
                                scheduled_on: vals.scheduled_on,
                                from_time: vals.from_time,
                                to_time: vals.to_time,
                                interviewers: JSON.stringify(users),
                            },
                        });
                    }
                    frappe.dom.unfreeze();
                    frappe.show_alert({ message: is_edit ? __("Schedule updated") : __("Interview round scheduled"), indicator: "green" });
                    await this._load_right();
                } catch (e) {
                    frappe.dom.unfreeze();
                    frappe.msgprint({ title: __("Error"), message: e.message || __("Failed to save"), indicator: "red" });
                }
            },
        });

        if (is_edit) {
            d.set_values({
                interview_round: existing.interview_round,
                scheduled_on: existing.scheduled_on,
                from_time: existing.from_time,
                to_time: existing.to_time,
                interviewers: (existing.interviewers || []).map(u => ({ interviewer: u })),
            });
        }

        d.show();
    }

    /* ── COMPLETE DIALOG ────────────────────────────────────────── */
    _open_complete_dialog(interview_name) {
        const d = new frappe.ui.Dialog({
            title: __("Mark Interview Complete"),
            fields: [
                {
                    label: __("Result"), fieldname: "status",
                    fieldtype: "Select",
                    options: "Cleared\nRejected\nSelected",
                    reqd: 1, default: "Cleared",
                },
            ],
            primary_action_label: __("Submit"),
            primary_action: async (vals) => {
                d.hide();
                frappe.dom.freeze(__("Submitting…"));
                try {
                    await frappe.call({
                        method: "supremusangel.supremus_angel.interview_wizard_api.submit_interview",
                        args: { interview_name, status: vals.status },
                    });
                    frappe.dom.unfreeze();
                    frappe.show_alert({ message: __("Interview submitted"), indicator: "green" });
                    await this._load_right();
                } catch (e) {
                    frappe.dom.unfreeze();
                    frappe.msgprint({ title: __("Error"), message: e.message || __("Failed to submit"), indicator: "red" });
                }
            },
        });
        d.show();
    }

    /* ── MARK ACCEPTED ──────────────────────────────────────────── */
    _mark_accepted() {
        frappe.confirm(
            __("Mark <b>{0}</b> as Accepted?", [this.applicant_doc.applicant_name]),
            async () => {
                frappe.dom.freeze(__("Updating…"));
                try {
                    await frappe.call({
                        method: "supremusangel.supremus_angel.interview_wizard_api.mark_applicant_accepted",
                        args: { job_applicant: this.applicant },
                    });
                    frappe.dom.unfreeze();
                    frappe.show_alert({ message: __("Applicant marked as Accepted"), indicator: "green" });
                    this.applicant = null;
                    this._load_list();
                    this._set_right(this._empty_state());
                } catch (e) {
                    frappe.dom.unfreeze();
                    frappe.msgprint({ title: __("Error"), message: e.message, indicator: "red" });
                }
            }
        );
    }

    /* ── HELPERS ────────────────────────────────────────────────── */
    _set_right(html) { this.$w.find("#iw-right").html(html); }

    _empty_state() {
        return `<div class="iw-empty-right">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity=".3">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <p>${__("Select an applicant to view interview rounds")}</p>
        </div>`;
    }

    _spin(size) {
        const s = size === "lg" ? "iw-spin-lg" : "";
        return `<span class="iw-spin ${s}"></span>`;
    }

    _stars(rating) {
        const filled = Math.round(rating * 5);
        return Array.from({ length: 5 }, (_, i) =>
            `<svg width="12" height="12" viewBox="0 0 24 24" fill="${i < filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.5" class="${i < filled ? "iw-star-on" : "iw-star-off"}">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>`
        ).join("");
    }

    _ico_check() { return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`; }
    _ico_x()     { return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`; }
    _ico_clock() { return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`; }
    _ico_eye()   { return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`; }
}
