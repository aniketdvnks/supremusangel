frappe.provide("policy_compliance");

policy_compliance.show_policlies = function(){
    frappe.call({
        method:"supremusangel.supremus_angel.api.policy_ack.get_pending_policies",
        callback:(r)=>{
            console.log(r.message)
            policy_compliance.show_policy_modal(r.message)
        }
    })
}
policy_compliance.show_policy_modal = function(pending) {
    // const pending = (frappe.boot && frappe.boot.pending_policies) || [];
    if (!pending || !pending.length) return;
    console.log(pending)
    let selected_policies = pending.map(p => p.name); // all policies will be acknowledged together

    const fields = [];

    pending.forEach((p, idx) => {
        fields.push({
            fieldname: "section_" + idx,
            fieldtype: "Section Break",
            label: p.policy_title,
            collapsible: 0
        });
        fields.push({
            fieldname: "content_" + idx,
            fieldtype: "HTML",
            options: `<div style="max-height:250px; overflow:auto; border:1px solid #d1d8dd; padding:10px; border-radius:3px;">
                        ${p.policy_content || ""}
                      </div>`
        });
    });

    fields.push({
        fieldname: "acknowledge",
        fieldtype: "Check",
        label: "I have read and agree to all the above policies.",
        reqd: 1
    });

    const d = new frappe.ui.Dialog({
        title: "Company Policies Acknowledgement",
        fields: fields,
        primary_action_label: "Acknowledge",
        primary_action: function() {
            const values = d.get_values();
            if (!values.acknowledge) {
                frappe.msgprint("Please confirm that you have read and agree to the policies.");
                return;
            }

            frappe.call({
                method: "supremusangel.supremus_angel.api.policy_ack.acknowledge_policies",
                args: {
                    policy_names: JSON.stringify(selected_policies)
                },
                freeze: true,
                freeze_message: "Saving acknowledgement...",
                callback: function(r) {
                    if (!r.exc) {
                        d.hide();
                        frappe.msgprint("Thank you for acknowledging the policies.");
                    }
                }
            });
        }
    });

    // Block closing via ESC or clicking outside
    d.$wrapper.find(".modal-header .modal-title").after(
        '<span style="font-size:11px; margin-left:10px; color:#8D99A6;">(Required on first login)</span>'
    );
    d.$wrapper.modal({backdrop: "static", keyboard: false});
    d.show();
};

// Run once desk is ready
$(document).on("app_ready", function () {
    if (frappe.session.user && frappe.session.user !== "Guest") {
        setTimeout(policy_compliance.show_policlies, 500);
    }
});