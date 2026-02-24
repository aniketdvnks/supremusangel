// // frappe.pages['rm-dashboard'].on_page_load = function(wrapper) {
// // 	var page = frappe.ui.make_app_page({
// // 		parent: wrapper,
// // 		title: 'RM Dashboard',
// // 		single_column: true
// // 	});
// // }

// frappe.pages['rm-dashboard'].on_page_load = function(wrapper) {
// 	new RMDashboard(wrapper);
//   };
  
//   class RMDashboard {
// 	constructor(wrapper) {
// 	  this.wrapper = $(wrapper);
// 	  this.page = frappe.ui.make_app_page({
// 		parent: wrapper,
// 		title: 'RM Lead Dashboard',
// 		single_column: true
// 	  });
// 	  $(frappe.render_template('rm_dashboard')).appendTo(this.page.body); // assuming template name
  
// 	  this.current_lead = null;
// 	  this.customer_name = null;
// 	  this.items = [];
  
// 	  this.bind_events();
// 	  this.load_assigned_leads();
// 	}
  
// 	bind_events() {
// 	  const me = this;
  
// 	  // Load Lead
// 	  $('#load-lead').click(() => this.load_selected_lead());
// 	  $('#lead-selector').change(() => this.load_selected_lead());
  
// 	  // Activities
// 	  $('#new-meeting').click(() => this.create_activity('Meeting'));
// 	  $('#update-meeting').click(() => this.update_meeting());
// 	  $('#upload-selfie').click(() => this.upload_proof());
// 	  $('#onboard-customer').click(() => this.goto_step('customer'));
  
// 	  // Customer
// 	  $('#customer-back').click(() => this.goto_step('lead'));
// 	  $('#save-customer').click(() => this.save_customer());
  
// 	  // Payment
// 	  $('#payment-back').click(() => this.goto_step('customer'));
// 	  $('#save-payment').click(() => this.save_payment());
  
// 	  // SO
// 	  $('#so-back').click(() => this.goto_step('payment'));
// 	  $('#save-so').click(() => this.save_sales_order());
// 	  $('#add-item').click(() => this.add_item_row());
// 	}
  
// 	load_assigned_leads() {
// 	  frappe.call({
// 		method: 'frappe.client.get_list',
// 		args: {
// 		  doctype: 'Lead',
// 		  filters: { assigned_to: frappe.session.user },
// 		  fields: ['name', 'lead_name']
// 		}
// 	  }).then(r => {
// 		const select = $('#lead-selector');
// 		select.empty().append('<option value="">-- Select --</option>');
// 		r.message.forEach(lead => select.append(`<option value="${lead.name}">${lead.lead_name}</option>`));
// 	  });
// 	}
  
// 	load_selected_lead() {
// 	  const lead_name = $('#lead-selector').val();
// 	  if (!lead_name) return;
  
// 	  frappe.call({
// 		method: 'frappe.client.get',
// 		args: { doctype: 'Lead', name: lead_name }
// 	  }).then(r => {
// 		this.current_lead = r.message;
// 		this.populate_lead_details();
// 		this.load_timeline();
// 		$('#lead-title').text(`Lead: ${r.message.lead_name}`);
// 	  });
// 	}
  
// 	populate_lead_details() {
// 	  const lead = this.current_lead;
// 	  $('#lead_name').text(lead.lead_name || '-');
// 	  $('#phone').text(lead.phone || '-');
// 	  $('#whatsapp').text(lead.mobile_no || '-'); // assuming whatsapp_no = mobile_no
// 	  $('#email_id').text(lead.email_id || '-');
// 	  $('#address').text(lead.address_line1 || '-');
// 	}
  
// 	load_timeline() {
// 	  frappe.call({
// 		method: 'frappe.client.get_list',
// 		args: {
// 		  doctype: 'Version',
// 		  filters: { docname: this.current_lead.name },
// 		  fields: ['modified', 'user', 'data'],
// 		  order_by: 'modified asc',
// 		  limit: 20
// 		}
// 	  }).then(r => {
// 		const timeline = $('#timeline').empty();
// 		r.message.forEach(v => {
// 		  timeline.append(`
// 			<div class="timeline-item">
// 			  <strong>${frappe.datetime.str_to_user(v.modified)}</strong> by ${v.user}<br>
// 			  ${JSON.parse(v.data || '{}').subject || 'Activity'}
// 			</div>
// 		  `);
// 		});
// 	  });
// 	}
  
