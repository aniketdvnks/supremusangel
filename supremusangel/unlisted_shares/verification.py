"""Transactional acceptance checks. Run after demo_data.seed; mutations roll back."""
import frappe
from frappe.utils import add_days, today, flt
from frappe.model.workflow import apply_workflow
from supremusangel.unlisted_shares.commission_engine import calculate, build_chain
from supremusangel.unlisted_shares.reports import run_report
from supremusangel.unlisted_shares.install import REPORTS
from supremusangel.supremus_angel.incentive_source import get_sales_rows


def dashboard_health():
    from frappe.desk.desktop import get_desktop_page
    frappe.set_user("sa.admin@example.test")
    result = get_desktop_page(frappe.as_json(dict(name="Supremus Angel", title="Supremus Angel", public=1)))
    return {"card_permission": frappe.has_permission("Number Card"), "chart_permission": frappe.has_permission("Dashboard Chart"),
            "number_cards": [r.number_card_name for r in result.get("number_cards", {}).get("items", [])],
            "charts": [r.chart_name for r in result.get("charts", {}).get("items", [])]}


def verify():
    original = frappe.session.user
    frappe.set_user("Administrator")
    results = {}
    f = dict(from_date=add_days(today(), -100), to_date=today())
    invoices = frappe.get_all("Sales Invoice", filters={"remarks": ["like", "SA-SHARES-DEMO-%"], "docstatus": 1}, pluck="name")
    assert len(invoices) == 18, f"Expected 18 submitted demo invoices, got {len(invoices)}"
    for name in invoices:
        doc = frappe.get_doc("Sales Invoice", name)
        assert [flt(r.commission_rate) for r in doc.sales_team] == [20, 5, 3, 2]
        assert len({r.sales_person for r in doc.sales_team}) == 4
        assert [flt(r.incentives) for r in doc.sales_team] == [flt(doc.base_net_total*p/100, 2) for p in [20,5,3,2]]
        calculate(doc)
        calculate(doc)
        assert len(doc.sales_team) == 4
        assert name not in [r.sales_invoice for r in get_sales_rows(doc.custom_primary_agent, f['from_date'], f['to_date'])]
    results["18 submitted invoices / cascade / idempotence / legacy exclusion"] = "PASS"
    f.update(sales_invoice=invoices[0], sales_person="SA Demo - Arjun Desai")
    kinds = ["agent_summary", "tier_business", "pending_approvals", "top_customers", "referral_chain", "my_sales", "my_downline", "my_withdrawals"]
    for name, kind in zip(REPORTS, kinds):
        assert frappe.db.exists("Report", name)
        columns, rows = run_report(kind, f)
        assert columns and rows, f"Empty report: {name}"
        results[name] = len(rows)
    from frappe.desk.query_report import run
    for name in REPORTS:
        result = run(name, filters=f, ignore_prepared_report=True)
        assert result.get("result"), f"Report endpoint failed: {name}"
    results["All 8 standard Report endpoints"] = "PASS"
    # Permission checks run with an Agent-only identity, not System Manager.
    frappe.set_user("sa.associate@example.test")
    assert "System Manager" not in frappe.get_roles()
    own = "SA Demo - Associate 1.1.1"
    visible = frappe.get_list("Sales Invoice", fields=["name", "custom_primary_agent"], limit_page_length=100)
    assert visible and all(r.custom_primary_agent == own for r in visible)
    own_filters = dict(from_date=f["from_date"], to_date=f["to_date"])
    assert run_report("my_sales", own_filters)[1]
    assert run_report("my_withdrawals", own_filters)[1]
    for kind, filters in [("agent_summary", own_filters), ("my_sales", f), ("my_downline", own_filters)]:
        try:
            run_report(kind, filters)
        except (frappe.PermissionError, frappe.ValidationError):
            pass
        else:
            raise AssertionError(f"Unauthorized report allowed: {kind}")
    foreign = next(n for n in invoices if frappe.db.get_value("Sales Invoice", n, "custom_primary_agent") != own)
    assert not frappe.has_permission("Sales Invoice", "read", doc=foreign)
    assert not frappe.has_permission("Sales Invoice", "submit")
    results["Agent list / direct-document / spoofed-filter / Admin-report denial"] = "PASS"
    frappe.set_user("sa.teamlead@example.test")
    assert run_report("my_downline", own_filters)[1]
    results["Agent-only Team Lead downline report"] = "PASS"
    frappe.set_user("Administrator")
    frappe.db.savepoint("sa_acceptance")
    try:
        # Invalid chain must fail with an actionable error.
        frappe.db.set_value("Sales Person", own, "custom_tier", None)
        try:
            build_chain(own)
        except frappe.ValidationError:
            pass
        else:
            raise AssertionError("Missing tier accepted")
        frappe.db.rollback(save_point="sa_acceptance")
        frappe.db.savepoint("sa_acceptance")
        doc = frappe.get_doc("Sales Invoice", invoices[0])
        doc.sales_team[0].incentives = 999999
        try:
            doc.save()
        except frappe.ValidationError:
            pass
        else:
            raise AssertionError("Submitted ledger modification accepted")
        results["Missing-tier rejection / submitted-ledger immutability"] = "PASS"
        frappe.db.rollback(save_point="sa_acceptance")
        frappe.db.savepoint("sa_acceptance")
        # Exercise real cancellation and amendment, then restore everything.
        cancelled = apply_workflow(frappe.get_doc("Sales Invoice", invoices[-1]), "Cancel")
        assert cancelled.docstatus == 2
        amended = frappe.copy_doc(cancelled)
        amended.docstatus = 0
        amended.workflow_state = "Draft"
        amended.amended_from = cancelled.name
        amended.remarks = "SA acceptance amendment (rolled back)"
        amended.insert()
        amended = apply_workflow(amended, "Request Approval")
        amended = apply_workflow(amended, "Approve")
        assert amended.docstatus == 1 and len(amended.sales_team) == 4
        results["Real cancellation / amendment / resubmission"] = "PASS"
        # Overdraft must fail at approval, including already reserved payouts.
        sample = frappe.get_doc("Withdrawal Request", frappe.db.get_value("Withdrawal Request", {"docstatus": 1}, "name"))
        excessive = frappe.copy_doc(sample)
        excessive.docstatus = 0
        excessive.workflow_state = "Draft"
        excessive.payment_entry = None
        excessive.amount = 999999999
        excessive.insert()
        excessive = apply_workflow(excessive, "Request Approval")
        try:
            apply_workflow(excessive, "Approve")
        except frappe.ValidationError:
            pass
        else:
            raise AssertionError("Overdraft approved")
        results["Withdrawal balance protection"] = "PASS"
        pending_request = frappe.db.get_value("Withdrawal Request", {"workflow_state": "Pending Approval", "notes": "SA-SHARES-DEMO-WDR-3"}, "name")
        approved_request = apply_workflow(frappe.get_doc("Withdrawal Request", pending_request), "Approve")
        draft_payment = approved_request.payment_entry
        assert frappe.db.get_value("Payment Entry", draft_payment, "docstatus") == 0
        apply_workflow(approved_request, "Cancel")
        assert not frappe.db.exists("Payment Entry", draft_payment)
        results["Unpaid withdrawal cancellation releases reservation and draft payment"] = "PASS"
    finally:
        frappe.db.rollback(save_point="sa_acceptance")
        frappe.set_user(original)
    print(frappe.as_json(results))
    return results
