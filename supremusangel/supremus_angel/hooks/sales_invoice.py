import frappe
from frappe.utils import flt


def on_submit(doc, method=None):
	"""Auto-create SA Sales Records for each sales person on invoice submission."""
	if not doc.sales_team:
		return

	net_total = flt(doc.net_total) or flt(doc.grand_total)

	for row in doc.sales_team:
		if not row.sales_person:
			continue

		allocated_pct = flt(row.allocated_percentage) or 100
		allocated_value = net_total * allocated_pct / 100

		record = frappe.get_doc(
			{
				"doctype": "SA Sales Record",
				"sales_person": row.sales_person,
				"posting_date": doc.posting_date,
				"status": "Confirmed",
				"units_sold": 1,
				"unit_value_inr": allocated_value,
				"total_sales_value": allocated_value,
				"reference_doctype": "Sales Invoice",
				"reference_name": doc.name,
				"notes": f"Auto-posted from {doc.name} ({allocated_pct}% allocation)",
			}
		)
		record.insert(ignore_permissions=True)


def on_cancel(doc, method=None):
	"""Mark linked SA Sales Records as Cancelled when invoice is cancelled."""
	records = frappe.get_all(
		"SA Sales Record",
		filters={
			"reference_doctype": "Sales Invoice",
			"reference_name": doc.name,
			"status": "Confirmed",
		},
		pluck="name",
	)

	for name in records:
		frappe.db.set_value("SA Sales Record", name, "status", "Cancelled")
