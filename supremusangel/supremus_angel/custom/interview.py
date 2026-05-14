import frappe
from frappe import _
from hrms.hr.doctype.interview.interview import Interview


class CustomInterview(Interview):
    def on_submit(self):
        if self.status not in ["Cleared", "Rejected", "Selected"]:
            frappe.throw(
                _("Only Interviews with Cleared, Rejected or Selected status can be submitted."),
                title=_("Not Allowed"),
            )
        self.show_job_applicant_update_dialog()
