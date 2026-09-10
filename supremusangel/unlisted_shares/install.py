"""Idempotent metadata setup for fresh installs and existing-site migrations."""
import json
import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

MODULE = "Unlisted Shares"
REPORTS = ["Agent-wise Commission Summary", "Tier-wise Business Report", "Pending Approvals Report",
           "Top Customers by Value", "Referral Chain Drill-down", "My Sales and Commission",
           "My Downline Performance", "My Withdrawal History"]


def field(name, label, kind="Link", options=None, **kwargs):
    return dict(fieldname=name, label=label, fieldtype=kind, options=options, **kwargs)


def setup():
    for role in ("Agent", "Admin"):
        if not frappe.db.exists("Role", role):
            frappe.get_doc(dict(doctype="Role", role_name=role, desk_access=1)).insert(ignore_permissions=True)
    create_custom_fields({
        "Sales Person": [field("custom_tier", "Commission Tier", options="Commission Tier"),
                         field("custom_agent_user", "Agent User", options="User", unique=1)],
        "Customer": [field("custom_sales_person", "Default Sales Person", options="Sales Person")],
        "Item": [field("custom_logo", "Company Logo", "Attach Image")],
        "Sales Invoice": [field("custom_unlisted_shares", "Unlisted Shares", "Check", read_only=1, default="0"),
                          field("custom_primary_agent", "Primary Agent", options="Sales Person"),
                          field("custom_pending_since", "Pending Since", "Datetime", read_only=1)],
        "Sales Team": [field("custom_commission_tier", "Commission Tier at Sale", options="Commission Tier", read_only=1)],
        "Payment Entry": [field("custom_sales_person", "Commission Agent", options="Sales Person", read_only=1),
                          field("custom_withdrawal_request", "Withdrawal Request", options="Withdrawal Request", read_only=1)],
    }, update=False)
    # Carry site-specific accounting dimensions into payment requests without
    # inventing a parallel accounting model (e.g. this demo site's Branch).
    from erpnext.accounts.doctype.accounting_dimension.accounting_dimension import get_accounting_dimensions
    dimensions = get_accounting_dimensions(as_list=False)
    if dimensions:
        create_custom_fields({"Withdrawal Request": [field(d.fieldname, d.label, options=d.document_type, permlevel=1)
                                                      for d in dimensions]}, update=False)
    if not frappe.db.exists("Item Group", "Unlisted Shares"):
        root = frappe.db.get_value("Item Group", {"is_group": 1, "parent_item_group": ["in", ["", None]]}, "name") or "All Item Groups"
        frappe.get_doc(dict(doctype="Item Group", item_group_name="Unlisted Shares", parent_item_group=root)).insert(ignore_permissions=True)
    tiers = [("Associate", 1, []), ("Sr. Associate", 2, [("Associate", 5)]),
             ("Team Lead", 3, [("Sr. Associate", 5), ("Associate", 3)]),
             ("City Partner", 4, [("Team Lead", 5), ("Sr. Associate", 3), ("Associate", 2)])]
    for name, level, overrides in tiers:
        if not frappe.db.exists("Commission Tier", name):
            frappe.get_doc(dict(doctype="Commission Tier", tier_name=name, level=level,
                own_commission_percent=20, promotion_criteria="Administrator promotion after review of team performance.",
                overrides=[dict(from_tier=t, percent=p) for t, p in overrides])).insert(ignore_permissions=True)
    setup_permissions()
    setup_workflows()
    setup_dashboard()


def setup_permissions():
    from frappe.permissions import add_permission, update_permission_property
    for dt in ("Number Card", "Dashboard Chart", "Company", "Currency", "UOM", "Price List", "Item Group", "Customer Group", "Territory", "Account", "Cost Center"):
        for role in ("Agent", "Admin"):
            add_permission(dt, role, 0)
            update_permission_property(dt, role, 0, "read", 1)
    for dt in ("Supplier", "Branch"):
        if frappe.db.exists("DocType", dt):
            add_permission(dt, "Admin", 0)
            update_permission_property(dt, "Admin", 0, "read", 1)
    for dt in ["Sales Invoice", "Customer", "Sales Person", "Item", "Payment Entry", "Commission Tier", "Withdrawal Request"]:
        for role in ["Agent", "Admin"]:
            add_permission(dt, role, 0)
            rights = ["read", "report", "print"]
            if role == "Admin":
                rights += ["write", "create", "submit", "cancel", "amend", "export"]
            elif dt in ("Sales Invoice", "Withdrawal Request"):
                rights += ["write", "create"]
            for right in rights:
                update_permission_property(dt, role, 0, right, 1)


