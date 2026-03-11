import frappe
from frappe import _
from frappe.utils import cint, now_datetime, get_url
import json

# ============================================================
# SESSION HOOK - REDIRECT TO ONBOARDING
# ============================================================

def redirect_to_onboarding():
    """
    Hook: on_session_creation
    Redirects new employees to onboarding page if not completed.
    """
    user = frappe.session.user

    if user in ("Administrator", "Guest"):
        return

    employee = frappe.db.get_value(
        "Employee",
        {"user_id": user},
        ["name", "custom_onboarding_completed"],
        as_dict=True
    )

    if not employee:
        return

    if not cint(employee.custom_onboarding_completed):
        frappe.local.response["home_page"] = "/app/onboarding"


# ============================================================
# EMPLOYEE LOOKUP
# ============================================================

def get_current_employee():
    """Get employee linked to current user."""
    employee = frappe.db.get_value(
        "Employee",
        {"user_id": frappe.session.user},
        "name"
    )

    if not employee:
        frappe.throw(_("No Employee record linked to your user account."))

    return employee


@frappe.whitelist()
def get_employee_data():
    """
    Fetch current employee data for onboarding form pre-fill.
    """
    try:
        employee_name = get_current_employee()
        employee = frappe.get_doc("Employee", employee_name)

        return {
            "success": True,
            "data": {
                "name": employee.name,
                "employee_name": employee.employee_name,
                "first_name": employee.first_name or "",
                "middle_name": employee.middle_name or "",
                "last_name": employee.last_name or "",
                "date_of_birth": str(employee.date_of_birth) if employee.date_of_birth else "",
                "gender": employee.gender or "",
                "blood_group": employee.blood_group or "",
                "marital_status": employee.marital_status or "",
                "personal_email": employee.personal_email or "",
                "cell_number": employee.cell_number or "",
                "emergency_phone_number": employee.emergency_phone_number or "",
                "current_address": employee.current_address or "",
                "permanent_address": employee.permanent_address or "",
                "bank_name": employee.bank_name or "",
                "bank_ac_no": employee.bank_ac_no or "",
                "iban": employee.iban or "",
                "designation": employee.designation or "",
                "department": employee.department or "",
                "branch": employee.branch or "",
                "custom_onboarding_completed": cint(employee.custom_onboarding_completed)
            }
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Onboarding: Get Employee Data Error")
        return {
            "success": False,
            "message": str(e)
        }


# ============================================================
# STEP DATA RETRIEVAL
# ============================================================

@frappe.whitelist()
def get_step_config():
    """
    Return step configuration with field definitions.
    """
    steps = [
        {
            "id": "personal",
            "title": _("Personal Details"),
            "icon": "user",
            "fields": [
                {"fieldname": "first_name", "label": _("First Name"), "fieldtype": "Data", "reqd": 1},
                {"fieldname": "middle_name", "label": _("Middle Name"), "fieldtype": "Data", "reqd": 0},
                {"fieldname": "last_name", "label": _("Last Name"), "fieldtype": "Data", "reqd": 0},
                {"fieldname": "date_of_birth", "label": _("Date of Birth"), "fieldtype": "Date", "reqd": 1},
                {"fieldname": "gender", "label": _("Gender"), "fieldtype": "Select", "options": "\nMale\nFemale\nOther", "reqd": 1},
                {"fieldname": "blood_group", "label": _("Blood Group"), "fieldtype": "Select", "options": "\nA+\nA-\nB+\nB-\nAB+\nAB-\nO+\nO-", "reqd": 0},
                {"fieldname": "marital_status", "label": _("Marital Status"), "fieldtype": "Select", "options": "\nSingle\nMarried\nDivorced\nWidowed", "reqd": 0},
                {"fieldname": "personal_email", "label": _("Personal Email"), "fieldtype": "Data", "options": "Email", "reqd": 1},
                {"fieldname": "cell_number", "label": _("Mobile Number"), "fieldtype": "Data", "reqd": 1},
                {"fieldname": "emergency_phone_number", "label": _("Emergency Contact"), "fieldtype": "Data", "reqd": 1}
            ]
        },
        {
            "id": "address",
            "title": _("Address Details"),
            "icon": "map-pin",
            "fields": [
                {"fieldname": "current_address", "label": _("Current Address"), "fieldtype": "Small Text", "reqd": 1},
                {"fieldname": "current_city", "label": _("City"), "fieldtype": "Data", "reqd": 1},
                {"fieldname": "current_state", "label": _("State"), "fieldtype": "Data", "reqd": 1},
                {"fieldname": "current_pincode", "label": _("PIN Code"), "fieldtype": "Data", "reqd": 1},
                {"fieldname": "same_as_current", "label": _("Permanent address same as current"), "fieldtype": "Check", "reqd": 0},
                {"fieldname": "permanent_address", "label": _("Permanent Address"), "fieldtype": "Small Text", "reqd": 0, "depends_on": "eval:!doc.same_as_current"},
                {"fieldname": "permanent_city", "label": _("City"), "fieldtype": "Data", "reqd": 0, "depends_on": "eval:!doc.same_as_current"},
                {"fieldname": "permanent_state", "label": _("State"), "fieldtype": "Data", "reqd": 0, "depends_on": "eval:!doc.same_as_current"},
                {"fieldname": "permanent_pincode", "label": _("PIN Code"), "fieldtype": "Data", "reqd": 0, "depends_on": "eval:!doc.same_as_current"}
            ]
        },
        {
            "id": "bank",
            "title": _("Bank Details"),
            "icon": "credit-card",
            "fields": [
                {"fieldname": "bank_name", "label": _("Bank Name"), "fieldtype": "Data", "reqd": 1},
                {"fieldname": "bank_ac_no", "label": _("Account Number"), "fieldtype": "Data", "reqd": 1},
                {"fieldname": "ifsc_code", "label": _("IFSC Code"), "fieldtype": "Data", "reqd": 1},
                {"fieldname": "iban", "label": _("IBAN (if applicable)"), "fieldtype": "Data", "reqd": 0},
                {"fieldname": "pan_number", "label": _("PAN Number"), "fieldtype": "Data", "reqd": 1},
                {"fieldname": "uan_number", "label": _("UAN (PF Number)"), "fieldtype": "Data", "reqd": 0}
            ]
        },
        {
            "id": "documents",
            "title": _("Document Upload"),
            "icon": "file-text",
            "fields": [
                {"fieldname": "id_proof", "label": _("ID Proof (Aadhaar/Passport)"), "fieldtype": "Attach", "reqd": 1},
                {"fieldname": "address_proof", "label": _("Address Proof"), "fieldtype": "Attach", "reqd": 1},
                {"fieldname": "pan_card", "label": _("PAN Card"), "fieldtype": "Attach", "reqd": 1},
                {"fieldname": "passport_photo", "label": _("Passport Size Photo"), "fieldtype": "Attach Image", "reqd": 1},
                {"fieldname": "education_certificates", "label": _("Education Certificates"), "fieldtype": "Attach", "reqd": 0},
                {"fieldname": "experience_letter", "label": _("Experience/Relieving Letter"), "fieldtype": "Attach", "reqd": 0}
            ]
        },
        {
            "id": "confirm",
            "title": _("Review & Confirm"),
            "icon": "check-circle",
            "fields": []
        }
    ]

    return steps


# ============================================================
# SAVE STEP DATA
# ============================================================

@frappe.whitelist()
def save_step_data(step_id, data):
    """
    Save individual step data to Employee record.
    
    Args:
        step_id: Step identifier (personal, address, bank, documents)
        data: JSON string of field values
    """
    try:
        if isinstance(data, str):
            data = json.loads(data)

        employee_name = get_current_employee()
        employee = frappe.get_doc("Employee", employee_name)

        # Update the step_fields dictionary in save_step_data()
        step_fields = {
            "personal": [
                "first_name", "middle_name", "last_name", "date_of_birth",
                "gender", "blood_group", "marital_status", "personal_email",
                "cell_number", "emergency_phone_number"
            ],
            "address": [
                "current_address", "permanent_address",
                "current_city", "current_state", "current_pincode",
                "permanent_city", "permanent_state", "permanent_pincode"
            ],
            "bank": [
                "bank_name", "bank_ac_no", "iban",
                "ifsc_code",
                "pan_number",
                "uan_number" 
            ]
        }
        allowed_fields = step_fields.get(step_id, [])

        # Update allowed fields only
        for field in allowed_fields:
            if field in data and hasattr(employee, field):
                setattr(employee, field, data[field])

        # Handle address copy logic
        if step_id == "address" and data.get("same_as_current"):
            employee.permanent_address = employee.current_address

        employee.flags.ignore_mandatory = True
        employee.save(ignore_permissions=True)
        frappe.db.commit()

        return {
            "success": True,
            "message": _("Step data saved successfully")
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Onboarding: Save Step Error - {step_id}")
        return {
            "success": False,
            "message": str(e)
        }


# ============================================================
# DOCUMENT UPLOAD
# ============================================================

@frappe.whitelist()
def upload_document(document_type, file_url):
    """
    Link uploaded document to employee record.
    
    Args:
        document_type: Type of document (id_proof, pan_card, etc.)
        file_url: URL of uploaded file
    """
    try:
        employee_name = get_current_employee()

        # Store in custom fields or Employee Checklist child table
        # Option 1: If you have custom fields for each document type
        if document_type in ["passport_photo", "image"]:
            frappe.db.set_value("Employee", employee_name, "image", file_url)
        
        # Option 2: Store in a child table (Employee Document)
        # Create child table doctype if needed
        if frappe.db.exists("DocType", "Employee Document"):
            doc_exists = frappe.db.exists("Employee Document", {
                "parent": employee_name,
                "document_type": document_type
            })
            
            if doc_exists:
                frappe.db.set_value("Employee Document", doc_exists, "document", file_url)
            else:
                employee = frappe.get_doc("Employee", employee_name)
                employee.append("custom_documents", {
                    "document_type": document_type,
                    "document": file_url,
                    "uploaded_on": now_datetime()
                })
                employee.flags.ignore_mandatory = True
                employee.save(ignore_permissions=True)

        frappe.db.commit()

        return {
            "success": True,
            "message": _("Document uploaded successfully")
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Onboarding: Document Upload Error")
        return {
            "success": False,
            "message": str(e)
        }


# ============================================================
# COMPLETE ONBOARDING
# ============================================================

@frappe.whitelist()
def complete_onboarding():
    """
    Mark onboarding as completed and trigger password reset.
    """
    try:
        employee_name = get_current_employee()

        # Mark onboarding as completed
        frappe.db.set_value(
            "Employee",
            employee_name,
            "custom_onboarding_completed",
            1
        )

        # Update employee status if needed
        frappe.db.set_value(
            "Employee",
            employee_name,
            "status",
            "Active"
        )

        frappe.db.commit()

        # Get user for password reset
        user = frappe.session.user

        return {
            "success": True,
            "message": _("Onboarding completed successfully!"),
            "redirect": "/app",
            "require_password_reset": True
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Onboarding: Completion Error")
        return {
            "success": False,
            "message": str(e)
        }


# ============================================================
# VALIDATION HELPERS
# ============================================================

@frappe.whitelist()
def validate_field(field_name, value):
    """
    Server-side field validation.
    """
    errors = []

    if field_name == "personal_email":
        if value and not frappe.utils.validate_email_address(value):
            errors.append(_("Invalid email format"))

    elif field_name == "cell_number":
        if value and (len(value) < 10 or not value.replace("+", "").replace("-", "").replace(" ", "").isdigit()):
            errors.append(_("Invalid mobile number"))

    elif field_name == "pan_number":
        import re
        if value and not re.match(r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$', value.upper()):
            errors.append(_("Invalid PAN format (e.g., ABCDE1234F)"))

    elif field_name == "ifsc_code":
        import re
        if value and not re.match(r'^[A-Z]{4}0[A-Z0-9]{6}$', value.upper()):
            errors.append(_("Invalid IFSC format"))

    elif field_name == "current_pincode" or field_name == "permanent_pincode":
        if value and (len(value) != 6 or not value.isdigit()):
            errors.append(_("PIN code must be 6 digits"))

    return {
        "valid": len(errors) == 0,
        "errors": errors
    }


# ============================================================
# CHECK ONBOARDING STATUS
# ============================================================

@frappe.whitelist()
def check_onboarding_status():
    """
    Check if current user needs to complete onboarding.
    """
    user = frappe.session.user

    if user in ("Administrator", "Guest"):
        return {"required": False, "reason": "system_user"}

    employee = frappe.db.get_value(
        "Employee",
        {"user_id": user},
        ["name", "custom_onboarding_completed", "status"],
        as_dict=True
    )

    if not employee:
        return {"required": False, "reason": "no_employee_record"}

    if cint(employee.custom_onboarding_completed):
        return {"required": False, "reason": "already_completed"}

    return {
        "required": True,
        "employee": employee.name
    }