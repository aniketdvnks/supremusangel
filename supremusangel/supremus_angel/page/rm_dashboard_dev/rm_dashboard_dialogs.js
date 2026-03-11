/**
 * RM Dashboard Dialog Factories
 * Centralized dialog creation for Meeting, Call, Email
 * 
 * @module RMDialogs
 */

window.RMDialogs = {
    /**
     * Open meeting dialog
     */
    open_meeting_dialog(context = {}) {
      const { ref_doctype, ref_name, default_subject, default_email } = context;
  
      if (!ref_doctype || !ref_name) {
        frappe.msgprint(__('Please select a Lead or Customer first.'));
        return;
      }
  
      const today = frappe.datetime.get_today();
      const now_time = frappe.datetime.now_time();
  
      const d = RMCommon.make_dialog({
        title: __('Schedule Meeting'),
        primary_action_label: __('Create Meeting'),
        size: 'extra-large',
        fields: [
          {
            fieldname: 'subject',
            fieldtype: 'Data',
            label: __('Subject'),
            reqd: 1,
            default: default_subject || `Meeting - ${ref_name}`
          },
          {
            fieldname: 'meeting_date',
            fieldtype: 'Date',
            label: __('Date'),
            reqd: 1,
            default: today
          },
          {
            fieldname: 'meeting_time',
            fieldtype: 'Time',
            label: __('Time'),
            default: now_time
          },
          {
            fieldname: 'all_day',
            fieldtype: 'Check',
            label: __('All Day')
          },
          {
            fieldname: 'add_video_conferencing',
            fieldtype: 'Check',
            label: __('Add Video Conferencing')
          },
          {
            fieldname: 'participants_section',
            fieldtype: 'Section Break',
            label: __('Participants')
          },
          {
            fieldname: 'participants',
            fieldtype: 'Table',
            label: __('Participants'),
            reqd: 1,
            fields: [
              {
                fieldname: 'reference_doctype',
                fieldtype: 'Select',
                label: __('Type'),
                options: ['Lead', 'Customer', 'Employee'],
                in_list_view: 1,
                reqd: 1,
                default: 'Lead'
              },
              {
                fieldname: 'reference_docname',
                fieldtype: 'Link',
                label: __('Document'),
                options: 'Lead',
                in_list_view: 1,
                reqd: 1
              },
              {
                fieldname: 'email',
                fieldtype: 'Data',
                label: __('Email'),
                in_list_view: 1
              }
            ]
          },
          {
            fieldname: 'description',
            fieldtype: 'Small Text',
            label: __('Description'),
            default: 'Sales RM meeting'
          }
        ],
        on_primary: (values, dialog) => {
          RMDialogs._handle_meeting_submit(values, dialog, context);
        }
      });
  
      // Wire dynamic link behavior for participants table
      const grid = d.fields_dict.participants.grid;
  
      grid.wrapper.on('change', 'select[data-fieldname="reference_doctype"]', function() {
        const $row = $(this).closest('.grid-row');
        const row_name = $row.attr('data-name');
        const row = grid.get_row(row_name);
        const doctype = $(this).val() || 'Lead';
        
        row.doc.reference_doctype = doctype;
        const link_field = row.fields_dict.reference_docname;
        if (link_field) {
          link_field.df.options = doctype;
          link_field.refresh();
        }
      });
  
      // Pre-fill first participant from context
      if (ref_doctype && ref_name) {
        setTimeout(() => {
          const row = grid.add_new_row();
          row.reference_doctype = ref_doctype;
          row.reference_docname = ref_name;
          row.email = default_email || '';
          grid.refresh();
        }, 100);
      }
  
      d.show();
    },
  
    /**
     * Handle meeting submission
     */
    _handle_meeting_submit(values, dialog, context) {
      if (!values.participants || !values.participants.length) {
        frappe.msgprint(__('Please add at least one participant.'));
        return;
      }
  
      let starts_on;
      if (values.all_day) {
        starts_on = `${values.meeting_date} 00:00:00`;
      } else {
        const t = values.meeting_time || '09:00:00';
        starts_on = `${values.meeting_date} ${t}`;
      }
  
      const desc_html = `<div class="ql-editor read-mode"><p>${frappe.utils.escape_html(values.description || values.subject)}</p></div>`;
  
      const participants = values.participants.map(row => ({
        reference_doctype: row.reference_doctype,
        reference_docname: row.reference_docname,
        email: row.email || ''
      }));
  
      RMCommon.create_activity('Meeting', participants[0].reference_doctype, participants[0].reference_docname, {
        subject: values.subject,
        starts_on,
        description: desc_html,
        email: participants[0].email || context.default_email || '',
        add_video_conferencing: values.add_video_conferencing ? 1 : 0,
        participants
      }).then(() => {
        dialog.hide();
        // Trigger callback if provided
        if (context.on_success) {
          context.on_success();
        }
      });
    }
  };
  