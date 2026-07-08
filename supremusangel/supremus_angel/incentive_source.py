# Copyright (c) 2026, Aniket Shinde and contributors
# For license information, please see license.txt

"""Single source of truth for incentive sales figures.

Sales are read straight from the core ERPNext **Sales Invoice** and its
**Sales Team** allocation table — no custom sales doctype is involved. A
person's credited sales for an invoice = invoice net total x their
allocated_percentage. Only submitted (docstatus = 1) invoices in the window
count; cancelled invoices (docstatus = 2) and credit-note returns net out
naturally because their net_total is negative.
"""

import frappe
from frappe.utils import flt


def get_sales_rows(sales_person, from_date, to_date):
	"""Per-invoice credited sales for a Sales Person within [from_date, to_date]."""
	if not (sales_person and from_date and to_date):
		return []

	rows = frappe.db.sql(
		"""
		SELECT si.name AS sales_invoice,
		       si.posting_date,
		       si.customer,
		       si.net_total,
		       si.grand_total,
		       st.allocated_percentage
		FROM `tabSales Team` st
		INNER JOIN `tabSales Invoice` si ON si.name = st.parent
		WHERE st.parenttype = 'Sales Invoice'
		  AND st.sales_person = %(sp)s
		  AND si.docstatus = 1
		  AND si.posting_date BETWEEN %(fd)s AND %(td)s
		ORDER BY si.posting_date ASC
		""",
		{"sp": sales_person, "fd": from_date, "td": to_date},
		as_dict=True,
	)

	for r in rows:
		pct = flt(r.allocated_percentage) or 100
		base = flt(r.net_total) or flt(r.grand_total)
		r.allocated_percentage = pct
		r.credited_amount = base * pct / 100
	return rows


def get_total_sales(sales_person, from_date, to_date):
	"""Sum of credited sales for a Sales Person within the window."""
	return sum(flt(r.credited_amount) for r in get_sales_rows(sales_person, from_date, to_date))


def get_settings():
	"""The single source of all incentive rules (slabs + commission rates)."""
	return frappe.get_cached_doc("SA Incentive Settings")
