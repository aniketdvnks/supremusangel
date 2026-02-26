frappe.pages['rm-customer-dashboard'].on_page_load = function(wrapper) {
    new RMCustomerDashboard(wrapper);
  };
  
  class RMCustomerDashboard {
    constructor(wrapper) {
      this.wrapper = $(wrapper);
      this.page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'RM Customer Dashboard',
        single_column: false
      });
      $(frappe.render_template('rm_customer_dashboard')).appendTo(this.page.body);
  
      this.customer_name = null;
  
      this.init_sidebar();
      this.bind_events();
      this.init_customer_from_storage_or_dialog();
    }
  
    init_sidebar() {
      RMCommon.load_item_prices('#sidebar-item-prices');
    }
  
    bind_events() {
      $('#switch-customer-btn').on('click', () => this.show_customer_selector());
  
      $('#btn-save-kyc').on('click', () => this.save_kyc());
      $('#btn-payment-back').on('click', () => this.show_customer_main());
      $('#btn-save-payment').on('click', () => this.save_payment());
      $('#btn-so-back').on('click', () => this.show_payment());
      $('#btn-save-so').on('click', () => this.save_sales_order());
      $('#btn-add-item').on('click', () => this.add_item_row());
    }
  
    init_customer_from_storage_or_dialog() {
      const saved = localStorage.getItem(RMCommon.storage_keys.customer);
      if (saved) {
        this.load_customer(saved);
      } else {
        this.show_customer_selector();
      }
    }
  
    show_customer_selector() {
      const d = new frappe.ui.Dialog({
        title: 'Select Customer',
        fields: [
          {
            fieldtype: 'Link',
            fieldname: 'customer',
            label: 'Customer',
            options: 'Customer',
            reqd: 1
          }
        ],
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
        const c = r.message;
        this.customer_name = c.name;
        $('#customer-title').text(`Customer: ${c.customer_name || c.name}`);
        $('#cust_name_view').text(c.customer_name || c.name);
        $('#cust_demat_view').text(c.demat_account || '-');
        $('#cust_bank_view').text(c.bank_account || '-');
  
        const state = c.workflow_state;
        const cls = RMCommon.workflow_badge_class(state);
        $('#cust_state_view').html(
          state ? `<span class="${cls}">${frappe.utils.escape_html(state)}</span>` : ''
        );
  
        const f = $('#customer-kyc-form');
        f.find('[name="phone"]').val(c.mobile_no || '');
        f.find('[name="whatsapp_no"]').val(c.whatsapp_no || '');
        f.find('[name="pan_card"]').val(c.pan_card || '');
        f.find('[name="aadhar_card"]').val(c.aadhar_card || '');
        f.find('[name="bank_account"]').val(c.bank_account || '');
        f.find('[name="bank_ifsc"]').val(c.bank_ifsc || '');
  
        RMCommon.load_customer_events(this.customer_name, '#cust_events_body');
        RMCommon.load_customer_purchase_history(this.customer_name, '#cust_history_body');
  
        RMCommon.set_step('customer');
        this.show_customer_main();
      });
    }
  
    show_customer_main() {
      $('#customer-main-section').show();
      $('#customer-history-section').show();
      $('#payment-section, #sales-order-section').hide();
      RMCommon.set_step('customer');
    }
  
    save_kyc() {
      const f = $('#customer-kyc-form');
      const doc = {
        name: this.customer_name,
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
          name: this.customer_name,
          fieldname: doc
        },
        freeze: true
      }).then(() => {
        frappe.msgprint('KYC updated.');
      });
    }
  
    /* Payment + SO same as in lead dashboard, reusing customer_name */
    show_payment() {
      $('#customer-main-section, #customer-history-section').hide();
      $('#payment-section').show();
      $('#sales-order-section').hide();
      RMCommon.set_step('payment');
      $('#payment-form [name="party"]').val(this.customer_name || '');
    }
  
    save_payment() {
      const f = $('#payment-form');
      const doc = {
        doctype: 'Payment Entry',
        payment_type: 'Receive',
        party_type: 'Customer',
        party: this.customer_name,
        paid_from: 'Debtors - Company',
        paid_to: 'Bank - Company',
        paid_amount: flt(f.find('[name="paid_amount"]').val()),
        mode_of_payment: 'Wire Transfer',
        reference_no: f.find('[name="reference_no"]').val()
      };
      frappe.call({
        method: 'frappe.client.insert',
        args: { doc },
        freeze: true
      }).then(() => {
        this.show_sales_order();
      });
    }
  
    show_sales_order() {
      $('#customer-main-section, #customer-history-section, #payment-section').hide();
      $('#sales-order-section').show();
      RMCommon.set_step('sales-order');
      $('#sales-order-form [name="customer"]').val(this.customer_name || '');
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
      const rows = [];
      $('#item-table .rm-item-row').each(function () {
        const item_code = $(this).find('input').eq(0).val();
        const qty = flt($(this).find('input').eq(1).val());
        if (item_code && qty) rows.push({ item_code, qty });
      });
      const doc = {
        doctype: 'Sales Order',
        customer: this.customer_name,
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
  