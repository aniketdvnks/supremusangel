frappe.pages["onboarding"].on_page_load = function (wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: __("Employee Onboarding"),
        single_column: true
    });

    // Remove standard page actions
    page.clear_actions();

    new EmployeeOnboarding(page);
};

class EmployeeOnboarding {
    constructor(page) {
        this.page = page;
        this.wrapper = $(page.body);
        this.current_step = 0;
        this.steps = [];
        this.employee_data = {};
        this.form_data = {};

        this.init();
    }

    async init() {
        this.show_loading();

        try {
            // Check onboarding status
            const status = await this.check_status();

            if (!status.required) {
                this.show_already_completed();
                return;
            }

            // Load step configuration
            await this.load_step_config();

            // Load employee data
            await this.load_employee_data();

            // Render the page
            this.render();

        } catch (error) {
            this.show_error(error.message || __("Unable to load onboarding page"));
        }
    }

    show_loading() {
        this.wrapper.html(`
            <div class="onboarding-status-screen">
                <div class="onboarding-status-card">
                    <div class="onboarding-status-badge">${__("Preparing your workspace")}</div>
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">${__("Loading...")}</span>
                    </div>
                    <h3>${__("Loading your onboarding form...")}</h3>
                    <p class="text-muted">${__("We are pulling your employee profile and arranging the guided steps.")}</p>
                </div>
            </div>
        `);
    }

    async check_status() {
        const r = await frappe.call({
            method: "supremusangel.supremus_angel.onboarding_api.check_onboarding_status"
        });
        return r.message;
    }

    async load_step_config() {
        const r = await frappe.call({
            method: "supremusangel.supremus_angel.onboarding_api.get_step_config"
        });
        this.steps = r.message || [];
    }

    async load_employee_data() {
        const r = await frappe.call({
            method: "supremusangel.supremus_angel.onboarding_api.get_employee_data"
        });

        if (r.message && r.message.success) {
            this.employee_data = r.message.data;
            this.form_data = { ...r.message.data };
        }
    }

    render() {
        this.wrapper.html(this.get_template());
        this.render_step_indicators();
        this.render_current_step();
        this.bind_events();
    }

