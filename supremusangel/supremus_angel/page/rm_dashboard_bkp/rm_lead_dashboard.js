frappe.pages['rm-lead-dashboard'].on_page_load = function(wrapper) {
	new RMLeadDashboard(wrapper);
  };
  
  class RMLeadDashboard {
	constructor(wrapper) {
	  this.wrapper = $(wrapper);
	  this.page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'RM Lead Dashboard',
		single_column: false
	  });
	  $(frappe.render_template('rm_lead_dashboard')).appendTo(this.page.body);
  
	  this.current_lead = null;
	  this.customer_name = null;
  
	  this.init_sidebar();
	  this.bind_events();
	  this.init_lead_from_storage_or_dialog();
	}
  
	init_sidebar() {
	  RMCommon.load_item_prices('#sidebar-item-prices');
	}
  
	bind_events() {
	  $('#switch-lead-btn').on('click', () => this.show_lead_selector());
  
	  $('#btn-new-meeting').on('click', () => this.log_activity('Meeting'));
	  $('#btn-update-meeting').on('click', () => this.log_activity('Meeting Status Update'));
	  $('#btn-upload-selfie').on('click', () => this.upload_proof());
  
	  $('#btn-onboard-customer').on('click', () => {
		if (!$('#btn-onboard-customer').prop('disabled')) {
		  this.show_customer_section();
		}
	  });
  
	  $('#btn-customer-back').on('click', () => this.show_lead_section());
	  $('#btn-save-customer').on('click', () => this.save_customer());
  
	  $('#btn-payment-back').on('click', () => this.show_customer_section());
	  $('#btn-save-payment').on('click', () => this.save_payment());
  
	  $('#btn-so-back').on('click', () => this.show_payment_section());
	  $('#btn-save-so').on('click', () => this.save_sales_order());
  
	  $('#btn-add-item').on('click', () => this.add_item_row());
	}
  
	init_lead_from_storage_or_dialog() {
	  const key = RMCommon.storage_keys.lead;
	  const saved = localStorage.getItem(key);
	  if (saved) {
		this.load_lead(saved);
	  } else {
		this.show_lead_selector();
	  }
	}
  
	show_lead_selector() {
	  const d = new frappe.ui.Dialog({
		title: 'Select Lead',
		fields: [
		  {
			fieldtype: 'Link',
			fieldname: 'lead',
			label: 'Lead',
			options: 'Lead',
			reqd: 1,
			get_query: () => ({
			  filters: { assigned_to: frappe.session.user }
			})
		  }
		],
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
  
		this.load_lead_timeline();
		this.check_lead_customer_link();
		RMCommon.set_step('lead');
		this.show_lead_section();
	  });
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
	  // uses has_customer logic from lead.py [web:20]
	  frappe.call({
		method: 'frappe.db.get_value',
		args: {
		  doctype: 'Customer',
		  fieldname: ['name'],
		  filters: { lead_name: this.current_lead.name }
		}
	  }).then(r => {
		const cust = r.message && r.message.name;
		if (cust) {
		  $('#lead_customer_link').text(cust);
		  $('#btn-onboard-customer').prop('disabled', true)
			.text('Already Onboarded');
		  this.customer_name = cust;
		} else {
		  $('#lead_customer_link').text('No');
		  $('#btn-onboard-customer').prop('disabled', false)
			.text('Onboard as Customer');
		}
	  });
	}
  
	log_activity(type) {
	  const doc = {
		doctype: 'Communication',
		communication_type: 'Communication',
		communication_medium: 'Phone',
		subject: `${type} with ${this.current_lead.lead_name}`,
		reference_doctype: 'Lead',
		reference_name: this.current_lead.name
	  };
	  frappe.call({ method: 'frappe.client.insert', args: { doc } }).then(() => {
		frappe.msgprint(`${type} logged.`);
		this.load_lead_timeline();
	  });
	}
  
	upload_proof() {
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
  
	show_lead_section() {
	  $('#lead-section').show();
	  $('#customer-section, #payment-section, #sales-order-section').hide();
	  RMCommon.set_step('lead');
	}
  
	show_customer_section() {
	  $('#lead-section').hide();
	  $('#customer-section').show();
	  $('#payment-section, #sales-order-section').hide();
	  RMCommon.set_step('customer');
  
	  if (this.customer_name) {
		this.load_customer_into_form(this.customer_name);
	  } else {
		// pre-fill from lead
		const f = $('#customer-form');
		f.find('[name="customer_name"]').val(this.current_lead.lead_name || '');
		f.find('[name="phone"]').val(this.current_lead.phone || '');
		f.find('[name="whatsapp_no"]').val(this.current_lead.mobile_no || '');
		f.find('[name="email_id"]').val(this.current_lead.email_id || '');
		f.find('[name="address_line1"]').val(this.current_lead.address_line1 || '');
	  }
	}
  
	load_customer_into_form(customer) {
	  frappe.call({
		method: 'frappe.client.get',
		args: { doctype: 'Customer', name: customer }
	  }).then(r => {
		const c = r.message;
		const f = $('#customer-form');
		f.find('[name="customer_name"]').val(c.customer_name || c.name);
		f.find('[name="phone"]').val(c.mobile_no || '');
		f.find('[name="whatsapp_no"]').val(c.whatsapp_no || '');
		f.find('[name="email_id"]').val(c.email_id || '');
		f.find('[name="address_line1"]').val(c.address_line1 || '');
		f.find('[name="demat_account"]').val(c.demat_account || '');
		f.find('[name="pan_card"]').val(c.pan_card || '');
		f.find('[name="aadhar_card"]').val(c.aadhar_card || '');
		f.find('[name="bank_account"]').val(c.bank_account || '');
		f.find('[name="bank_ifsc"]').val(c.bank_ifsc || '');
		this.customer_name = c.name;
  
		// workflow_state badge
		const state = c.workflow_state;
		const cls = RMCommon.workflow_badge_class(state);
		$('#customer_state_badge').html(
		  state ? `<span class="${cls}">${frappe.utils.escape_html(state)}</span>` : ''
		);
	  });
	}
  
	save_customer() {
	  const f = $('#customer-form');
	  const doc = {
		doctype: 'Customer',
		customer_name: f.find('[name="customer_name"]').val(),
		mobile_no: f.find('[name="phone"]').val(),
		whatsapp_no: f.find('[name="whatsapp_no"]').val(),
		email_id: f.find('[name="email_id"]').val(),
		address_line1: f.find('[name="address_line1"]').val(),
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
		this.customer_name = r.message.name;
		localStorage.setItem(RMCommon.storage_keys.customer, this.customer_name);
		frappe.msgprint(`Customer ${this.customer_name} created.`);
		this.show_payment_section();
	  });
	}
  
	show_payment_section() {
	  $('#lead-section, #customer-section').hide();
	  $('#payment-section').show();
	  $('#sales-order-section').hide();
	  RMCommon.set_step('payment');
  
	  const f = $('#payment-form');
	  f.find('[name="party"]').val(this.customer_name || '');
	  f.find('[name="customer_bank"]').val(
		$('#customer-form [name="bank_account"]').val() || ''
	  );
	}
  
	save_payment() {
	  const f = $('#payment-form');
	  const doc = {
		doctype: 'Payment Entry',
		payment_type: 'Receive',
		party_type: 'Customer',
		party: f.find('[name="party"]').val(),
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
		this.show_sales_order_section();
	  });
	}
  
	show_sales_order_section() {
	  $('#lead-section, #customer-section, #payment-section').hide();
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
	  // Basic example: you will likely map from Quotation in real use
	  const rows = [];
	  $('#item-table .rm-item-row').each(function () {
		const item_code = $(this).find('input').eq(0).val();
		const qty = flt($(this).find('input').eq(1).val());
		if (item_code && qty) {
		  rows.push({ item_code, qty });
		}
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
  