// 	create_activity(type) {
// 	  // Create Communication or Event
// 	  const doc = {
// 		doctype: 'Communication',
// 		communication_type: 'Communication',
// 		communication_medium: 'Phone',
// 		subject: `${type} with ${this.current_lead.lead_name}`,
// 		reference_doctype: 'Lead',
// 		reference_name: this.current_lead.name
// 	  };
// 	  frappe.call({ method: 'frappe.client.insert', args: { doc } });
// 	  frappe.msgprint(`${type} logged in timeline.`);
// 	  this.load_timeline();
// 	}
  
// 	upload_proof() {
// 	  frappe.call({
// 		method: 'frappe.upload.make',
// 		args: { method: 'upload_file', args: { is_private: 1 } },
// 		callback: (r) => {
// 		  frappe.call({
// 			method: 'frappe.client.insert',
// 			args: {
// 			  doc: {
// 				doctype: 'Communication',
// 				communication_type: 'Communication',
// 				subject: 'Selfie/Signboard Proof',
// 				reference_doctype: 'Lead',
// 				reference_name: this.current_lead.name,
// 				attachments: r.message.file_url
// 			  }
// 			}
// 		  });
// 		  this.load_timeline();
// 		}
// 	  });
// 	}
  
// 	goto_step(step) {
// 	  $('.section').removeClass('active');
// 	  $(`#${step}-section`).addClass('active');
// 	}
  
// 	save_customer() {
// 	  const $form = $('#customer-form');
// 	  const doc = {
// 		doctype: 'Customer',
// 		customer_name: $form.find('[name="customer_name"]').val(),
// 		mobile_no: $form.find('[name="phone"]').val(),
// 		// whatsapp_no: custom field
// 		email_id: $form.find('[name="email_id"]').val(),
// 		address_line1: $form.find('[name="address_line1"]').val(),
// 		demat_account: $form.find('[name="demat_account"]').val(), // custom
// 		pan_card: $form.find('[name="pan_card"]').val(), // custom
// 		aadhar_card: $form.find('[name="aadhar_card"]').val(), // custom
// 		bank_account: $form.find('[name="bank_account"]').val(), // custom
// 		bank_ifsc: $form.find('[name="bank_ifsc"]').val(), // custom
// 		customer_group: 'Individual' // or Commercial
// 	  };
  
// 	  frappe.call({
// 		method: 'frappe.client.insert',
// 		args: { doc },
// 		freeze: true
// 	  }).then(r => {
// 		this.customer_name = r.message.name;
// 		$form.find('[name="customer"]').val(this.customer_name); // for next steps
// 		frappe.workflow.setup('Customer', r.message.name, 'Pending Verification'); // Workflow state
// 		this.goto_step('payment');
// 	  });
// 	}
  
// 	save_payment() {
// 	  const $form = $('#payment-form');
// 	  const doc = {
// 		doctype: 'Payment Entry',
// 		payment_type: 'Receive',
// 		party_type: 'Customer',
// 		party: this.customer_name,
// 		paid_from: 'Your Bank - XXX', // Company bank
// 		paid_to: 'Customer Bank', // mode: Wire Transfer hardcoded
// 		paid_amount: flt($form.find('[name="paid_amount"]').val()),
// 		mode_of_payment: 'Wire Transfer',
// 		reference_no: $form.find('[name="reference_no"]').val(),
// 		bank_account: $form.find('[name="customer_bank"]').val() // from KYC
// 	  };
  
// 	  frappe.call({
// 		method: 'frappe.client.insert',
// 		args: { doc },
// 		freeze: true
// 	  }).then(r => {
// 		frappe.workflow.setup('Payment Entry', r.message.name, 'Pending Share Transfer Approval');
// 		this.goto_step('sales-order');
// 	  });
// 	}
  
