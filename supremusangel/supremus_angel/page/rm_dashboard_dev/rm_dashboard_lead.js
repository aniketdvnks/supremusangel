frappe.provide('frappe.RMDashboard');
frappe.RMDashboard.RMLeadModule =class {
    constructor(controller) {
      this.controller = controller;
      this.state = RMDashboardState;
    }
  
    /**
     * Load lead by name
     */
    load_lead(name) {
      return frappe.call({
        method: 'frappe.client.get',
        args: { doctype: 'Lead', name }
      }).then(r => {
        const lead = r.message;
        this.state.set_lead(lead);
        this.populate_lead_view(lead);
        this.update_lead_onboard_state(lead);
        this.load_timeline();
        return lead;
      }).catch(err => {
        frappe.msgprint(__('Failed to load lead: {0}', [err.message || err]));
      });
    }
  
    /**
     * Populate lead view with data
     */
    populate_lead_view(lead) {
      $('#lead_name_view').text(lead.lead_name || lead.name);
      $('#lead_email_view').text(lead.email_id || '-');
      $('#lead_phone_view').text(lead.mobile_no || lead.phone || '-');
      $('#lead_company_view').text(lead.company_name || '-');
      
      const state = lead.workflow_state || lead.status || 'Open';
      const badge_class = RMCommon.workflow_badge_class(state);
      $('#lead_state_view').html(`<span class="${badge_class}">${frappe.utils.escape_html(state)}</span>`);
    }
  
    /**
     * Update onboard button state based on lead status
     */
    update_lead_onboard_state(lead) {
      const $btn = $('#btn-onboard-customer');
      const $link = $('#lead_customer_link');
  
      if (lead.status === 'Converted') {
        frappe.db.get_value('Customer', { lead_name: lead.name }, 'name').then(r => {
          const cust = r.message && r.message.name;
          
          if (cust) {
            this.state.set_customer(cust);
            $link.text(cust);
            $btn.prop('disabled', true)
              .addClass('rm-btn-muted')
              .text(__('Already Onboarded'));
          } else {
            $link.text(__('Converted (Customer not found)'));
            $btn.prop('disabled', true)
              .addClass('rm-btn-muted')
              .text(__('Already Onboarded'));
          }
        });
      } else {
        $link.text(__('No'));
        $btn.prop('disabled', false)
          .removeClass('rm-btn-muted')
          .text(__('Onboard as Customer'));
      }
    }
  
    /**
     * Load lead timeline (events)
     */
    load_timeline() {
      const lead = this.state.get().lead;
      if (!lead) return;
  
      frappe.call({
        method: 'frappe.client.get_list',
        args: {
          doctype: 'Event',
          filters: {
            'event_participants.reference_doctype': 'Lead',
            'event_participants.reference_docname': lead.name
          },
          fields: ['name', 'subject', 'starts_on', 'event_category', 'event_type', 'status', 'creation'],
          order_by: 'starts_on desc, creation desc',
          limit: 20
        }
      }).then(r => {
        const $t = $('#lead_timeline').empty();
        const events = r.message || [];
  
        if (!events.length) {
          $t.append('<div class="text-muted" style="font-size:0.8rem;">No meetings/calls/emails yet.</div>');
          return;
        }
  
        events.forEach(ev => {
          $t.append(RMCommon.render_event_card(ev));
        });
      });
    }
  
    /**
     * Show lead selector dialog
     */
    show_lead_selector() {
      new frappe.ui.form.LinkSelector({
        doctype: 'Lead',
        target: null,
        txt: '',
        filters: { status: ['!=', 'Do Not Contact'] },
        onselect: (lead) => {
          this.load_lead(lead);
          this.controller.goto_view('lead');
        }
      });
    }
  }

frappe.RMDashboard.lead = new frappe.RMDashboard.RMLeadModule();

//   window.RMLeadModule = RMLeadModule;
  