frappe.provide('frappe.RMDashboard');

frappe.RMDashboard.RMCustomerModule = class {
  constructor(controller) {
    this.controller = controller;
    this.state = RMDashboardState;
  }

  /**
   * Load customer by name
   */
  load_customer(name) {
    return frappe.call({
      method: 'frappe.client.get',
      args: { doctype: 'Customer', name }
    }).then(r => {
      const customer = r.message;
      const email = customer.email_id || customer.primary_contact_email || '';
      
      this.state.set_customer(name, customer, email);
      this.populate_customer_view(customer);
      this.load_purchase_history();
      this.load_events();
      return customer;
    }).catch(err => {
      frappe.msgprint(__('Failed to load customer: {0}', [err.message || err]));
    });
  }

  /**
   * Populate customer view with data
   */
  populate_customer_view(customer) {
    $('#cust_name_view').text(customer.customer_name || customer.name);
    $('#cust_email_view').text(customer.email_id || customer.primary_contact_email || '-');
    $('#cust_phone_view').text(customer.mobile_no || customer.phone || '-');
    $('#cust_group_view').text(customer.customer_group || '-');
    
    const state = customer.workflow_state || customer.disabled ? __('Disabled') : __('Active');
    const badge_class = customer.disabled ? 'rm-state-badge rm-state-danger' : 'rm-state-badge rm-state-success';
    $('#cust_state_view').html(`<span class="${badge_class}">${frappe.utils.escape_html(state)}</span>`);
  }

  /**
   * Load purchase history
   */
  load_purchase_history() {
    const { customer } = this.state.get();
    if (!customer) return;
    RMCommon.load_customer_purchase_history(customer, '#cust_purchase_body');
  }

  /**
   * Load customer events
   */
  load_events() {
    const { customer } = this.state.get();
    if (!customer) return;
    RMCommon.load_customer_events(customer, '#cust_events_body');
  }

  /**
   * Show customer selector dialog
   */
  show_customer_selector() {
    new frappe.ui.form.LinkSelector({
      doctype: 'Customer',
      target: null,
      txt: '',
      filters: { disabled: 0 },
      onselect: (customer) => {
        this.load_customer(customer);
        this.controller.goto_view('customer');
      }
    });
  }

  /**
   * Prepare customer creation from lead
   */
  prepare_from_lead() {
    const { lead } = this.state.get();
    if (!lead) {
      frappe.msgprint(__('No lead selected'));
      return;
    }

    $('#customer-kyc-form [name="customer_name"]').val(lead.lead_name || lead.company_name || '');
    $('#customer-kyc-form [name="customer_type"]').val(lead.company_name ? 'Company' : 'Individual');
    $('#customer-kyc-form [name="email_id"]').val(lead.email_id || '');
    $('#customer-kyc-form [name="mobile_no"]').val(lead.mobile_no || lead.phone || '');
    $('#customer-kyc-form [name="lead_name"]').val(lead.name);
  }

  /**
   * Save customer (onboard from lead or create new)
   */
  save_customer(form_data) {
    return frappe.call({
      method: 'supremusangel.supremus_angel.api.rm_dashboard.create_customer',
      args: { data: form_data },
      freeze: true,
      freeze_message: __('Creating customer...')
    }).then(r => {
      const customer_name = r.message.name;
      frappe.show_alert({ message: __('Customer {0} created', [customer_name]), indicator: 'green' });
      
      this.load_customer(customer_name);
      this.controller.goto_view('customer');
      return customer_name;
    }).catch(err => {
      frappe.msgprint(__('Failed to create customer: {0}', [err.message || err]));
      throw err;
    });
  }
}

frappe.RMDashboard.customer = new frappe.RMDashboard.RMCustomerModule();

// window.RMCustomerModule = RMCustomerModule;
