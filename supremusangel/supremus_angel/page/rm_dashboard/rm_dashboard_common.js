
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
        method: 'frappe.client.get_list',
        args: {
          doctype: 'Item',
          filters: { has_variants: 0 },
          fields: ['name', 'item_name', 'image', 'standard_selling_rate'],
          limit: 10
        }
      }).then(r => {
        const list = $(target_selector).empty();
        (r.message || []).forEach(item => {
          list.append(`
            <div class="rm-item-card">
              <img src="${item.image || '/assets/frappe/images/ui.png'}"
                   class="rm-item-image" alt="${frappe.utils.escape_html(item.item_name || item.name)}">
              <div>${frappe.utils.escape_html(item.item_name || item.name)}</div>
              <div class="rm-item-price">${format_currency(item.standard_selling_rate || 0)}</div>
            </div>
          `);
        });
      });
    },
  
    load_customer_purchase_history(customer, tbody_selector) {
      frappe.call({
        method: 'frappe.client.get_list',
        args: {
          doctype: 'Sales Invoice Item',
          filters: { customer: customer },
          fields: ['parent', 'item_code', 'rate', 'posting_date'],
          order_by: 'posting_date desc',
          limit: 30
        }
      }).then(r => {
        const rows = r.message || [];
        const tbody = $(tbody_selector).empty();
        if (!rows.length) {
          tbody.append('<tr><td colspan="4" class="text-muted">No purchases yet.</td></tr>');
          return;
        }
        rows.forEach(row => {
          const url = `/app/sales-invoice/${row.parent}`;
          tbody.append(`
            <tr>
              <td>${frappe.utils.escape_html(row.item_code || '')}</td>
              <td>${frappe.datetime.str_to_user(row.posting_date)}</td>
              <td>${format_currency(row.rate || 0)}</td>
              <td><a href="${url}" target="_blank">${row.parent}</a></td>
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
            ref_type: 'Customer',
            ref_name: customer,
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
    },
    // Generic creator: Meeting / Call / Email
  rm_create_activity(activity_type, reference_doctype, reference_name, opts = {}) {
    const subject = opts.subject || null;
    const description = opts.description || null;
    const starts_on = opts.starts_on || null;   // 'YYYY-MM-DD HH:mm:ss'
    const email = opts.email || null;

    return frappe.call({
      method: 'supremusangel.supremus_angel.api.create_rm_event.create_rm_even',
      args: {
        activity_type,
        reference_doctype,
        reference_name,
        subject,
        description,
        starts_on,
        email
      },
      freeze: true,
      freeze_message: __('Creating {0}...', [activity_type])
    }).then(r => {
      frappe.show_alert({
        message: __('{0} created: {1}', [activity_type, r.message.name]),
        indicator: 'green'
      });
      return r.message;
    });
  }

  };
  