frappe.provide('frappe.RMDashboard');


frappe.RMDashboard.RMCommon = {
    /**
     * Set active step in wizard
     */
    set_step(step) {
      const order = ['lead', 'customer', 'payment', 'sales-order'];
      $('.rm-step').removeClass('rm-step-active rm-step-complete');
      
      let reached = false;
      $('.rm-step').each(function() {
        const s = $(this).data('step');
        if (!reached && s !== step) {
          $(this).addClass('rm-step-complete');
        } else if (s === step) {
          $(this).addClass('rm-step-active');
          reached = true;
        }
      });
    },
  
    /**
     * Load item prices into sidebar
     */
    load_item_prices(target_selector) {
      return frappe.call({
        method: 'supremusangel.supremus_angel.api.rm_dashboard.get_item_prices'
      }).then(r => {
        const list = $(target_selector).empty();
        const items = r.message || [];
        
        if (!items.length) {
          list.append('<div class="text-muted text-center">No items found</div>');
          return;
        }
  
        items.forEach(item => {
          list.append(`
            <div class="rm-item-card">
              <img src="${item.image || '/assets/frappe/images/ui.png'}"
                   class="rm-item-image" 
                   alt="${frappe.utils.escape_html(item.item_name || item.name)}"
                   onerror="this.src='/assets/frappe/images/ui.png'">
              <div class="rm-item-name">${frappe.utils.escape_html(item.item_name || item.name)}</div>
              <div class="rm-item-price">${format_currency(item.price_list_rate || 0)}</div>
            </div>
          `);
        });
      }).catch(err => {
        console.error('Failed to load item prices:', err);
        $(target_selector).html('<div class="text-danger">Failed to load items</div>');
      });
    },
  
    /**
     * Load customer purchase history
     */
    load_customer_purchase_history(customer, tbody_selector) {
      return frappe.call({
        method: 'supremusangel.supremus_angel.api.rm_dashboard.get_item_wise_purchase_history',
        args: { customer }
      }).then(r => {
        const rows = r.message || [];
        const tbody = $(tbody_selector).empty();
        
        if (!rows.length) {
          tbody.append('<tr><td colspan="4" class="text-muted">No purchases yet.</td></tr>');
          return;
        }
  
        rows.forEach(row => {
          const inv_name = row.parent || row.sales_invoice || row.name;
          const url = `/app/sales-invoice/${inv_name}`;
          tbody.append(`
            <tr>
              <td>${frappe.utils.escape_html(row.item_code || '')}</td>
              <td>${frappe.datetime.str_to_user(row.posting_date)}</td>
              <td>${format_currency(row.rate || 0)}</td>
              <td><a href="${url}" target="_blank">${frappe.utils.escape_html(inv_name)}</a></td>
            </tr>
          `);
        });
      }).catch(err => {
        console.error('Failed to load purchase history:', err);
        $(tbody_selector).html('<tr><td colspan="4" class="text-danger">Failed to load history</td></tr>');
      });
    },
  
    /**
     * Load customer events (upcoming)
     */
    load_customer_events(customer, container_selector) {
      return frappe.call({
        method: 'frappe.client.get_list',
        args: {
          doctype: 'Event',
          filters: {
            'event_participants.reference_doctype': 'Customer',
            'event_participants.reference_docname': customer,
            'starts_on': ['>=', frappe.datetime.get_today()]
          },
          fields: ['name', 'subject', 'starts_on', 'event_category', 'event_type', 'status', 'creation'],
          order_by: 'starts_on asc',
          limit: 10
        }
      }).then(r => {
        const $c = $(container_selector).empty();
        const rows = r.message || [];
  
        if (!rows.length) {
          $c.append('<div class="text-muted" style="font-size:0.8rem;">No upcoming events.</div>');
          return;
        }
  
        rows.forEach(ev => {
          $c.append(RMCommon.render_event_card(ev));
        });
      }).catch(err => {
        console.error('Failed to load events:', err);
        $(container_selector).html('<div class="text-danger">Failed to load events</div>');
      });
    },
  
    /**
     * Render event card HTML
     */
    render_event_card(ev) {
      const date_str = ev.starts_on
        ? frappe.datetime.str_to_user(ev.starts_on)
        : frappe.datetime.str_to_user(ev.creation || ev.modified);
  
      const badge = ev.event_category || ev.event_type || 'Event';
      const status = ev.status || '';
      const url = `/app/event/${ev.name}`;
  
      return `
        <div class="rm-timeline-card">
          <div class="rm-timeline-card-header">
            <div class="rm-timeline-title">
              ${frappe.utils.escape_html(ev.subject || ev.name)}
            </div>
            <a href="${url}" target="_blank" class="rm-timeline-edit">
              ${__('Edit')}
            </a>
          </div>
          <div class="rm-timeline-meta">
            <span class="rm-timeline-date">${date_str}</span>
            <span class="rm-timeline-badge">${frappe.utils.escape_html(badge)}</span>
            ${status ? `<span class="rm-timeline-status">${frappe.utils.escape_html(status)}</span>` : ''}
          </div>
        </div>
      `;
    },
  
    /**
     * Create themed dialog
     */
    make_dialog(opts) {
      const d = new frappe.ui.Dialog({
        title: opts.title || __('Action'),
        fields: opts.fields || [],
        primary_action_label: opts.primary_action_label || __('Submit'),
        size: opts.size || 'large',
        primary_action(values) {
          if (opts.on_primary) {
            opts.on_primary(values, d);
          }
        }
      });
  
      $(d.$wrapper).addClass('rm-dialog-wrapper');
      return d;
    },
  
    /**
     * Create activity (Meeting/Call/Email)
     */
    create_activity(activity_type, reference_doctype, reference_name, opts = {}) {
      return frappe.call({
        method: 'supremusangel.supremus_angel.api.create_rm_event.create_rm_event',
        args: {
          activity_type,
          reference_doctype,
          reference_name,
          subject: opts.subject || null,
          description: opts.description || null,
          starts_on: opts.starts_on || null,
          email: opts.email || null,
          add_video_conferencing: opts.add_video_conferencing || 0,
          participants: opts.participants || null
        },
        freeze: true,
        freeze_message: __('Creating {0}...', [activity_type])
      }).then(r => {
        frappe.show_alert({
          message: __('{0} created: {1}', [activity_type, r.message.name]),
          indicator: 'green'
        });
        return r.message;
      }).catch(err => {
        frappe.throw(__('Failed to create {0}: {1}', [activity_type, err.message || err]));
      });
    },
  
    /**
     * Get workflow badge class
     */
    workflow_badge_class(state) {
      if (!state) return '';
      const s = state.toLowerCase();
      if (s.includes('verified') || s.includes('approved')) return 'rm-state-badge rm-state-success';
      if (s.includes('pending') || s.includes('review')) return 'rm-state-badge rm-state-warning';
      if (s.includes('rejected') || s.includes('cancel')) return 'rm-state-badge rm-state-danger';
      return 'rm-state-badge';
    }
  };
  