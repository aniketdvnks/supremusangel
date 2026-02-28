frappe.provide("policy_compliance");

policy_compliance.pending_policies = [];
policy_compliance.current_policy_index = 0;
policy_compliance.current_dialog = null;

policy_compliance.load_policies_and_start = function() {
    frappe.call({
        method: "supremusangel.supremus_angel.api.policy_ack.get_pending_policies",
        callback: (r) => {
            console.log(r.message);
            const pending = r.message || [];
            if (!pending.length) return;
            policy_compliance.pending_policies = pending;
            policy_compliance.current_policy_index = 0;
            policy_compliance.show_next_policy();
        }
    });
};

policy_compliance.show_next_policy = function() {
    const pending = policy_compliance.pending_policies;
    const idx = policy_compliance.current_policy_index;

    if (!pending || !pending.length || idx >= pending.length) {
        // all done
        policy_compliance.current_dialog = null;
        frappe.msgprint("Thank you for acknowledging the policies.");
        return;
    }

    const p = pending[idx];
    
    // Build the content HTML based on whether PDF exists
    let content_html = "";
    
    if (p.policy_pdf) {
        // PDF exists - show embedded PDF viewer with download link
        const pdf_url = p.policy_pdf;
        content_html = `
            <div style="margin-bottom: 10px;">
                <a href="${pdf_url}" target="_blank" class="btn btn-xs btn-default">
                    <i class="fa fa-external-link"></i> Open PDF in New Tab
                </a>
                <a href="${pdf_url}" download class="btn btn-xs btn-default" style="margin-left: 5px;">
                    <i class="fa fa-download"></i> Download PDF
                </a>
            </div>
            <div style="border: 1px solid #d1d8dd; border-radius: 3px; overflow: hidden;">
                <iframe 
                    src="${pdf_url}" 
                    style="width: 100%; height: 550px; border: none;"
                    title="${p.policy_title}">
                </iframe>
            </div>
            <noscript>
                <p>Your browser does not support embedded PDFs. 
                   <a href="${pdf_url}" target="_blank">Click here to view the PDF</a>.
                </p>
            </noscript>
        `;
    } else if (p.policy_content) {
        // No PDF - show HTML content
        content_html = `
            <div style="max-height: 550px; overflow: auto; border: 1px solid #d1d8dd; padding: 10px; border-radius: 3px;">
                ${p.policy_content}
            </div>
        `;
    } else {
        // Neither PDF nor content
        content_html = `
            <div style="padding: 20px; text-align: center; color: #8D99A6;">
                <i class="fa fa-file-text-o" style="font-size: 48px;"></i>
                <p style="margin-top: 10px;">No policy content available.</p>
            </div>
        `;
    }

    const fields = [
        {
            fieldname: "section_0",
            fieldtype: "Section Break",
            label: p.policy_title,
            collapsible: 0
        },
        {
            fieldname: "content_0",
            fieldtype: "HTML",
            options: content_html
        },
        {
            fieldname: "sb1",
            fieldtype: "Section Break"
        },
        {
            fieldname: "acknowledge",
            fieldtype: "Check",
            label: "I have read and agree to this policy.",
            reqd: 1
        }
    ];

    const d = new frappe.ui.Dialog({
        title: "Company Policy Acknowledgement - " + (policy_compliance.current_policy_index + 1) + "/" + pending.length,
        fields: fields,
        primary_action_label: "Acknowledge",
        size: 'extra-large',
        primary_action: function() {
            const values = d.get_values();
            if (!values.acknowledge) {
                frappe.msgprint("Please confirm that you have read and agree to this policy.");
                return;
            }

            frappe.call({
                method: "supremusangel.supremus_angel.api.policy_ack.acknowledge_policies",
                args: {
                    policy_names: JSON.stringify([p.name])
                },
                freeze: true,
                freeze_message: "Saving acknowledgement...",
                callback: function(r) {
                    if (!r.exc) {
                        d.hide();
                        policy_compliance.current_dialog = null;
                        // move to next policy
                        policy_compliance.current_policy_index += 1;
                        policy_compliance.show_next_policy();
                    }
                }
            });
        }
    });

    // Block closing via ESC or clicking outside
    d.$wrapper.modal({ backdrop: "static", keyboard: false });
    d.show();

    policy_compliance.current_dialog = d;
};

// Run once desk is ready
$(document).on("app_ready", function() {
    if (frappe.session.user && frappe.session.user !== "Guest") {
        setTimeout(policy_compliance.load_policies_and_start, 500);
    }
});