import json

import frappe
from frappe import bold


CONTACT_MSG = "<br><br>If this seems like a mistake, please email us for support."

def get_context(context):
    validate_query_params()
    job_opening = frappe.get_doc("Job Opening", frappe.form_dict["job_opening"])
    if not job_opening.get("aptitude_test_template"):
        return

    aptitude_test = frappe.get_doc("Aptitude Test Template", job_opening.aptitude_test_template)

    # if Aptitude test is already submitted for given Applicant, show success message (handled in js)
    if frappe.db.get_value(
        "Aptitude Test",
        filters={"job_applicant": frappe.form_dict["job_applicant"]},
    ):
        context["has_submitted"] = 1

    keys_to_include = {
        "name",
        "question",
        "required",
        "question_type",
        "options",
        "placeholder_text",
    }

    # TODO: strip options
    context.update(
        {
            "docname": aptitude_test.name,
            "title": aptitude_test.title,
            "description": aptitude_test.description,
            "total_points": aptitude_test.total_points,
            "questions": [
                {key: question.get(key) for key in keys_to_include}
                for question in aptitude_test.questions
            ],
        }
    )
    # for JavaScript
    context.questions_json = json.dumps(context.questions)