    get_template() {
        return `
            <div class="employee-onboarding-shell">
                <div class="onboarding-orb onboarding-orb-primary"></div>
                <div class="onboarding-orb onboarding-orb-secondary"></div>

                <div class="employee-onboarding-container">
                    <div class="onboarding-stage">
                        <div class="onboarding-progress">
                            <div class="progress-copy">
                                <span class="progress-badge">
                                    ${__("Step")} <span id="progress-step-current">1</span> ${__("of")} <span id="progress-step-total">${this.steps.length}</span>
                                </span>
                                <p id="progress-step-label" class="text-muted"></p>
                            </div>
                            <div class="step-indicators" id="step-indicators"></div>
                            <div class="progress-bar-container">
                                <div class="progress-bar" id="progress-bar" style="width: 0%"></div>
                            </div>
                        </div>

                        <div class="onboarding-content">
                            <div class="step-title-section">
                                <h3 id="step-title"></h3>
                                <p id="step-subtitle" class="text-muted"></p>
                            </div>
                            <div class="step-form-container" id="step-form-container"></div>
                        </div>

                        <div class="onboarding-navigation">
                            <button class="btn btn-secondary btn-prev" id="btn-prev">
                                <svg class="icon icon-sm"><use href="#icon-left"></use></svg>
                                ${__("Previous")}
                            </button>
                            <button class="btn btn-primary btn-next" id="btn-next">
                                ${__("Next")}
                                <svg class="icon icon-sm"><use href="#icon-right"></use></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    render_step_indicators() {
        const $container = this.wrapper.find("#step-indicators");

        let html = this.steps.map((step, index) => `
            <div class="step-indicator ${index === 0 ? 'active' : ''} ${index < this.current_step ? 'completed' : ''}"
                 data-step="${index}">
                <div class="step-icon">
                    <span class="step-number">${index + 1}</span>
                    <svg class="icon icon-check"><use href="#icon-tick"></use></svg>
                </div>
                <span class="step-label">${step.title}</span>
            </div>
        `).join('');

        $container.html(html);
        this.update_progress_bar();
    }

    update_progress_bar() {
        const progress = ((this.current_step) / (this.steps.length - 1)) * 100;
        this.wrapper.find("#progress-bar").css("width", `${progress}%`);
    }

    render_current_step() {
        const step = this.steps[this.current_step];
        if (!step) return;

        // Update title
        this.wrapper.find("#step-title").text(step.title);
        this.wrapper.find("#step-subtitle").text(this.get_step_subtitle(step.id));
        this.wrapper.find("#progress-step-current").text(this.current_step + 1);
        this.wrapper.find("#progress-step-total").text(this.steps.length);
        this.wrapper.find("#progress-step-label").text(step.title);

        // Update indicators
        this.wrapper.find(".step-indicator").removeClass("active completed");
        this.wrapper.find(".step-indicator").each((i, el) => {
            if (i < this.current_step) $(el).addClass("completed");
            if (i === this.current_step) $(el).addClass("active");
        });

        // Render form fields
        const $container = this.wrapper.find("#step-form-container");

        if (step.id === "confirm") {
            $container.html(this.render_confirmation_step());
        } else if (step.id === "documents") {
            $container.html(this.render_document_step(step));
        } else {
            $container.html(this.render_form_fields(step));
        }

        this.wrapper.find(".onboarding-content").toggleClass("is-confirm-step", step.id === "confirm");

        if (step.id === "address") {
            this.handle_address_copy(Boolean(this.form_data.same_as_current));
        }

        this.update_navigation_buttons();
        this.update_progress_bar();
    }

    get_step_subtitle(step_id) {
        const subtitles = {
            personal: __("Tell us about yourself"),
            address: __("Where can we reach you?"),
            bank: __("For salary disbursement"),
            documents: __("Upload required documents"),
            confirm: __("Review and submit your information")
        };
        return subtitles[step_id] || "";
    }

    render_form_fields(step) {
        let html = '<div class="form-grid">';

        step.fields.forEach(field => {
            const value = this.form_data[field.fieldname] || "";
            const required = field.reqd ? 'required' : '';
            const requiredMark = field.reqd ? '<span class="text-danger">*</span>' : '';
            const isCheckbox = field.fieldtype === "Check";

            html += `<div class="form-group ${field.fieldtype === 'Small Text' ? 'full-width' : ''} ${isCheckbox ? 'is-checkbox-row' : ''}">`;

            if (isCheckbox) {
                html += `<div class="field-control">`;
                html += this.render_checkbox_field(field, value);
                html += `<div class="field-error text-danger" id="error-${field.fieldname}"></div>`;
                html += `</div>`;
            } else {
                html += `<div class="form-row-inline">`;
                html += `<label class="form-label">${field.label} ${requiredMark}</label>`;
                html += `<div class="field-control">`;

                switch (field.fieldtype) {
                    case "Select":
                        html += this.render_select_field(field, value, required);
                        break;
                    case "Date":
                        html += this.render_date_field(field, value, required);
                        break;
                    case "Small Text":
                        html += this.render_textarea_field(field, value, required);
                        break;
                    default:
                        html += this.render_input_field(field, value, required);
                }

                html += `<div class="field-error text-danger" id="error-${field.fieldname}"></div>`;
                html += `</div>`;
                html += `</div>`;
            }
            html += `</div>`;
        });

        html += '</div>';
        return html;
    }

    render_input_field(field, value, required) {
        const type = field.options === "Email" ? "email" : "text";
        return `<input type="${type}" class="form-control" name="${field.fieldname}"
                       value="${frappe.utils.escape_html(value)}" ${required}
                       placeholder="${__("Enter")} ${field.label.toLowerCase()}">`;
    }

    render_select_field(field, value, required) {
        const options = (field.options || "").split("\n");
        let html = `<select class="form-control form-select" name="${field.fieldname}" ${required}>`;
        html += `<option value="">${__("Select")} ${field.label}</option>`;

        options.forEach(opt => {
            if (opt.trim()) {
                const selected = opt.trim() === value ? 'selected' : '';
                html += `<option value="${opt.trim()}" ${selected}>${opt.trim()}</option>`;
            }
        });

        html += `</select>`;
        return html;
    }

    render_date_field(field, value, required) {
        return `<input type="date" class="form-control" name="${field.fieldname}"
                       value="${value}" ${required}>`;
    }

    render_textarea_field(field, value, required) {
        return `<textarea class="form-control" name="${field.fieldname}" rows="3"
                          ${required} placeholder="${__("Enter")} ${field.label.toLowerCase()}">${frappe.utils.escape_html(value)}</textarea>`;
    }

    render_checkbox_field(field, value) {
        const checked = value ? 'checked' : '';
        return `<div class="form-check">
                    <input type="checkbox" class="form-check-input" name="${field.fieldname}"
                           id="${field.fieldname}" ${checked}>
                    <label class="form-check-label" for="${field.fieldname}">${field.label}</label>
                </div>`;
    }

	render_document_step(step) {
		let html = '<div class="document-upload-grid">';

		step.fields.forEach(field => {
			const requiredMark = field.reqd ? '<span class="text-danger">*</span>' : '';
			const uploaded = this.form_data[field.fieldname];

			html += `
				<div class="document-upload-card ${uploaded ? 'uploaded' : ''}"
					 data-field="${field.fieldname}">
					<div class="upload-icon">
						${uploaded
							? '<svg class="icon icon-lg text-success"><use href="#icon-tick"></use></svg>'
							: '<svg class="icon icon-lg"><use href="#icon-upload"></use></svg>'
						}
					</div>
					<div class="upload-label">${field.label} ${requiredMark}</div>
					<div class="upload-status">
						${uploaded ? __("Uploaded") : __("Click to upload")}
					</div>
					${uploaded ? `<a href="${uploaded}" target="_blank" class="view-document">${__("View")}</a>` : ''}
				</div>
			`;
		});

		html += '</div>';
		return html;
	}

    render_confirmation_step() {
        let html = `
            <div class="confirmation-container">
                <div class="confirmation-icon">
                    <svg class="icon icon-xl text-success"><use href="#icon-tick"></use></svg>
                </div>
                <h4>${__("Almost Done!")}</h4>
                <p class="text-muted">${__("Please review your information before submitting.")}</p>

                <div class="review-sections">
        `;

        // Personal Details Summary
        html += this.render_review_section(__("Personal Details"), {
            [__("Name")]: `${this.form_data.first_name || ""} ${this.form_data.middle_name || ""} ${this.form_data.last_name || ""}`.trim(),
            [__("Date of Birth")]: this.form_data.date_of_birth || "-",
            [__("Gender")]: this.form_data.gender || "-",
            [__("Email")]: this.form_data.personal_email || "-",
            [__("Mobile")]: this.form_data.cell_number || "-"
        });

        // Address Summary
        html += this.render_review_section(__("Address"), {
            [__("Current Address")]: this.format_address_summary("current"),
            [__("Permanent Address")]: this.format_address_summary("permanent")
        });

        // Bank Summary
        html += this.render_review_section(__("Bank Details"), {
            [__("Bank")]: this.form_data.bank_name || "-",
            [__("Account No")]: this.form_data.bank_ac_no ? "****" + this.form_data.bank_ac_no.slice(-4) : "-",
            [__("PAN")]: this.form_data.pan_number || "-"
        });

        html += `
                </div>

                <div class="agreement-section mt-4">
                    <div class="form-check">
                        <input type="checkbox" class="form-check-input" id="confirm-agreement" required>
                        <label class="form-check-label" for="confirm-agreement">
                            ${__("I confirm that all the information provided is accurate and complete.")}
                        </label>
                    </div>
                </div>
            </div>
        `;

        return html;
    }

    render_review_section(title, data) {
        let html = `
            <div class="review-section">
                <h5>${title}</h5>
                <div class="review-grid">
        `;

        for (const [label, value] of Object.entries(data)) {
            html += `
                <div class="review-item">
                    <span class="review-label">${label}</span>
                    <span class="review-value">${frappe.utils.escape_html(value)}</span>
                </div>
            `;
        }

        html += `</div></div>`;
        return html;
    }

    format_address_summary(prefix) {
        const address = this.form_data[`${prefix}_address`] || "";
        const city = this.form_data[`${prefix}_city`] || "";
        const state = this.form_data[`${prefix}_state`] || "";
        const pincode = this.form_data[`${prefix}_pincode`] || "";
        const locality = [city, state].filter(Boolean).join(", ");

        return [address, locality, pincode].filter(Boolean).join(" | ") || "-";
    }

    update_navigation_buttons() {
        const $prev = this.wrapper.find("#btn-prev");
        const $next = this.wrapper.find("#btn-next");

        // Previous button
        if (this.current_step === 0) {
            $prev.hide();
        } else {
            $prev.show();
        }

        // Next button
        if (this.current_step === this.steps.length - 1) {
            $next.html(`
                <svg class="icon icon-sm"><use href="#icon-tick"></use></svg>
                ${__("Complete Onboarding")}
            `).removeClass("btn-primary").addClass("btn-success");
        } else {
            $next.html(`
                ${__("Next")}
                <svg class="icon icon-sm"><use href="#icon-right"></use></svg>
            `).removeClass("btn-success").addClass("btn-primary");
        }
    }

    bind_events() {
        const self = this;

        // Navigation buttons
        this.wrapper.find("#btn-prev").off("click").on("click", () => this.prev_step());
        this.wrapper.find("#btn-next").off("click").on("click", () => this.next_step());

		// Document upload cards - direct trigger
		this.wrapper.on("click", ".document-upload-card", function(e) {
			if ($(e.target).hasClass("view-document")) return;

			const fieldname = $(this).data("field");
			self.open_file_uploader(fieldname, $(this));
		});
        // File input change
        this.wrapper.on("change", ".document-file-input", function () {
            self.handle_file_upload($(this));
        });

        // Form field changes
        this.wrapper.on("change", ".form-control, .form-check-input", function () {
            const name = $(this).attr("name");
            const value = $(this).is(":checkbox") ? $(this).is(":checked") : $(this).val();
            self.form_data[name] = value;

            // Clear error on change
            self.wrapper.find(`#error-${name}`).text("");

            if (
                self.form_data.same_as_current &&
                ["current_address", "current_city", "current_state", "current_pincode"].includes(name)
            ) {
                self.sync_permanent_address_fields();
            }
        });

        // Step indicator clicks (allow navigation to completed steps)
        this.wrapper.on("click", ".step-indicator.completed", function () {
            const step = parseInt($(this).data("step"));
            if (step < self.current_step) {
                self.current_step = step;
                self.render_current_step();
            }
        });

		// Handle "same as current" checkbox for address copy
		this.wrapper.on("change", "[name='same_as_current']", function() {
			self.handle_address_copy($(this).is(":checked"));
		});
    }

	handle_address_copy(is_same) {
		this.form_data.same_as_current = is_same;

		if (is_same) {
			this.sync_permanent_address_fields();
			this.toggle_permanent_address_fields(true);
		} else {
			this.toggle_permanent_address_fields(false);
		}
	}

	sync_permanent_address_fields() {
		const field_map = {
			current_address: "permanent_address",
			current_city: "permanent_city",
			current_state: "permanent_state",
			current_pincode: "permanent_pincode"
		};

		Object.entries(field_map).forEach(([source_field, target_field]) => {
			const stored_value = this.form_data[source_field];
			const value = stored_value !== undefined
				? stored_value
				: (this.wrapper.find(`[name='${source_field}']`).val() || "");

			this.form_data[target_field] = value;
			this.wrapper.find(`[name='${target_field}']`).val(value);
			this.wrapper.find(`#error-${target_field}`).text("");
		});
	}

	toggle_permanent_address_fields(disable) {
		const permanent_fields = [
			"permanent_address",
			"permanent_city",
			"permanent_state",
			"permanent_pincode"
		];

		permanent_fields.forEach(fieldname => {
			this.wrapper.find(`[name='${fieldname}']`)
				.prop("disabled", disable)
				.toggleClass("disabled", disable);
		});
	}

	handle_file_upload($input) {
		const fieldname = $input.attr("name");
		const $card = $input.closest(".document-upload-card");
		const field = this.steps[this.current_step].fields.find(f => f.fieldname === fieldname);
		const self = this;

		// Use Frappe's native FileUploader
		new frappe.ui.FileUploader({
			folder: "Home/Attachments",
			restrictions: {
				allowed_file_types: field.fieldtype === "Attach Image"
					? ["image/*"]
					: [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"]
			},
			on_success: (file_doc) => {
				const file_url = file_doc.file_url;

				self.form_data[fieldname] = file_url;

				// Update card UI
				$card.removeClass("uploading").addClass("uploaded");
				$card.find(".upload-icon").html(
					'<svg class="icon icon-lg text-success"><use href="#icon-tick"></use></svg>'
				);
				$card.find(".upload-status").text(__("Uploaded"));

				// Add view link if not exists
				if (!$card.find(".view-document").length) {
					$card.append(
						`<a href="${file_url}" target="_blank" class="view-document">${__("View")}</a>`
					);
				} else {
					$card.find(".view-document").attr("href", file_url);
				}

				// Save to backend
				self.save_document(fieldname, file_url);

				frappe.show_alert({
					message: __("Document uploaded successfully"),
					indicator: "green"
				});
			}
		});
	}

	open_file_uploader(fieldname, $card) {
		const field = this.steps[this.current_step].fields.find(f => f.fieldname === fieldname);
		const self = this;

		new frappe.ui.FileUploader({
			folder: "Home/Attachments",
			make_attachments_public: 0,  // Keep documents private
			restrictions: {
				allowed_file_types: field.fieldtype === "Attach Image"
					? ["image/*"]
					: [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"],
				max_file_size: 10 * 1024 * 1024  // 10MB limit
			},
			on_success: (file_doc) => {
				self.handle_upload_success(fieldname, file_doc.file_url, $card);
			}
		});
	}

	handle_upload_success(fieldname, file_url, $card) {
		this.form_data[fieldname] = file_url;

		// Update UI
		$card.addClass("uploaded");
		$card.find(".upload-icon").html(
			'<svg class="icon icon-lg text-success"><use href="#icon-tick"></use></svg>'
		);
		$card.find(".upload-status").text(__("Uploaded"));

		// Update or add view link
		let $viewLink = $card.find(".view-document");
		if ($viewLink.length) {
			$viewLink.attr("href", file_url);
		} else {
			$card.append(`<a href="${file_url}" target="_blank" class="view-document">${__("View")}</a>`);
		}

		// Persist to backend
		frappe.call({
			method: "supremusangel.supremus_angel.onboarding_api.upload_document",
			args: {
				document_type: fieldname,
				file_url: file_url
			}
		});

		frappe.show_alert({ message: __("Document uploaded"), indicator: "green" });
	}

    upload_file(file, fieldname) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("doctype", "Employee");
            formData.append("docname", this.employee_data.name);
            formData.append("fieldname", fieldname);
            formData.append("is_private", 1);

            $.ajax({
                url: "/api/method/upload_file",
                type: "POST",
                data: formData,
                processData: false,
                contentType: false,
                success: (r) => resolve(r.message),
                error: (xhr) => reject(xhr.responseJSON?.exc || "Upload failed")
            });
        });
    }

    async prev_step() {
        if (this.current_step > 0) {
            this.current_step--;
            this.render_current_step();
        }
    }

    async next_step() {
        // Validate current step
        if (!this.validate_current_step()) {
            return;
        }

        // Save current step data
        const step = this.steps[this.current_step];
        if (step.id !== "confirm") {
            await this.save_step(step.id);
        }

        // Move to next step or complete
        if (this.current_step < this.steps.length - 1) {
            this.current_step++;
            this.render_current_step();
            // Scroll to top
            this.wrapper.find(".onboarding-content")[0]?.scrollIntoView({ behavior: "smooth" });
        } else {
            await this.complete_onboarding();
        }
    }

	validate_current_step() {
		const step = this.steps[this.current_step];
		let is_valid = true;

		// Clear all errors
		this.wrapper.find(".field-error").text("");

		if (step.id === "confirm") {
			if (!this.wrapper.find("#confirm-agreement").is(":checked")) {
				frappe.msgprint({
					title: __("Confirmation Required"),
					message: __("Please confirm that all information is accurate."),
					indicator: "orange"
				});
				return false;
			}
			return true;
		}

		// Special handling for address step
		if (step.id === "address") {
			return this.validate_address_step(step);
		}

		// Standard validation for other steps
		step.fields.forEach(field => {
			if (field.reqd) {
				const value = this.form_data[field.fieldname];
				if (!value || (typeof value === "string" && !value.trim())) {
					is_valid = false;
					this.wrapper.find(`#error-${field.fieldname}`).text(__("This field is required"));
				}
			}
		});

		if (!is_valid) {
			frappe.show_alert({ message: __("Please fill all required fields"), indicator: "orange" });
		}

		return is_valid;
	}
	validate_address_step(step) {
		let is_valid = true;
		const same_as_current = this.form_data.same_as_current;

		// Current address fields are always required
		const current_required = ["current_address", "current_city", "current_state", "current_pincode"];
		current_required.forEach(fieldname => {
			const value = this.form_data[fieldname] || this.wrapper.find(`[name='${fieldname}']`).val();
			if (!value || !value.trim()) {
				is_valid = false;
				this.wrapper.find(`#error-${fieldname}`).text(__("This field is required"));
			}
		});

		// Permanent address fields required only if NOT same as current
		if (!same_as_current) {
			const permanent_required = ["permanent_address", "permanent_city", "permanent_state", "permanent_pincode"];
			permanent_required.forEach(fieldname => {
				const value = this.form_data[fieldname] || this.wrapper.find(`[name='${fieldname}']`).val();
				if (!value || !value.trim()) {
					is_valid = false;
					this.wrapper.find(`#error-${fieldname}`).text(__("This field is required"));
				}
			});
		}

		if (!is_valid) {
			frappe.show_alert({ message: __("Please fill all required fields"), indicator: "orange" });
		}

		return is_valid;
	}
    async save_step(step_id) {
        try {
            const r = await frappe.call({
                method: "supremusangel.supremus_angel.onboarding_api.save_step_data",
                args: {
                    step_id: step_id,
                    data: this.form_data
                },
                freeze: true,
                freeze_message: __("Saving...")
            });

            if (!r.message.success) {
                throw new Error(r.message.message);
            }

        } catch (error) {
            frappe.show_alert({
                message: __("Failed to save: ") + (error.message || error),
                indicator: "red"
            });
            throw error;
        }
    }

    async complete_onboarding() {
        try {
            const r = await frappe.call({
                method: "supremusangel.supremus_angel.onboarding_api.complete_onboarding",
                freeze: true,
                freeze_message: __("Completing onboarding...")
            });

            if (r.message.success) {
                // IMPORTANT: Update the boot flag immediately
                frappe.boot.onboarding_status = false;
                this.show_completion_dialog();
            } else {
                throw new Error(r.message.message);
            }

        } catch (error) {
            frappe.msgprint({
                title: __("Error"),
                message: error.message || __("Failed to complete onboarding"),
                indicator: "red"
            });
        }
    }

    show_completion_dialog() {
        $("#employee-onboarding-completion-overlay").remove();
        $("body").addClass("onboarding-overlay-open");

        const $overlay = $(`
            <div class="onboarding-overlay" id="employee-onboarding-completion-overlay">
                <div class="onboarding-overlay-card">
                    <div class="completion-eyebrow">${__("Profile Activated")}</div>
                    <div class="completion-icon">
                        <svg class="icon"><use href="#icon-tick"></use></svg>
                    </div>
                    <h3>${__("Welcome aboard!")}</h3>
                    <p class="text-muted">
                        ${__("Your onboarding is complete. Set a new password now or head straight to your workspace.")}
                    </p>
                    <div class="onboarding-overlay-actions">
                        <button class="btn btn-success" data-action="reset-password">
                            ${__("Set New Password")}
                        </button>
                        <button class="btn btn-secondary" data-action="go-home">
                            ${__("Go to Home")}
                        </button>
                    </div>
                </div>
            </div>
        `);

        $overlay.find("[data-action='reset-password']").on("click", async () => {
            const $button = $overlay.find("[data-action='reset-password']");
            $button.prop("disabled", true).text(__("Sending..."));

            try {
                await frappe.xcall("frappe.core.doctype.user.user.reset_password", {
                    user: frappe.session.user
                });
                frappe.show_alert({
                    message: __("Password reset email sent. Please check your email."),
                    indicator: "green"
                });
                setTimeout(() => {
                    $("body").removeClass("onboarding-overlay-open");
                    window.location.href = "/app";
                }, 1500);
            } catch (error) {
                $button.prop("disabled", false).text(__("Set New Password"));
                frappe.msgprint({
                    title: __("Unable to send reset email"),
                    message: error.message || __("Please try again."),
                    indicator: "red"
                });
            }
        });

        $overlay.find("[data-action='go-home']").on("click", () => {
            $("body").removeClass("onboarding-overlay-open");
            window.location.href = "/app";
        });

        $("body").append($overlay);
    }

    show_already_completed() {
        this.wrapper.html(`
            <div class="onboarding-status-screen">
                <div class="onboarding-status-card">
                    <div class="onboarding-status-badge">${__("Profile Ready")}</div>
                    <div>
                        <svg class="icon"><use href="#icon-tick"></use></svg>
                    </div>
                    <h3>${__("Onboarding Already Completed")}</h3>
                    <p class="text-muted">${__("You have already completed your onboarding process.")}</p>
                    <a href="/app" class="btn btn-primary mt-3">${__("Go to Home")}</a>
                </div>
            </div>
        `);
    }

    show_error(message) {
        this.wrapper.html(`
            <div class="onboarding-status-screen">
                <div class="onboarding-status-card is-error">
                    <div class="onboarding-status-badge">${__("Setup Interrupted")}</div>
                    <div class="error-icon">
                        <svg class="icon"><use href="#icon-error"></use></svg>
                    </div>
                    <h3>${__("Something went wrong")}</h3>
                    <p class="text-muted">${frappe.utils.escape_html(message)}</p>
                    <button class="btn btn-primary mt-3" onclick="location.reload()">
                        ${__("Try Again")}
                    </button>
                </div>
            </div>
        `);
    }
}
