frappe.pages['rm-dashboard'].on_page_load = function(wrapper) {
    new RMDashboardController(wrapper);
  };
  
  class RMDashboardController {
    constructor(wrapper) {
      this.wrapper = $(wrapper);
      this.page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'RM Dashboard',
        single_column: false
      });
      $(frappe.render_template('rm_dashboard')).appendTo(this.page.body);
      this.sidebar = this.wrapper.find('.layout-side-section');
      this.current_lead = null;
      this.current_customer = null;
  
      this.init_start_mode();
      this.init_sidebar();
      this.bind_events();
    }
  
    init_sidebar() {
        this.sidebar.empty().append(`<div class="rm-sidebar">
        <h5>Item Prices</h5>
        <div id="sidebar-item-prices"></div>
      </div>`)
      RMCommon.load_item_prices('#sidebar-item-prices');
    }
  
    bind_events() {
      $('#btn-switch-lead').on('click', () => this.show_lead_selector());
      $('#btn-switch-customer').on('click', () => this.show_customer_selector());
  
      $('#btn-new-meeting').on('click', () => this.log_activity('Meeting'));
      $('#btn-update-meeting').on('click', () => this.log_activity('Meeting Status Update'));
      $('#btn-upload-selfie').on('click', () => this.upload_proof());
      $('#btn-onboard-customer').on('click', () => {
        if (!$('#btn-onboard-customer').prop('disabled')) {
          this.goto_view('customer-from-lead');
        }
      });
      
      $(document).on('click', '.rm-mode-btn', (e) => {
        const mode = $(e.currentTarget).data('mode');
        this.set_mode(mode);
        if (mode === 'lead') {
          this.show_lead_selector();
        } else {
          this.show_customer_selector();
        }
      });
      $('#btn-save-kyc').on('click', () => this.save_kyc());
      $('#btn-payment-back').on('click', () => this.goto_view('customer'));
      $('#btn-save-payment').on('click', () => this.save_payment());
  
      $('#btn-so-back').on('click', () => this.goto_view('payment'));
      $('#btn-add-item').on('click', () => this.add_item_row());
      $('#btn-save-so').on('click', () => this.save_sales_order());
    }
  
    // Decide whether to start from Lead or Customer based on storage or prompt.
    // init_start_mode() {
    //   const lead = localStorage.getItem(RMCommon.storage_keys.lead);
    //   const cust = localStorage.getItem(RMCommon.storage_keys.customer);
  
    //   if (lead) {
    //     this.load_lead(lead);
    //     return;
    //   }
    //   if (cust) {
    //     this.load_customer(cust);
    //     return;
    //   }
  
    //   // Ask the user
    //   const d = new frappe.ui.Dialog({
    //     title: 'Start with',
    //     fields: [
    //       {
    //         fieldname: 'mode',
    //         fieldtype: 'Select',
    //         label: 'Mode',
    //         options: ['Lead', 'Customer'],
    //         default: 'Lead',
    //         reqd: 1
    //       }
    //     ],
    //     primary_action_label: 'Continue',
    //     primary_action: (values) => {
    //       d.hide();
    //       if (values.mode === 'Lead') {
    //         this.show_lead_selector();
    //       } else {
    //         this.show_customer_selector();
    //       }
    //     }
    //   });
    //   d.show();
    // }
    init_start_mode() {
        console.log("Init Start Mode")
        const lead = localStorage.getItem(RMCommon.storage_keys.lead);
        const cust = localStorage.getItem(RMCommon.storage_keys.customer);
        console.log(lead)
        console.log(cust)
        // If both exist, respect last used mode (store separately if you want)
        if (lead && !cust) {
          this.set_mode('lead');
          this.load_lead(lead);
          return;
        }
        if (cust && !lead) {
          this.set_mode('customer');
          this.load_customer(cust);
          this.set_tite("Customer :- "+cust)
          return;
        }
        if(cust && lead){
            this.set_mode('customer');
          this.load_customer(cust);
        //   this.set_tite("Customer :- "+cust)
          return;
        }
        if(!cust && !lead){
            this.show_mode_dialog();
        }
        // Nothing or both → explicit choice dialog
      }
      
      show_mode_dialog() {
        const d = new frappe.ui.Dialog({
          title: 'Start with',
          fields: [
            {
              fieldname: 'mode',
              fieldtype: 'Select',
              label: 'Mode',
              options: ['Lead', 'Customer'],
              reqd: 1,
              default: 'Lead'
            }
          ],
          primary_action_label: 'Continue',
          primary_action: (values) => {
            d.hide();
            this.set_mode(values.mode.toLowerCase());
            if (values.mode === 'Lead') {
              this.show_lead_selector();
            } else {
              this.show_customer_selector();
            }
          }
        });
        d.show();
      }
      
      set_mode(mode) {
        this.mode = mode; // 'lead' or 'customer'
        $('.rm-mode-btn').removeClass('btn-primary').addClass('btn-outline-secondary');
        $(`.rm-mode-btn[data-mode="${mode}"]`)
          .removeClass('btn-outline-secondary')
          .addClass('btn-primary');
      }
      
    /* ------------ VIEW NAVIGATION ------------ */
  
    goto_view(view) {
      // view: 'lead', 'customer', 'customer-from-lead', 'payment', 'sales-order'
      $('#view-lead, #view-customer, #view-payment, #view-sales-order').hide();
  
      if (view === 'lead') {
        $('#view-lead').show();
        RMCommon.set_step('lead');
      }
      if (view === 'customer' || view === 'customer-from-lead') {
        $('#view-customer').show();
        RMCommon.set_step('customer');
        // ensure customer is loaded for current_customer
        if (this.current_customer) {
          this.populate_customer_view();
        } else if (view === 'customer-from-lead') {
          this.prepare_customer_from_lead();
        }
      }
      if (view === 'payment') {
        $('#view-payment').show();
        RMCommon.set_step('payment');
      }
      if (view === 'sales-order') {
        $('#view-sales-order').show();
        RMCommon.set_step('sales-order');
      }
    }
  
    /* ------------ LEAD FLOW ------------ */
  
    show_lead_selector() {
      const d = new frappe.ui.Dialog({
        title: 'Select Lead',
        fields: [{
          fieldtype: 'Link',
          fieldname: 'lead',
          label: 'Lead',
          options: 'Lead',
          reqd: 1,
          get_query: () => ({
            filters: { owner: frappe.session.user }
          })
        }],
        primary_action_label: 'Load',
        primary_action: (values) => {
          d.hide();
          localStorage.setItem(RMCommon.storage_keys.lead, values.lead);
          this.load_lead(values.lead);
        }
      });
      d.show();
    }
  
    load_lead(name) {
      frappe.call({
        method: 'frappe.client.get',
        args: { doctype: 'Lead', name }
      }).then(r => {
        this.current_lead = r.message;
  
        $('#lead-title').text(`Lead: ${this.current_lead.lead_name}`);
        $('#lead_name').text(this.current_lead.lead_name || '-');
        $('#lead_phone').text(this.current_lead.phone || '-');
        $('#lead_whatsapp').text(this.current_lead.mobile_no || '-');
        $('#lead_email').text(this.current_lead.email_id || '-');
        $('#lead_address').text(this.current_lead.address_line1 || '-');
        $('#lead_owner').text(this.current_lead.lead_owner || '-');
        
        this.update_lead_onboard_state();
        this.load_lead_timeline();
        this.check_lead_customer_link();
        this.goto_view('lead');
      });
    }
    
    update_lead_onboard_state() {
        const lead = this.current_lead;
        if (!lead) return;
      
        // If status is Converted, try to find linked customer
        if (lead.status === 'Converted') {
          frappe.call({
            method: 'frappe.db.get_value',
            args: {
              doctype: 'Customer',
              fieldname: ['name'],
              filters: { lead_name: lead.name }
            }
          }).then(r => {
            const cust = r.message && r.message.name;
      
            if (cust) {
              this.current_customer = cust;
              localStorage.setItem(RMCommon.storage_keys.customer, cust);
              $('#lead_customer_link').text(cust);
              $('#btn-onboard-customer')
                .prop('disabled', true)
                .addClass('rm-btn-muted')
                .text('Already Onboarded');
            } else {
              // Edge case: Converted but no Customer found; still disable to avoid duplicate onboarding
              $('#lead_customer_link').text('Converted (no Customer found)');
              $('#btn-onboard-customer')
                .prop('disabled', true)
                .addClass('rm-btn-muted')
                .text('Already Onboarded');
            }
          });
        } else {
          // Not converted yet
          $('#lead_customer_link').text('No');
          $('#btn-onboard-customer')
            .prop('disabled', false)
            .removeClass('rm-btn-muted')
            .text('Onboard as Customer');
        }
      }

      
    load_lead_timeline() {
      frappe.call({
        method: 'frappe.client.get_list',
        args: {
          doctype: 'Communication',
          filters: {
            reference_doctype: 'Lead',
            reference_name: this.current_lead.name
          },
          fields: ['creation', 'sender', 'subject'],
          order_by: 'creation desc',
          limit: 20
        }
      }).then(r => {
        const t = $('#lead_timeline').empty();
        (r.message || []).forEach(c => {
          t.append(`
            <div class="rm-timeline-item">
              <strong>${frappe.datetime.str_to_user(c.creation)}</strong><br>
              <span>${frappe.utils.escape_html(c.subject || '')}</span>
            </div>
          `);
        });
      });
    }
  
    check_lead_customer_link() {
      // Lookup Customer where lead_name = current_lead.name
      frappe.call({
        method: 'frappe.client.get_list',
        args: {
          doctype: 'Customer',
          fieldname: ['name'],
          filters: { lead_name: this.current_lead.name }
        }
      }).then(r => {
        const cust = r.message && r.message.name;
        if (cust) {
          $('#lead_customer_link').text(cust);
          $('#btn-onboard-customer').prop('disabled', true).text('Already Onboarded');
          this.current_customer = cust;
          localStorage.setItem(RMCommon.storage_keys.customer, cust);
        } else {
          $('#lead_customer_link').text('No');
          $('#btn-onboard-customer').prop('disabled', false).text('Onboard as Customer');
        }
      });
    }
  
    log_activity(type) {
      if (!this.current_lead) return;
      const doc = {
        doctype: 'Communication',
        communication_type: 'Communication',
        communication_medium: 'Phone',
        subject: `${type} with ${this.current_lead.lead_name}`,
        reference_doctype: 'Lead',
        reference_name: this.current_lead.name
      };
      frappe.call({ method: 'frappe.client.insert', args: { doc } }).then(() => {
        this.load_lead_timeline();
      });
    }
  
    upload_proof() {
      if (!this.current_lead) return;
      frappe.upload.make({
        args: {
          is_private: 1,
          doctype: 'Lead',
          docname: this.current_lead.name
        },
        callback: () => {
          this.log_activity('Selfie / Signboard');
        }
      });
    }
  
    /* ------------ CUSTOMER FLOW ------------ */
  
    show_customer_selector() {
      const d = new frappe.ui.Dialog({
        title: 'Select Customer',
        fields: [{
          fieldtype: 'Link',
          fieldname: 'customer',
          label: 'Customer',
          options: 'Customer',
          reqd: 1
        }],
        primary_action_label: 'Load',
        primary_action: (values) => {
          d.hide();
          localStorage.setItem(RMCommon.storage_keys.customer, values.customer);
          this.load_customer(values.customer);
        }
      });
      d.show();
    }
  
    load_customer(name) {
      frappe.call({
        method: 'frappe.client.get',
        args: { doctype: 'Customer', name }
      }).then(r => {
        console.log(r)
        this.current_customer = r.message.name;
        this.customer_doc = r.message
        localStorage.setItem(RMCommon.storage_keys.customer, this.current_customer);
        this.populate_customer_view( r.message);
        this.goto_view('customer');
      });
    }
  
    populate_customer_view(customer_doc) {
      if (!this.current_customer) return;
      
        $('#customer-title').text(`Customer: ${customer_doc.customer_name || customer_doc.name}`);
        $('#cust_name_view').text(customer_doc.customer_name || customer_doc.name);
        $('#cust_demat_view').text(customer_doc.custom_demat_account || '-');
        $('#cust_bank_view').text(customer_doc.custom_bank_account || '-');
  
        const state = customer_doc.workflow_state;
        const cls = RMCommon.workflow_badge_class(state);
        $('#customer-state-badge').html(
          state ? `<span class="${cls}">${frappe.utils.escape_html(state)}</span>` : ''
        );
  
        const f = $('#customer-kyc-form');
        f.find('[name="phone"]').val(customer_doc.mobile_no || '');
        f.find('[name="whatsapp_no"]').val(customer_doc.whatsapp_no || '');
        f.find('[name="pan_card"]').val(customer_doc.custom_pan_card || '');
        f.find('[name="aadhar_card"]').val(customer_doc.custom_pan_number || '');
        f.find('[name="bank_account"]').val(customer_doc.custom_bank_account_number || '');
        f.find('[name="bank_ifsc"]').val(customer_doc.custom_bank_ifsc_code || '');
  
        RMCommon.load_customer_events(customer_doc.name, '#cust_events_body');
        RMCommon.load_customer_purchase_history(customer_doc.name, '#cust_history_body');
      
    }
  
    prepare_customer_from_lead() {
      // Pre-fill KYC form from lead if no customer exists yet
      if (!this.current_lead || this.current_customer) return;
      $('#customer-title').text('New Customer from Lead');
      $('#cust_name_view').text(this.current_lead.lead_name || '');
      $('#cust_demat_view').text('-');
      $('#cust_bank_view').text('-');
      $('#customer-state-badge').html('');
  
      const f = $('#customer-kyc-form');
      f.find('[name="phone"]').val(this.current_lead.phone || '');
      f.find('[name="whatsapp_no"]').val(this.current_lead.mobile_no || '');
      f.find('[name="pan_card"]').val('');
      f.find('[name="aadhar_card"]').val('');
      f.find('[name="bank_account"]').val('');
      f.find('[name="bank_ifsc"]').val('');
    }
  
    save_kyc() {
      if (!this.current_customer && this.current_lead) {
        // Create new customer from lead
        const f = $('#customer-kyc-form');
        const doc = {
          doctype: 'Customer',
          customer_name: this.current_lead.lead_name,
          mobile_no: f.find('[name="phone"]').val(),
          whatsapp_no: f.find('[name="whatsapp_no"]').val(),
          email_id: this.current_lead.email_id,
          address_line1: this.current_lead.address_line1,
          demat_account: f.find('[name="demat_account"]').val(),
          pan_card: f.find('[name="pan_card"]').val(),
          aadhar_card: f.find('[name="aadhar_card"]').val(),
          bank_account: f.find('[name="bank_account"]').val(),
          bank_ifsc: f.find('[name="bank_ifsc"]').val(),
          lead_name: this.current_lead.name,
          customer_group: 'Individual'
        };
        frappe.call({
          method: 'frappe.client.insert',
          args: { doc },
          freeze: true
        }).then(r => {
          this.current_customer = r.message.name;
          localStorage.setItem(RMCommon.storage_keys.customer, this.current_customer);
          this.populate_customer_view();
          this.goto_view('customer');
        });
      } else if (this.current_customer) {
        // Update existing customer
        const f = $('#customer-kyc-form');
        const fields = {
          mobile_no: f.find('[name="phone"]').val(),
          whatsapp_no: f.find('[name="whatsapp_no"]').val(),
          pan_card: f.find('[name="pan_card"]').val(),
          aadhar_card: f.find('[name="aadhar_card"]').val(),
          bank_account: f.find('[name="bank_account"]').val(),
          bank_ifsc: f.find('[name="bank_ifsc"]').val()
        };
        frappe.call({
          method: 'frappe.client.set_value',
          args: {
            doctype: 'Customer',
            name: this.current_customer,
            fieldname: fields
          },
          freeze: true
        }).then(() => {
          this.populate_customer_view();
        });
      }
    }
  
    /* ------------ PAYMENT & SALES ORDER ------------ */
  
    save_payment() {
      if (!this.current_customer) {
        frappe.msgprint('Select or create a customer first.');
        return;
      }
      const f = $('#payment-form');
      const doc = {
        doctype: 'Payment Entry',
        payment_type: 'Receive',
        party_type: 'Customer',
        party: this.current_customer,
        paid_from: 'Debtors - Company', // adjust
        paid_to: 'Bank - Company',      // adjust
        paid_amount: flt(f.find('[name="paid_amount"]').val()),
        mode_of_payment: 'Wire Transfer',
        reference_no: f.find('[name="reference_no"]').val()
      };
      frappe.call({
        method: 'frappe.client.insert',
        args: { doc },
        freeze: true
      }).then(() => {
        $('#payment-form [name="paid_amount"]').val('');
        $('#payment-form [name="reference_no"]').val('');
        this.goto_view('sales-order');
        $('#sales-order-form [name="customer"]').val(this.current_customer);
      });
    }
  
    add_item_row() {
      const row = $(`
        <div class="d-flex mb-2 gap-2 rm-item-row">
          <input type="text" class="form-control" placeholder="Item Code">
          <input type="number" class="form-control" placeholder="Qty" min="1" value="1">
        </div>
      `);
      $('#item-table').append(row);
    }
  
    save_sales_order() {
      if (!this.current_customer) {
        frappe.msgprint('Select or create a customer first.');
        return;
      }
      const rows = [];
      $('#item-table .rm-item-row').each(function () {
        const item_code = $(this).find('input').eq(0).val();
        const qty = flt($(this).find('input').eq(1).val());
        if (item_code && qty) rows.push({ item_code, qty });
      });
  
      const doc = {
        doctype: 'Sales Order',
        customer: this.current_customer,
        items: rows
      };
      frappe.call({
        method: 'frappe.client.insert',
        args: { doc },
        freeze: true
      }).then(r => {
        frappe.msgprint(`Sales Order ${r.message.name} created.`);
      });
    }
  }
  

  window.RMCommon = {
    storage_keys: {
      lead: 'rm_current_lead',
      customer: 'rm_current_customer'
    },
  
    set_step(step) {
      const order = ['lead', 'customer', 'payment', 'sales-order'];
      $('.rm-step').removeClass('rm-step-active rm-step-complete');
      let reached = false;
      $('.rm-step').each(function () {
        const s = $(this).data('step');
        if (!reached && s !== step) {
          $(this).addClass('rm-step-complete');
        } else if (s === step) {
          $(this).addClass('rm-step-active');
          reached = true;
        }
      });
    },
  
    load_item_prices(target_selector) {
      frappe.call({
        method: 'supremusangel.supremus_angel.api.rm_dashboard.get_item_prices',
      }).then(r => {
        const list = $(target_selector).empty();
        (r.message || []).forEach(item => {
          list.append(`
            <div class="rm-item-card">
              <img src="${item.image || '/assets/frappe/images/ui.png'}"
                   class="rm-item-image" alt="${frappe.utils.escape_html(item.item_name || item.name)}">
              <div>${frappe.utils.escape_html(item.item_name || item.name)}</div>
              <div class="rm-item-price">${format_currency(item.price_list_rate || 0)}</div>
            </div>
          `);
        });
      });
    },
  
    load_customer_purchase_history(customer, tbody_selector) {
      frappe.call({
        method: 'supremusangel.supremus_angel.api.rm_dashboard.get_item_wise_purchase_history',
        args: {
          customer: customer
        }
      }).then(r => {
        const rows = r.message || [];
        const tbody = $(tbody_selector).empty();
        if (!rows.length) {
          tbody.append('<tr><td colspan="4" class="text-muted">No purchases yet.</td></tr>');
          return;
        }
        rows.forEach(row => {
          const url = `/app/sales-invoice/${r.message.name}`;
          tbody.append(`
            <tr>
              <td>${frappe.utils.escape_html(row.item_code || '')}</td>
              <td>${frappe.datetime.str_to_user(row.posting_date)}</td>
              <td>${format_currency(row.rate || 0)}</td>
              <td><a href="${url}" target="_blank">${row.name}</a></td>
            </tr>
          `);
        });
      });
    },
  
    load_customer_events(customer, tbody_selector) {
      frappe.call({
        method: 'frappe.client.get_list',
        args: {
          doctype: 'Event',
          filters: {
            reference_doctype: 'Customer',
            reference_docname: customer,
            starts_on: ['>=', frappe.datetime.get_today()]
          },
          fields: ['name', 'subject', 'starts_on'],
          order_by: 'starts_on asc',
          limit: 10
        }
      }).then(r => {
        const rows = r.message || [];
        const tbody = $(tbody_selector).empty();
        if (!rows.length) {
          tbody.append('<tr><td colspan="2" class="text-muted">No upcoming events.</td></tr>');
          return;
        }
        rows.forEach(ev => {
          tbody.append(`
            <tr>
              <td>${frappe.datetime.str_to_user(ev.starts_on)}</td>
              <td>${frappe.utils.escape_html(ev.subject || '')}</td>
            </tr>
          `);
        });
      });
    },
  
    workflow_badge_class(state) {
      if (!state) return '';
      const s = state.toLowerCase();
      if (s.includes('verified') || s.includes('approved')) return 'rm-state-badge rm-state-success';
      if (s.includes('pending') || s.includes('review')) return 'rm-state-badge rm-state-warning';
      if (s.includes('rejected') || s.includes('cancel')) return 'rm-state-badge rm-state-danger';
      return 'rm-state-badge';
    }
  };