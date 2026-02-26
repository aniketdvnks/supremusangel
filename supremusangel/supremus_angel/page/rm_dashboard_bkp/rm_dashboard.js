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
	  this.init_mode_and_entity();
	//   this.check_persistent_lead(); // NEW: Check localStorage first
	}
  
	// NEW: Check localStorage for persistent lead
	// check_persistent_lead() {
	//   const saved_lead = localStorage.getItem(this.storage_key);
	//   if (saved_lead) {
	// 	frappe.xcall('frappe.client.get', {
	// 		doctype: 'Lead',
	// 		name: saved_lead,
	// 	}).then(r => {
	// 	  if (r.message) {
	// 		// Valid lead found in storage → auto-load
	// 		this.load_lead_by_name(saved_lead);
	// 	  } else {
	// 		// Invalid/removed lead → clear storage & show selector
	// 		localStorage.removeItem(this.storage_key);
	// 		this.show_lead_selector();
	// 	  }
	// 	});
	//   } else {
	// 	// No saved lead → show selector
	// 	this.show_lead_selector();
	//   }
	// }
	  // initial decision: lead or customer
	  init_mode_and_entity() {
		const saved_customer = localStorage.getItem(this.cust_key);
		const saved_lead = localStorage.getItem(this.lead_key);
	
		if (saved_customer) {
		  this.mode = 'customer';
		  this.highlight_mode();
		  this.load_customer_by_name(saved_customer, true);
		} else if (saved_lead) {
		  this.mode = 'lead';
		  this.highlight_mode();
		  this.load_lead_by_name(saved_lead);
		} else {
		  // nothing saved → ask what to work with
		  this.ask_mode_choice();
		}
	  }
	  ask_mode_choice() {
		const dialog = new frappe.ui.Dialog({
		  title: 'Start With',
		  fields: [
			{
			  fieldtype: 'Select',
			  label: 'Work with',
			  fieldname: 'mode',
			  options: ['Lead', 'Customer'],
			  default: 'Lead',
			  reqd: 1
			}
		  ],
		  primary_action_label: 'Continue',
		  primary_action: (values) => {
			this.mode = values.mode.toLowerCase();
			this.highlight_mode();
			dialog.hide();
			if (this.mode === 'lead') {
			  this.show_lead_selector();
			} else {
			  this.show_customer_selector();
			}
		  }
		});
		dialog.show();
	  }
	// NEW: Show lead selector dialog (modal instead of inline for better UX)
	// show_lead_selector() {
	//   const dialog = new frappe.ui.Dialog({
	// 	title: 'Select Assigned Lead',
	// 	fields: [
	// 	  {
	// 		fieldtype: 'Link',
	// 		label: 'Lead',
	// 		fieldname: 'lead',
	// 		options: 'Lead',
	// 		reqd: 1,
	// 	  }
	// 	],
	// 	primary_action_label: 'Load Lead',
	// 	primary_action: (values) => {
	// 	  this.set_current_lead(values.lead);
	// 	  dialog.hide();
	// 	}
	//   });
	//   dialog.show();
	// }
	highlight_mode() {
		$('.rm-mode-btn').removeClass('btn-primary').addClass('btn-outline-secondary');
		$(`.rm-mode-btn[data-mode="${this.mode}"]`)
		  .removeClass('btn-outline-secondary')
		  .addClass('btn-primary');
	  }
	// NEW: Load lead by name (used for persistent load)
	// load_lead_by_name(lead_name) {
	//   frappe.call({
	// 	method: 'frappe.client.get',
	// 	args: { doctype: 'Lead', name: lead_name }
	//   }).then(r => {
	// 	this.current_lead = r.message;
	// 	this.render_lead_page();
	//   });
	// }
  
	// NEW: Set current lead & persist
	// set_current_lead(lead_name) {
	//   this.current_lead = { name: lead_name };
	//   localStorage.setItem(this.storage_key, lead_name);
	//   this.load_lead_by_name(lead_name);
	// }
  
	// UPDATED: Load assigned leads (for reference, not primary UI)
	// load_assigned_leads() {
	//   // Optional: Keep for "Switch Lead" dropdown if needed
	// }
  
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
  
	// goto_step(step) {
	//   $('.section').removeClass('active');
	//   $(`#${step}-section`).addClass('active');
	// }
	goto_step(step) {
		// existing section toggle
		$('.section').removeClass('active');
		$(`#${step}-section`).addClass('active');
	  
		// map ids -> data-step
		const map = {
		  'lead': 'lead',
		  'customer': 'customer',
		  'payment': 'payment',
		  'sales-order': 'sales-order'
		};
		const current = map[step];
	  
		// reset
		$('.rm-step').removeClass('rm-step-active rm-step-complete');
	  
		let reachedCurrent = false;
		$('.rm-step').each(function() {
		  const s = $(this).data('step');
		  if (!reachedCurrent && s !== current) {
			$(this).addClass('rm-step-complete');
		  } else if (s === current) {
			$(this).addClass('rm-step-active');
			reachedCurrent = true;
		  }
		});
	  }
	  
  
	save_customer() {
		const $form = $('#customer-form');
		const doc = {
		  doctype: 'Customer',
		  customer_name: $form.find('[name="customer_name"]').val(),
		  mobile_no: $form.find('[name="phone"]').val(),
		  // whatsapp_no: custom field
		  email_id: $form.find('[name="email_id"]').val(),
		  address_line1: $form.find('[name="address_line1"]').val(),
		  demat_account: $form.find('[name="demat_account"]').val(), // custom
		  pan_card: $form.find('[name="pan_card"]').val(), // custom
		  aadhar_card: $form.find('[name="aadhar_card"]').val(), // custom
		  bank_account: $form.find('[name="bank_account"]').val(), // custom
		  bank_ifsc: $form.find('[name="bank_ifsc"]').val(), // custom
		  customer_group: 'Individual' // or Commercial
		};
	
		frappe.call({
		  method: 'frappe.client.insert',
		  args: { doc },
		  freeze: true
		}).then(r => {
		  this.customer_name = r.message.name;
		  $form.find('[name="customer"]').val(this.customer_name); // for next steps
		  frappe.workflow.setup('Customer', r.message.name, 'Pending Verification'); // Workflow state
		  this.goto_step('payment');
		});
	  }
	
	  save_payment() {
		const $form = $('#payment-form');
		const doc = {
		  doctype: 'Payment Entry',
		  payment_type: 'Receive',
		  party_type: 'Customer',
		  party: this.customer_name,
		  paid_from: 'Your Bank - XXX', // Company bank
		  paid_to: 'Customer Bank', // mode: Wire Transfer hardcoded
		  paid_amount: flt($form.find('[name="paid_amount"]').val()),
		  mode_of_payment: 'Wire Transfer',
		  reference_no: $form.find('[name="reference_no"]').val(),
		  bank_account: $form.find('[name="customer_bank"]').val() // from KYC
		};
	
		frappe.call({
		  method: 'frappe.client.insert',
		  args: { doc },
		  freeze: true
		}).then(r => {
		  frappe.workflow.setup('Payment Entry', r.message.name, 'Pending Share Transfer Approval');
		  this.goto_step('sales-order');
		});
	  }
	
	  add_item_row() {
		const row = $(`
		  <div class="item-row">
			<select class="item-select">
			  <!-- Load items via frappe.db.get_list('Item') -->
			</select>
			<input type="number" class="qty" placeholder="Qty" min="1">
			<button type="button" class="btn btn-sm btn-danger remove-row">Remove</button>
		  </div>
		`);
		$('#item-table').append(row);
		this.items.push({ row });
	  }
	
	  save_sales_order() {
		// Build SO with items, submit
		// After submit, notify via Email using Notification doctype
		frappe.ui.show_confirm_dialog({
		  message: 'Process complete! Share Transfer Team will handle verification & Delivery Note.',
		  primary_action: () => {
			$('#complete-modal').modal('show');
		  }
		});
	  }
	
	  bind_events() {
		// mode buttons
		$(document).on('click', '.rm-mode-btn', (e) => {
		  const mode = $(e.currentTarget).data('mode');
		  this.mode = mode;
		  this.highlight_mode();
		  if (mode === 'lead') {
			this.show_lead_selector();
		  } else {
			this.show_customer_selector();
		  }
		});
	
		// tabs: Lead / Customer context
		$(document).on('click', '#rm-main-tabs .nav-link', function () {
		  $('#rm-main-tabs .nav-link').removeClass('active');
		  $(this).addClass('active');
		  const target = $(this).data('target');
		  $('#lead-context, #customer-context').hide();
		  $(`#${target}`).show();
		});
	
		// existing: meetings, onboarding, navigation, etc.
		$(document).on('click', '#new-meeting', () => this.create_activity('Meeting'));
		$(document).on('click', '#update-meeting', () => this.create_activity('Meeting Status Update'));
		$(document).on('click', '#upload-selfie', () => this.upload_proof());
		$(document).on('click', '#onboard-customer', () => this.goto_step('customer'));
	
		$(document).on('click', '#customer-back', () => this.goto_step('lead'));
		$(document).on('click', '#save-customer', () => this.save_customer());
		$(document).on('click', '#payment-back', () => this.goto_step('customer'));
		$(document).on('click', '#save-payment', () => this.save_payment());
		$(document).on('click', '#so-back', () => this.goto_step('payment'));
		$(document).on('click', '#save-so', () => this.save_sales_order());
		$(document).on('click', '#add-item', () => this.add_item_row());
	  }
	
	  /* ---------- LEAD FLOW ---------- */
	
	  show_lead_selector() {
		const dialog = new frappe.ui.Dialog({
		  title: 'Select Lead',
		  fields: [
			{
			  fieldtype: 'Link',
			  fieldname: 'lead',
			  label: 'Lead',
			  options: 'Lead',
			  reqd: 1,
			  get_query: () => ({
				filters: { lead_owner: frappe.session.user }
			  })
			}
		  ],
		  primary_action_label: 'Load',
		  primary_action: (values) => {
			dialog.hide();
			this.set_current_lead(values.lead);
		  }
		});
		dialog.show();
	  }
	
	  set_current_lead(lead_name) {
		this.current_lead = { name: lead_name };
		localStorage.setItem(this.lead_key, lead_name);
		this.load_lead_by_name(lead_name);
	  }
	
	  load_lead_by_name(lead_name) {
		frappe.call({
		  method: 'frappe.client.get',
		  args: { doctype: 'Lead', name: lead_name }
		}).then(r => {
		  this.current_lead = r.message;
		  this.render_lead_page();
		});
	  }
	
	  render_lead_page() {
		this.populate_lead_details();
		this.load_timeline();
		$('#lead-title').text(`Lead: ${this.current_lead.lead_name}`);
		this.goto_step('lead'); // for wizard
	  }
	
	  /* ---------- CUSTOMER FLOW ---------- */
	
	  show_customer_selector() {
		const dialog = new frappe.ui.Dialog({
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
			dialog.hide();
			this.set_current_customer(values.customer, true);
		  }
		});
		dialog.show();
	  }
	
	  set_current_customer(customer_name, jump_to_customer_section=false) {
		this.customer_name = customer_name;
		localStorage.setItem(this.cust_key, customer_name);
		this.load_customer_by_name(customer_name, jump_to_customer_section);
	  }
	
	  load_customer_by_name(customer_name, jump_to_customer_section=false) {
		frappe.call({
		  method: 'frappe.client.get',
		  args: { doctype: 'Customer', name: customer_name }
		}).then(r => {
		  const cust = r.message;
		  this.customer_name = cust.name;
	
		  // snapshot fields
		  $('#cust_name').text(cust.customer_name || cust.name);
		  $('#cust_demat').text(cust.demat_account || '-');   // custom fields
		  $('#cust_bank').text(cust.bank_account || '-');
	
		  // pre-fill payment/customer sections
		  $('#payment-form [name="party"]').val(cust.name);
		  $('#payment-form [name="customer_bank"]').val(cust.bank_account || '');
		  $('#sales-order-form [name="customer"]').val(cust.name);
	
		  // purchase history + events
		  this.load_customer_history(cust.name);
		  this.load_customer_events(cust.name);
	
		  // show Customer context tab
		  $('#rm-main-tabs .nav-link').removeClass('active');
		  $('#rm-main-tabs .nav-link[data-target="customer-context"]').addClass('active');
		  $('#lead-context').hide();
		  $('#customer-context').show();
	
		  if (jump_to_customer_section) {
			this.goto_step('customer'); // wizard starts from Customer
		  }
		});
	  }
	
	  /* ---------- PURCHASE HISTORY ---------- */
	
	  load_customer_history(customer_name) {
		// get recent sales invoice items for this customer
		frappe.call({
		  method: 'frappe.client.get_list',
		  args: {
			doctype: 'Sales Invoice',
			filters: { customer: customer_name },
			fields: ['items', 'grand_total', 'posting_date'],
			order_by: 'posting_date desc',
			limit: 20
		  }
		}).then(r => {
		  const body = $('#cust_history_body').empty();
		  (r.message || []).forEach(row => {
			const url = `/app/sales-invoice/${row.parent}`;
			body.append(`
			  <tr>
				<td>${row.item_code}</td>
				<td>${frappe.datetime.str_to_user(row.posting_date)}</td>
				<td>${format_currency(row.rate)}</td>
				<td><a href="${url}" target="_blank">${row.parent}</a></td>
			  </tr>
			`);
		  });
		});
	  }
	
	  /* ---------- UPCOMING EVENTS ---------- */
	
	  load_customer_events(customer_name) {
		frappe.call({
		  method: 'frappe.client.get_list',
		  args: {
			doctype: 'Event',
			filters: {
			  reference_doctype: 'Customer',
			  reference_docname: customer_name,
			  starts_on: ['>=', frappe.datetime.get_today()]
			},
			fields: ['name', 'subject', 'starts_on'],
			order_by: 'starts_on asc',
			limit: 10
		  }
		}).then(r => {
		  const body = $('#cust_events_body').empty();
		  (r.message || []).forEach(ev => {
			body.append(`
			  <tr>
				<td>${frappe.datetime.str_to_user(ev.starts_on)}</td>
				<td>${ev.subject}</td>
			  </tr>
			`);
		  });
		});
	  }
	
	  /* ---------- WIZARD STEP HANDLING ---------- */
	
	  goto_step(step) {
		$('.section').removeClass('active');
		$(`#${step}-section`).addClass('active');
	
		// wizard indicator
		const map = {
		  'lead': 'lead',
		  'customer': 'customer',
		  'payment': 'payment',
		  'sales-order': 'sales-order'
		};
		const current = map[step];
	
		$('.rm-step').removeClass('rm-step-active rm-step-complete');
		let reached = false;
		$('.rm-step').each(function () {
		  const s = $(this).data('step');
		  if (!reached && s !== current) {
			$(this).addClass('rm-step-complete');
		  } else if (s === current) {
			$(this).addClass('rm-step-active');
			reached = true;
		  }
		});
	  }
	
	  /* ---------- SAVE CUSTOMER: also persist ---------- */
	
	  save_customer() {
		const $form = $('#customer-form');
		const doc = {
		  doctype: 'Customer',
		  customer_name: $form.find('[name="customer_name"]').val(),
		  mobile_no: $form.find('[name="phone"]').val(),
		  email_id: $form.find('[name="email_id"]').val(),
		  address_line1: $form.find('[name="address_line1"]').val(),
		  demat_account: $form.find('[name="demat_account"]').val(),
		  bank_account: $form.find('[name="bank_account"]').val(),
		  pan_card: $form.find('[name="pan_card"]').val(),
		  aadhar_card: $form.find('[name="aadhar_card"]').val(),
		  bank_ifsc: $form.find('[name="bank_ifsc"]').val(),
		  customer_group: 'Individual'
		};
		frappe.call({
			method: 'frappe.client.insert',
			args: { doc },
			freeze: true
		  }).then(r => {
			this.set_current_customer(r.message.name, true); // store in localStorage & jump to customer step
		  });
		
	  const me = this;
	  // Activities
	  $(document).on('click', '#new-meeting', () => this.create_activity('Meeting'));
	  $(document).on('click', '#update-meeting', () => this.create_activity('Meeting Status Update'));
	  $(document).on('click', '#upload-selfie', () => this.upload_proof());
	  $(document).on('click', '#onboard-customer', () => this.goto_step('customer'));
  
	// Customer
	$('#customer-back').click(() => this.goto_step('lead'));
	$('#save-customer').click(() => this.save_customer());

	// Payment
	$('#payment-back').click(() => this.goto_step('customer'));
	$('#save-payment').click(() => this.save_payment());

	// SO
	$('#so-back').click(() => this.goto_step('payment'));
	$('#save-so').click(() => this.save_sales_order());
	$('#add-item').click(() => this.add_item_row());
	}	
  }