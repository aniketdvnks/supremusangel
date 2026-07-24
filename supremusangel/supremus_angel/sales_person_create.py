# Copyright (c) 2026, Aniket Shinde and contributors
# For license information, please see license.txt

"""Create a Sales Person straight from a Customer.

Backs the "Create Sales Person" button on the Customer form (see
``public/js/customer.js``). The new node is named after the customer and placed
under a chosen parent, so it lands in the right spot of the Sales Person tree —
which is what the incentive engine uses to classify RM / TL / BM.

Safeguards:
  * one Sales Person per Customer (idempotent — re-clicking opens the existing one),
  * unique name (Sales Person autonames from ``sales_person_name``),
  * the chosen parent is promoted to a group when needed, since only a group node
    can hold children (this is the RM -> TL/BM promotion moment).
"""

import frappe
from frappe import _

def scheme_from_tree(sales_person):
	"""Classify a Sales Person as SA / TL / BM purely from its position in the
	Sales Person tree. This is the SINGLE SOURCE OF TRUTH for the incentive
	scheme -- the month-end scheduler, the realtime recalc, this file's desk
	role badge, and the ESS commission dashboard all resolve the scheme through
	here so the calc that is generated always matches what is displayed.

	  * leaf node (``is_group`` = 0)          -> "SA"  (an individual seller)
	  * group with another group beneath it   -> "BM"  (managers under them),
	    regardless of whether the node sits at the root of the tree
	  * group whose children are all sellers  -> "TL"

	The "has a group beneath me" test is what separates a Branch Manager from a
	Team Lead, so a BM at the very top of the tree (no parent) is still a BM.

	Returns None when the Sales Person can't be found.
	"""
	d = frappe.db.get_value("Sales Person", sales_person, ["is_group"], as_dict=True)
	if not d:
		return None
	if not d.is_group:
		return "SA"
	if frappe.db.exists("Sales Person", {"parent_sales_person": sales_person, "is_group": 1}):
		return "BM"  # has a manager (group) under them
	return "TL"  # a group of individual salespeople


# Desk badge labels for the scheme. "RM (Relationship Manager)" is just the
# customer-facing name for the SA scheme shown on the Sales Person form.
_ROLE_LABELS = {
	"SA": "RM (Relationship Manager)",
	"TL": "TL (Team Lead)",
	"BM": "BM (Branch Manager)",
}


@frappe.whitelist()
def get_incentive_role(sales_person):
	"""Desk-facing wrapper around :func:`scheme_from_tree` -- returns the scheme
	plus its display label for the Sales Person form badge."""
	scheme = scheme_from_tree(sales_person)
	if not scheme:
		return None
	return {"role": scheme, "label": _(_ROLE_LABELS[scheme])}


@frappe.whitelist()
def create_from_customer(customer, parent_sales_person=None, is_group=0, sales_person_name=None):
	if not frappe.has_permission("Sales Person", "create"):
		frappe.throw(_("You are not permitted to create a Sales Person."), frappe.PermissionError)
	if not customer or not frappe.db.exists("Customer", customer):
		frappe.throw(_("Customer {0} not found.").format(customer))

	is_group = 1 if str(is_group) in ("1", "True", "true") else 0

	# One Sales Person per Customer — re-clicking just returns the existing one.
	existing = frappe.db.get_value("Sales Person", {"custom_customer": customer}, "name")
	if existing:
		return {"sales_person": existing, "created": False}

	base_name = (sales_person_name
	             or frappe.db.get_value("Customer", customer, "customer_name")
	             or customer).strip()

	# Sales Person autonames from sales_person_name, so the name must be unique.
	final_name = base_name
	if frappe.db.exists("Sales Person", final_name):
		final_name = f"{base_name} ({customer})"
		i = 2
		while frappe.db.exists("Sales Person", final_name):
			final_name = f"{base_name} ({customer}-{i})"
			i += 1

	# Only a group node can hold children — promote the chosen parent if it is a leaf.
	promoted_parent = False
	if parent_sales_person:
		if not frappe.db.exists("Sales Person", parent_sales_person):
			frappe.throw(_("Parent Sales Person {0} not found.").format(parent_sales_person))
		if not frappe.db.get_value("Sales Person", parent_sales_person, "is_group"):
			parent = frappe.get_doc("Sales Person", parent_sales_person)
			parent.is_group = 1
			parent.save(ignore_permissions=True)
			promoted_parent = True

	doc = frappe.get_doc({
		"doctype": "Sales Person",
		"sales_person_name": final_name,
		"parent_sales_person": parent_sales_person or None,
		"is_group": is_group,
		"enabled": 1,
		"custom_customer": customer,
	})
	doc.insert(ignore_permissions=True)

	return {
		"sales_person": doc.name,
		"created": True,
		"promoted_parent": promoted_parent,
		"parent": parent_sales_person,
	}
