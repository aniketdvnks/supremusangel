frappe.provide("frappe.RMDashboard");

frappe.pages['rm-dashboard'].on_page_load = function(wrapper) {
    new RMDashboardController(wrapper);
  };
  
  class RMDashboardController {
    constructor(wrapper) {
      this.wrapper = $(wrapper);
      this.page = frappe.ui.make_app_page({
        parent: wrapper,
        title: __('RM Dashboard'),
        single_column: false
      });
      
      frappe.require("rm_dashboard.bundle.js", function () {
		// wrapper.rm_dashboard = new erpnext.PointOfSale.Controller(wrapper);
		// window.cur_pos = wrapper.pos;
        this.state = frappe.RMDashboard.state;
        this.common = frappe.RMDashboard.RMCommon;
        
        // Initialize modules
        this.lead_module = new frappe.RMDashboard.lead(this);
        this.customer_module = new frappe.RMDashboard.customer(this);
	});
      // Initialize state
    //   this.customer_module = new frappe.RMDashboard.RMCustomerModule(this);
      
  
      // Render template
    //   $(frappe.render_template('rm_dashboard')).appendTo(this.page.body);
  
      // Initialize components
      this.init_sidebar();
      this.init_start_mode();
      this.bind_events();
    }
  
    /**
     * Initialize sidebar with item prices
     */
    init_sidebar() {
      this.sidebar = this.wrapper.find('.layout-side-section');
      this.sidebar.empty().append(`
        <div class="rm-sidebar">
          <h5>${__('Item Prices')}</h5>
          <div id="sidebar-item-prices"></div>
        </div>
      `);
      RMCommon.load_item_prices('#sidebar-item-prices');
    }
  
    /**
     * Determine and set initial mode (lead or customer)
     */
    init_start_mode() {
      const { lead, customer, mode } = this.state.get();
  
      // If both exist, respect last mode
      if (lead && customer && mode) {
        this.set_mode(mode);
        if (mode === 'lead') {
          this.lead_module.load_lead(lead.name);
          this.goto_view('lead');
        } else {
          this.customer_module.load_customer(customer);
          this.goto_view('customer');
        }
        return;
      }
  
      // If only lead exists
      if (lead && !customer) {
        this.set_mode('lead');
        this.lead_module.load_lead(lead.name);
        this.goto_view('lead');
        return;
      }
  
      // If only customer exists
      if (customer && !lead) {
        this.set_mode('customer');
        this.customer_module.load_customer(customer);
        this.goto_view('customer');
        return;
      }
  
      // Nothing exists - show mode dialog
      this.show_mode_dialog();
    }
  
    /**
     * Show mode selection dialog
     */
    show_mode_dialog() {
      const d = new frappe.ui.Dialog({
        title: __('Start with'),
        fields: [
          {
            fieldname: 'mode',
            fieldtype: 'Select',
            label: __('Mode'),
            options: ['Lead', 'Customer'],
            reqd: 1,
            default: 'Lead'
          }
        ],
        primary_action_label: __('Continue'),
        primary_action: (values) => {
          d.hide();
          const mode = values.mode.toLowerCase();
          this.set_mode(mode);
          
          if (mode === 'lead') {
            this.lead_module.show_lead_selector();
          } else {
            this.customer_module.show_customer_selector();
          }
        }
      });
      d.show();
    }
  
    /**
     * Set mode (lead or customer)
     */
    set_mode(mode) {
      this.state.set_mode(mode);
      $('.rm-mode-btn').removeClass('btn-primary').addClass('btn-outline-secondary');
      $(`.rm-mode-btn[data-mode="${mode}"]`)
        .removeClass('btn-outline-secondary')
        .addClass('btn-primary');
    }
  
    /**
     * Navigate to specific view
     */
    goto_view(view) {
      this.state.set_view(view);
  
      // Hide all views
      $('#view-lead, #view-customer, #view-payment, #view-sales-order').hide();
  
      // Show target view
      if (view === 'lead') {
        $('#view-lead').show();
        RMCommon.set_step('lead');
      } else if (view === 'customer' || view === 'customer-from-lead') {
        $('#view-customer').show();
        RMCommon.set_step('customer');
        
        const { customer } = this.state.get();
        if (customer) {
          this.customer_module.populate_customer_view(this.state.get().customer_doc);
        } else if (view === 'customer-from-lead') {
          this.customer_module.prepare_from_lead();
        }
      } else if (view === 'payment') {
        $('#view-payment').show();
        RMCommon.set_step('payment');
        
        const { customer } = this.state.get();
        if (customer) {
          $('#payment-form [name="party"]').val(customer);
        }
      } else if (view === 'sales-order') {
        $('#view-sales-order').show();
        RMCommon.set_step('sales-order');
        
        const { customer } = this.state.get();
        if (customer) {
          $('#sales-order-form [name="customer"]').val(customer);
        }
      }
  
      this.update_footer_buttons();
    }
  
    /**
     * Update footer navigation buttons based on current view
     */
    update_footer_buttons() {
      const $prev = $('#rm-btn-prev');
      const $next = $('#rm-btn-next');
      const { current_view, customer, lead } = this.state.get();
  
      // Default: hide both
      $prev.hide();
      $next.hide();
  
      // Lead page: show only Next
      if (current_view === 'lead') {
        $next.show().text(__('Next'));
        
        $next.off('click').on('click', () => {
          if (customer) {
            this.goto_view('customer');
          } else {
            if (!$('#btn-onboard-customer').prop('disabled')) {
              this.goto_view('customer-from-lead');
            }
          }
        });
        return;
      }
  
      // Customer page: show both
      if (current_view === 'customer' || current_view === 'customer-from-lead') {
        $prev.show().text(__('Previous'));
        $next.show().text(__('Next'));
  
        $prev.off('click').on('click', () => {
          if (lead) {
            this.goto_view('lead');
          }
        });
  
        $next.off('click').on('click', () => {
          this.goto_view('payment');
        });
        return;
      }
  
      // Payment page: show both
      if (current_view === 'payment') {
        $prev.show().text(__('Previous'));
        $next.show().text(__('Next'));
  
        $prev.off('click').on('click', () => {
          this.goto_view('customer');
        });
  
        $next.off('click').on('click', () => {
          this.goto_view('sales-order');
        });
        return;
      }
  
      // Sales Order page: show both
      if (current_view === 'sales-order') {
        $prev.show().text(__('Previous'));
        $next.show().text(__('Finish'));
  
        $prev.off('click').on('click', () => {
          this.goto_view('payment');
        });
  
        $next.off('click').on('click', () => {
          this.save_sales_order();
        });
      }
    }
  
    /**
     * Bind all event handlers
     */
    bind_events() {
      // Mode switcher
      $(document).on('click', '.rm-mode-btn', (e) => {
        const mode = $(e.currentTarget).data('mode');
        this.set_mode(mode);
        
        if (mode === 'lead') {
          this.lead_module.show_lead_selector();
        } else {
          this.customer_module.show_customer_selector();
        }
      });
  
      // Lead page buttons
      $(document).on('click', '#btn-select-lead', () => {
        this.lead_module.show_lead_selector();
      });
  
      $(document).on('click', '#btn-onboard-customer', () => {
        this.goto_view('customer-from-lead');
      });
  
      // Activity buttons (Meeting/Call/Email) - Lead context
      $(document).on('click', '.rm-btn-meeting', () => {
        const { lead, customer, customer_email } = this.state.get();
        
        let context = {};
        if (lead) {
          context = {
            ref_doctype: 'Lead',
            ref_name: lead.name,
            default_subject: `Meeting - ${lead.lead_name || lead.name}`,
            default_email: lead.email_id || '',
            on_success: () => this.lead_module.load_timeline()
          };
        } else if (customer) {
          context = {
            ref_doctype: 'Customer',
            ref_name: customer,
            default_subject: `Meeting - ${$('#cust_name_view').text() || customer}`,
            default_email: customer_email || '',
            on_success: () => this.customer_module.load_events()
          };
        }
        
        RMDialogs.open_meeting_dialog(context);
      });
  
      // Customer page buttons
      $(document).on('click', '#btn-select-customer', () => {
        this.customer_module.show_customer_selector();
      });
  
      $(document).on('click', '#btn-save-customer', () => {
        const form_data = this.serialize_form('#customer-kyc-form');
        this.customer_module.save_customer(form_data);
      });
  
      // Payment page buttons
      $(document).on('click', '#btn-save-payment', () => {
        this.save_payment();
      });
  
      // Sales Order page buttons
      $(document).on('click', '#btn-add-item', () => {
        this.add_sales_order_item();
      });
  
      $(document).on('click', '#btn-save-sales-order', () => {
        this.save_sales_order();
      });
    }
  
    /**
     * Serialize form data
     */
    serialize_form(form_selector) {
      const data = {};
      $(form_selector).find('input, select, textarea').each(function() {
        const name = $(this).attr('name');
        if (name) {
          data[name] = $(this).val();
        }
      });
      return data;
    }
  
    /**
     * Save payment entry
     */
    save_payment() {
      const data = this.serialize_form('#payment-form');
      // Add payment save logic here
      frappe.msgprint(__('Payment save not yet implemented'));
    }
  
    /**
     * Add item to sales order
     */
    add_sales_order_item() {
      // Add item row logic
      frappe.msgprint(__('Add item not yet implemented'));
    }
  
    /**
     * Save sales order
     */
    save_sales_order() {
      const data = this.serialize_form('#sales-order-form');
      // Add SO save logic here
      frappe.msgprint(__('Sales order save not yet implemented'));
    }
  }
  