// 	add_item_row() {
// 	  const row = $(`
// 		<div class="item-row">
// 		  <select class="item-select">
// 			<!-- Load items via frappe.db.get_list('Item') -->
// 		  </select>
// 		  <input type="number" class="qty" placeholder="Qty" min="1">
// 		  <button type="button" class="btn btn-sm btn-danger remove-row">Remove</button>
// 		</div>
// 	  `);
// 	  $('#item-table').append(row);
// 	  this.items.push({ row });
// 	}
  
// 	save_sales_order() {
// 	  // Build SO with items, submit
// 	  // After submit, notify via Email using Notification doctype
// 	  frappe.ui.show_confirm_dialog({
// 		message: 'Process complete! Share Transfer Team will handle verification & Delivery Note.',
// 		primary_action: () => {
// 		  $('#complete-modal').modal('show');
// 		}
// 	  });
// 	}
//   }
  

frappe.pages['rm-dashboard'].on_page_load = function(wrapper) {
	new RMDashboard(wrapper);
  };
  
  class RMDashboard {
	constructor(wrapper) {
	  this.wrapper = $(wrapper);
	  this.page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'RM Lead Dashboard',
		single_column: true
	  });
	  $(frappe.render_template('rm_dashboard')).appendTo(this.page.body); // your HTML template
  
	  this.current_lead = null;
	  this.customer_name = null;
	  this.items = [];
	  this.storage_key = 'rm_current_lead'; // localStorage key
  
	  this.bind_events();
	  this.check_persistent_lead(); // NEW: Check localStorage first
	}
  
	// NEW: Check localStorage for persistent lead
	check_persistent_lead() {
	  const saved_lead = localStorage.getItem(this.storage_key);
	  if (saved_lead) {
		frappe.call({
		  method: 'frappe.client.exists',
		  args: { doctype: 'Lead', name: saved_lead }
		}).then(r => {
		  if (r.message) {
			// Valid lead found in storage → auto-load
			this.load_lead_by_name(saved_lead);
		  } else {
			// Invalid/removed lead → clear storage & show selector
			localStorage.removeItem(this.storage_key);
			this.show_lead_selector();
		  }
		});
	  } else {
		// No saved lead → show selector
		this.show_lead_selector();
	  }
	}
  
	// NEW: Show lead selector dialog (modal instead of inline for better UX)
	show_lead_selector() {
	  const dialog = new frappe.ui.Dialog({
		title: 'Select Assigned Lead',
		fields: [
		  {
			fieldtype: 'Link',
			label: 'Lead',
			fieldname: 'lead',
			options: 'Lead',
			reqd: 1,
		  }
		],
		primary_action_label: 'Load Lead',
		primary_action: (values) => {
		  this.set_current_lead(values.lead);
		  dialog.hide();
		}
	  });
	  dialog.show();
	}
  
	// NEW: Load lead by name (used for persistent load)
	load_lead_by_name(lead_name) {
	  frappe.call({
		method: 'frappe.client.get',
		args: { doctype: 'Lead', name: lead_name }
	  }).then(r => {
		this.current_lead = r.message;
		this.render_lead_page();
	  });
	}
  
	// NEW: Set current lead & persist
	set_current_lead(lead_name) {
	  this.current_lead = { name: lead_name };
	  localStorage.setItem(this.storage_key, lead_name);
	  this.load_lead_by_name(lead_name);
	}
  
	// UPDATED: Load assigned leads (for reference, not primary UI)
	load_assigned_leads() {
	  // Optional: Keep for "Switch Lead" dropdown if needed
	}
  
	// NEW: Render full lead page after selection
	render_lead_page() {
	  this.populate_lead_details();
	  this.load_timeline();
	  $('#lead-title').text(`Lead: ${this.current_lead.lead_name}`);
  
	  // NEW: Add Switch Lead button
	  if (!$('#switch-lead-btn').length) {
		$('.rm-dashboard .section:first .activities').prepend(`
		  <button class="btn btn-outline-secondary" id="switch-lead-btn">
			🔄 Switch Lead
		  </button>
		`);
		$('#switch-lead-btn').click(() => {
		  localStorage.removeItem(this.storage_key);
		  this.show_lead_selector();
		});
	  }
  
	  // Hide selector, show lead section
	  $('.section').removeClass('active');
	  $('#lead-section').addClass('active');
	}
  
	// UPDATED: populate_lead_details (uses this.current_lead)
	populate_lead_details() {
	  const lead = this.current_lead;
	  $('#lead_name').text(lead.lead_name || '-');
	  $('#phone').text(lead.phone || '-');
	  $('#whatsapp').text(lead.mobile_no || lead.whatsapp_no || '-');
	  $('#email_id').text(lead.email_id || '-');
	  $('#address').text(lead.address_line1 || '-');
  
	  // Auto-fill for customer step if accessed
	  $('#customer-form [name="customer_name"]').val(lead.lead_name);
	  $('#customer-form [name="phone"]').val(lead.phone);
	  $('#customer-form [name="whatsapp_no"]').val(lead.mobile_no);
	  $('#customer-form [name="email_id"]').val(lead.email_id);
	  $('#customer-form [name="address_line1"]').val(lead.address_line1);
	}
  
	load_timeline() {
	  frappe.call({
		method: 'frappe.client.get_list',
		args: {
		  doctype: 'Communication',
		  filters: { 
			reference_doctype: 'Lead', 
			reference_name: this.current_lead.name 
		  },
		  fields: ['creation', 'sender', 'subject', 'content'],
		  order_by: 'creation asc',
		  limit: 20
		}
	  }).then(r => {
		const timeline = $('#timeline').empty();
		r.message.forEach(c => {
		  timeline.append(`
			<div class="timeline-item">
			  <strong>${frappe.datetime.str_to_user(c.creation)}</strong><br>
			  <small>By: ${c.sender}</small><br>
			  ${c.subject || c.content?.slice(0, 100)}
			</div>
		  `);
		});
	  });
	}
  
	// Rest of methods unchanged...
	create_activity(type) {
	  const doc = {
		doctype: 'Communication',
		communication_type: 'Communication',
		communication_medium: 'Email',
		subject: `${type} - ${this.current_lead.lead_name}`,
		reference_doctype: 'Lead',
		reference_name: this.current_lead.name,
		content: `Activity: ${type}`
	  };
	  frappe.call({ 
		method: 'frappe.client.insert', 
		args: { doc },
		callback: () => {
		  frappe.msgprint(`${type} added to timeline.`);
		  this.load_timeline();
		}
	  });
	}
  
	upload_proof() {
	  frappe.upload.make({
		method: 'upload_file',
		args: { 
		  is_private: 1,
		  reference_doctype: 'Lead',
		  reference_name: this.current_lead.name
		},
		callback: (r) => {
		  const doc = {
			doctype: 'Communication',
			subject: 'Selfie/Signboard Proof',
			reference_doctype: 'Lead',
			reference_name: this.current_lead.name,
			attachments: r.message.file_url
		  };
		  frappe.call({ method: 'frappe.client.insert', args: { doc } });
		  this.load_timeline();
		}
	  });
	}
  
	goto_step(step) {
	  $('.section').removeClass('active');
	  $(`#${step}-section`).addClass('active');
	}
  
	// ... (save_customer, save_payment, etc. remain the same, using this.customer_name)
	
	bind_events() {
	  const me = this;
	  // Activities
	  $(document).on('click', '#new-meeting', () => this.create_activity('Meeting'));
	  $(document).on('click', '#update-meeting', () => this.create_activity('Meeting Status Update'));
	  $(document).on('click', '#upload-selfie', () => this.upload_proof());
	  $(document).on('click', '#onboard-customer', () => this.goto_step('customer'));
  
	  // Customer/Payment/SO events (same as before)
	  $(document).on('click', '#customer-back', () => this.goto_step('lead'));
	  $(document).on('click', '#save-customer', () => this.save_customer());
	  // ... other buttons
	}
  }
  