def make_workflow(name, doctype, states, transitions):
    other = frappe.db.get_value("Workflow", {"document_type": doctype, "is_active": 1, "name": ["!=", name]}, "name")
    if other:
        frappe.throw(f"Cannot install {name}: existing active workflow {other} needs integration.")
    for state, status, role in states:
        if not frappe.db.exists("Workflow State", state):
            frappe.get_doc(dict(doctype="Workflow State", workflow_state_name=state,
                                style="Success" if state in ("Approved", "Paid") else "Warning")).insert(ignore_permissions=True)
    for state, action, next_state, role, condition in transitions:
        if not frappe.db.exists("Workflow Action Master", action):
            frappe.get_doc(dict(doctype="Workflow Action Master", workflow_action_name=action)).insert(ignore_permissions=True)
    values = dict(doctype="Workflow", workflow_name=name, document_type=doctype,
        is_active=1, send_email_alert=0, workflow_state_field="workflow_state",
        states=[dict(state=s, doc_status=str(d), allow_edit=r) for s, d, r in states],
        transitions=[dict(state=s, action=a, next_state=n, allowed=r, condition=c, allow_self_approval=1)
                     for s, a, n, r, c in transitions])
    if frappe.db.exists("Workflow", name):
        doc = frappe.get_doc("Workflow", name)
        doc.update(values)
        doc.save(ignore_permissions=True)
    else:
        frappe.get_doc(values).insert(ignore_permissions=True)


def setup_workflows():
    make_workflow("SA Share Purchase Approval", "Sales Invoice",
        [("Draft", 0, "All"), ("Pending Approval", 0, "Admin"), ("Approved", 1, "Admin"),
         ("Rejected", 0, "Admin"), ("Cancelled", 2, "Admin")],
        [("Draft", "Request Approval", "Pending Approval", r, "doc.custom_unlisted_shares") for r in ("Agent", "Admin")]
        + [("Pending Approval", "Approve", "Approved", "Admin", "doc.custom_unlisted_shares"),
           ("Pending Approval", "Reject", "Rejected", "Admin", "doc.custom_unlisted_shares"),
           ("Rejected", "Revise", "Draft", "Admin", ""),
           ("Approved", "Cancel", "Cancelled", "Admin", "")]
        + [("Draft", "Submit", "Approved", r, "not doc.custom_unlisted_shares") for r in ("Accounts User", "Accounts Manager", "Admin")])
    make_workflow("SA Withdrawal Approval", "Withdrawal Request",
        [("Draft", 0, "Agent"), ("Pending Approval", 0, "Admin"), ("Approved", 1, "Admin"),
         ("Rejected", 0, "Admin"), ("Cancelled", 2, "Admin")],
        [("Draft", "Request Approval", "Pending Approval", r, "") for r in ("Agent", "Admin")]
        + [("Pending Approval", "Approve", "Approved", "Admin", ""),
           ("Pending Approval", "Reject", "Rejected", "Admin", ""),
           ("Rejected", "Revise", "Draft", "Admin", ""),
           ("Approved", "Cancel", "Cancelled", "Admin", "")])


def mark_pending(doc, method=None):
    old = doc.get_doc_before_save()
    if doc.get("custom_unlisted_shares") and doc.get("workflow_state") == "Pending Approval":
        if not old or old.get("workflow_state") != "Pending Approval":
            doc.custom_pending_since = frappe.utils.now_datetime()


