import frappe
import json
from frappe import _


@frappe.whitelist()
def get_job_applicants(search_term=""):
    cond = ""
    vals = {}
    if search_term:
        cond = "AND (applicant_name LIKE %(s)s OR email_id LIKE %(s)s OR name LIKE %(s)s)"
        vals["s"] = f"%{search_term}%"

    return frappe.db.sql(
        f"""
        SELECT name, applicant_name, email_id, job_title, designation, status, phone_number
        FROM `tabJob Applicant`
        WHERE status NOT IN ('Rejected','Accepted')
        {cond}
        ORDER BY creation DESC
        LIMIT 50
        """,
        vals,
        as_dict=True,
    )


@frappe.whitelist()
def get_applicant_details(job_applicant):
    doc = frappe.db.get_value(
        "Job Applicant",
        job_applicant,
        ["name", "applicant_name", "email_id", "phone_number",
         "job_title", "designation", "status", "resume_link", "applicant_rating"],
        as_dict=True,
    )
    if not doc:
        frappe.throw(_("Job Applicant not found"))
    return doc


@frappe.whitelist()
def get_applicant_interviews(job_applicant):
    interviews = frappe.get_all(
        "Interview",
        filters={"job_applicant": job_applicant, "docstatus": ["!=", 2]},
        fields=["name", "interview_round", "status", "scheduled_on",
                "from_time", "to_time", "average_rating", "interview_summary",
                "job_opening", "docstatus"],
        order_by="scheduled_on asc, creation asc",
    )
    for iv in interviews:
        iv["interviewers"] = [
            r.interviewer for r in frappe.get_all(
                "Interview Detail", filters={"parent": iv.name}, fields=["interviewer"]
            )
        ]
        iv["feedback_list"] = frappe.get_all(
            "Interview Feedback",
            filters={"interview": iv.name, "docstatus": 1},
            fields=["interviewer", "result", "feedback", "average_rating"],
        )
        if iv.interview_round:
            rd = frappe.db.get_value(
                "Interview Round", iv.interview_round,
                ["round_name", "interview_type", "expected_average_rating"], as_dict=True,
            )
            iv["round_name"] = rd.round_name if rd else iv.interview_round
            iv["interview_type"] = rd.interview_type if rd else ""
            iv["expected_average_rating"] = rd.expected_average_rating if rd else 0
    return interviews


@frappe.whitelist()
def schedule_interview(job_applicant, interview_round, scheduled_on, from_time, to_time, interviewers="[]"):
    users = json.loads(interviewers) if isinstance(interviewers, str) else interviewers
    doc = frappe.get_doc({
        "doctype": "Interview",
        "job_applicant": job_applicant,
        "interview_round": interview_round,
        "scheduled_on": scheduled_on,
        "from_time": from_time,
        "to_time": to_time,
        "interview_details": [{"interviewer": u} for u in users if u],
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return doc.name


@frappe.whitelist()
def update_interview_schedule(interview_name, scheduled_on, from_time, to_time, interviewers="[]"):
    doc = frappe.get_doc("Interview", interview_name)
    if doc.docstatus != 0:
        frappe.throw(_("Cannot edit a submitted interview. Please amend it from HRMS."))
    doc.scheduled_on = scheduled_on
    doc.from_time = from_time
    doc.to_time = to_time
    users = json.loads(interviewers) if isinstance(interviewers, str) else interviewers
    doc.set("interview_details", [{"interviewer": u} for u in users if u])
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return doc.name


@frappe.whitelist()
def mark_applicant_accepted(job_applicant):
    interviews = frappe.get_all(
        "Interview",
        filters={"job_applicant": job_applicant, "docstatus": 1},
        fields=["name", "status"],
        order_by="scheduled_on desc, creation desc",
    )
    if not interviews:
        frappe.throw(_("No submitted interviews found for this applicant."))
    not_cleared = [i for i in interviews if i.status != "Cleared"]
    if not_cleared:
        frappe.throw(_(f"{len(not_cleared)} round(s) not yet Cleared."))
    # Mark the last interview as Selected (direct DB write bypasses submit restriction)
    last_interview = interviews[0]
    frappe.db.set_value("Interview", last_interview.name, "status", "Selected")
    frappe.db.set_value("Job Applicant", job_applicant, "status", "Accepted")
    frappe.db.commit()
    return {"success": True}


@frappe.whitelist()
def submit_interview(interview_name, status):
    doc = frappe.get_doc("Interview", interview_name)
    if doc.docstatus != 0:
        frappe.throw(_("Interview is already submitted."))
    doc.status = status
    doc.submit()
    if status == "Selected" and doc.job_applicant:
        frappe.db.set_value("Job Applicant", doc.job_applicant, "status", "Accepted")
    frappe.db.commit()
    return doc.name
