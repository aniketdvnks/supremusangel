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

# Incentive role labels, derived purely from the Sales Person tree (no manual field):
#   leaf                         -> RM  (Relationship Manager)
#   group of only leaves         -> TL  (Team Lead)
#   group with a group under it  -> BM  (Branch Manager)
# The top container (a group with no parent) is structural, not a person's role.
_ROLE_LABELS = {
	"RM": "RM (Relationship Manager)",
	"TL": "TL (Team Lead)",
	"BM": "BM (Branch Manager)",
	"GROUP": "Group (structure)",
}


@frappe.whitelist()
def get_incentive_role(sales_person):
	"""Classify a Sales Person as RM / TL / BM from its position in the tree."""
	d = frappe.db.get_value(
		"Sales Person", sales_person, ["is_group", "parent_sales_person"], as_dict=True
	)
	if not d:
		return None
	if not d.is_group:
		role = "RM"
	elif not d.parent_sales_person:
		role = "GROUP"  # top container, not an actual person's role
	elif frappe.db.exists("Sales Person", {"parent_sales_person": sales_person, "is_group": 1}):
		role = "BM"  # has a manager (group) under them
	else:
		role = "TL"  # a group of individual salespeople
	return {"role": role, "label": _(_ROLE_LABELS[role])}


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