def setup_dashboard():
    cards = [("SA Total Transactions", "Sales Invoice", [["Sales Invoice", "custom_unlisted_shares", "=", 1], ["Sales Invoice", "docstatus", "=", 1]]),
             ("SA Total Customers", "Customer", [["Customer", "custom_sales_person", "is", "set"]]),
             ("SA Active Deals", "Item", [["Item", "item_group", "=", "Unlisted Shares"], ["Item", "disabled", "=", 0]]),
             ("SA Pending Payment Requests", "Withdrawal Request", [["Withdrawal Request", "workflow_state", "=", "Pending Approval"]])]
    for name, dt, filters in cards:
        if not frappe.db.exists("Number Card", name):
            frappe.get_doc(dict(doctype="Number Card", name=name, label=name[3:], document_type=dt,
                                type="Document Type", function="Count", is_public=1,
                                filters_json=json.dumps(filters), module=MODULE)).insert(ignore_permissions=True, set_name=name)
    if not frappe.db.exists("Dashboard Chart", "SA Weekly Transaction Value"):
        frappe.get_doc(dict(doctype="Dashboard Chart", chart_name="SA Weekly Transaction Value", chart_type="Sum",
            document_type="Sales Invoice", based_on="posting_date", value_based_on="base_net_total", time_interval="Weekly",
            timespan="Last Quarter", type="Line", is_public=1, module=MODULE,
            filters_json=json.dumps([["Sales Invoice", "custom_unlisted_shares", "=", 1], ["Sales Invoice", "docstatus", "=", 1]]))).insert(ignore_permissions=True)
    # Extend the existing workspace; its salary incentive links remain available below.
    if not frappe.db.exists("Workspace", "Supremus Angel"):
        ws = frappe.get_doc(dict(doctype="Workspace", label="Supremus Angel", title="Supremus Angel", module="Supremus Angel", public=1, content="[]"))
    else:
        ws = frappe.get_doc("Workspace", "Supremus Angel")
    content = [r for r in json.loads(ws.content or "[]") if not r.get("id", "").startswith("shares_")]
    blocks = [dict(id="shares_header", type="header", data=dict(text="<b>Unlisted Shares</b>", col=12))]
    for name, dt, filters in cards:
        if not any(r.number_card_name == name for r in ws.number_cards): ws.append("number_cards", dict(number_card_name=name, label=name[3:]))
        blocks.append(dict(id="shares_card_" + frappe.scrub(name), type="number_card", data=dict(number_card_name=name[3:], col=3)))
    shortcuts = [("Agents", "Sales Person", "Tree", []), ("Deals", "Item", "List", [["Item", "item_group", "=", "Unlisted Shares"]]),
                 ("Customers", "Customer", "List", []), ("Transactions", "Sales Invoice", "List", [["Sales Invoice", "custom_unlisted_shares", "=", 1]]),
                 ("Commission Tiers", "Commission Tier", "List", []), ("Withdrawals", "Payment Entry", "List", [["Payment Entry", "custom_sales_person", "is", "set"]]),
                 ("Withdrawal Requests", "Withdrawal Request", "List", []),
                 ("Pending Approvals", "Sales Invoice", "List", [["Sales Invoice", "workflow_state", "=", "Pending Approval"]])]
    for label, dt, view, filters in shortcuts:
        if not any(r.label == label for r in ws.shortcuts): ws.append("shortcuts", dict(label=label, type="DocType", link_to=dt, doc_view=view, color="Blue", stats_filter=json.dumps(filters)))
        blocks.append(dict(id="shares_shortcut_" + frappe.scrub(label), type="shortcut", data=dict(shortcut_name=label, col=3)))
    if not any(r.chart_name == "SA Weekly Transaction Value" for r in ws.charts): ws.append("charts", dict(chart_name="SA Weekly Transaction Value", label="Weekly Transaction Value"))
    blocks.append(dict(id="shares_chart", type="chart", data=dict(chart_name="Weekly Transaction Value", col=12)))
    groups = {"Agent Network": [("Sales Person", "DocType"), ("Commission Tier", "DocType")],
              "Sales": [(n, "DocType") for n in ("Item", "Customer", "Sales Invoice", "Payment Entry", "Withdrawal Request")],
              "Share Commission Reports": [(n, "Report") for n in REPORTS]}
    retained, owned_group = [], False
    for row in ws.links:
        if row.type == "Card Break":
            owned_group = row.label in groups
        if not owned_group and row.link_to != "Commission Tier":
            retained.append(row)
    ws.set("links", retained)
    for group, entries in groups.items():
        if not any(r.label == group for r in ws.links):
            ws.append("links", dict(type="Card Break", label=group))
            for name, kind in entries: ws.append("links", dict(type="Link", label=name, link_type=kind, link_to=name, is_query_report=int(kind == "Report")))
        blocks.append(dict(id="shares_group_" + frappe.scrub(group), type="card", data=dict(card_name=group, col=4)))
    ws.content = json.dumps(blocks + content)
    current = None
    for index, row in enumerate(ws.links, 1):
        row.idx = index
        if row.type == "Card Break":
            current = row
            current.link_count = 0
        elif current:
            current.link_count += 1
    ws.save(ignore_permissions=True)
