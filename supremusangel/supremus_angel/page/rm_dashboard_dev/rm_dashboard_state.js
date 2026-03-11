frappe.provide('frappe.RMDashboard');

frappe.RMDashboard.RMDashboardState=class {
    constructor() {
      this.STORAGE_KEYS = {
        lead: 'rm_current_lead',
        customer: 'rm_current_customer',
        mode: 'rm_current_mode'
      };
  
      this.state = {
        mode: null,              // 'lead' | 'customer'
        current_view: null,      // 'lead' | 'customer' | 'payment' | 'sales-order'
        lead: null,              // Lead doc object
        customer: null,          // Customer name string
        customer_doc: null,      // Customer doc object
        customer_email: null     // Cached customer email
      };
  
      this.listeners = [];
      this.load_from_storage();
    }
  
    /**
     * Load state from localStorage
     */
    load_from_storage() {
      const stored_lead = localStorage.getItem(this.STORAGE_KEYS.lead);
      const stored_customer = localStorage.getItem(this.STORAGE_KEYS.customer);
      const stored_mode = localStorage.getItem(this.STORAGE_KEYS.mode);
  
      if (stored_lead) {
        try {
          this.state.lead = JSON.parse(stored_lead);
        } catch (e) {
          console.warn('Failed to parse stored lead:', e);
        }
      }
  
      if (stored_customer) {
        this.state.customer = stored_customer;
      }
  
      if (stored_mode) {
        this.state.mode = stored_mode;
      }
    }
  
    /**
     * Set current mode (lead or customer)
     */
    set_mode(mode) {
      if (!['lead', 'customer'].includes(mode)) {
        throw new Error(`Invalid mode: ${mode}`);
      }
      this.state.mode = mode;
      localStorage.setItem(this.STORAGE_KEYS.mode, mode);
      this.notify({ type: 'mode_changed', mode });
    }
  
    /**
     * Set current lead
     */
    set_lead(lead_doc) {
      this.state.lead = lead_doc;
      if (lead_doc) {
        localStorage.setItem(this.STORAGE_KEYS.lead, JSON.stringify(lead_doc));
      } else {
        localStorage.removeItem(this.STORAGE_KEYS.lead);
      }
      this.notify({ type: 'lead_changed', lead: lead_doc });
    }
  
    /**
     * Set current customer
     */
    set_customer(customer_name, customer_doc = null, email = null) {
      this.state.customer = customer_name;
      this.state.customer_doc = customer_doc;
      this.state.customer_email = email;
      
      if (customer_name) {
        localStorage.setItem(this.STORAGE_KEYS.customer, customer_name);
      } else {
        localStorage.removeItem(this.STORAGE_KEYS.customer);
      }
      this.notify({ type: 'customer_changed', customer: customer_name, doc: customer_doc });
    }
  
    /**
     * Set current view
     */
    set_view(view) {
      this.state.current_view = view;
      this.notify({ type: 'view_changed', view });
    }
  
    /**
     * Get current state
     */
    get() {
      return { ...this.state };
    }
  
    /**
     * Subscribe to state changes
     */
    subscribe(listener) {
      this.listeners.push(listener);
      return () => {
        this.listeners = this.listeners.filter(l => l !== listener);
      };
    }
  
    /**
     * Notify all listeners
     */
    notify(event) {
      this.listeners.forEach(listener => listener(event));
    }
  
    /**
     * Clear all state
     */
    clear() {
      this.state = {
        mode: null,
        current_view: null,
        lead: null,
        customer: null,
        customer_doc: null,
        customer_email: null
      };
      Object.values(this.STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
      this.notify({ type: 'state_cleared' });
    }
  }
  
  // Export singleton instance
  window.RMDashboardState = new RMDashboardState();
  