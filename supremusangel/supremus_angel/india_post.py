import frappe
import requests

@frappe.whitelist()
def get_territory_from_pincode(pincode):
    if not pincode:
        frappe.throw("Pincode is required")

    url = f"https://api.postalpincode.in/pincode/{pincode}"
    response = requests.get(url, timeout=5)

    print(response.json)
    if response.status_code != 200:
        frappe.throw("Postal API not reachable")

    data = response.json()

    if data[0]["Status"] != "Success":
        frappe.throw("Invalid Pincode")

    post_office = data[0]["PostOffice"][0]

    country = post_office.get("Country")
    state = post_office.get("State")
    district = post_office.get("District")
    area = post_office.get("Name")

    # Ensure Country exists
    if not frappe.db.exists("Country", country):
        frappe.throw(f"Country {country} does not exist")

    # Create / Get State Territory
    state_territory = create_territory(state, country, is_group=1)

    # Create / Get District Territory
    district_territory = create_territory(district, state_territory, is_group=1)

    # Create / Get Area Territory
    area_territory = create_territory(area, district_territory, is_group=0)

    return {
        "territory": area_territory,
        "state": state,
        "district": district,
        "area": area
    }


def create_territory(name, parent, is_group):
    if frappe.db.exists("Territory", name):
        return name

    doc = frappe.get_doc({
        "doctype": "Territory",
        "territory_name": name,
        "parent_territory": parent,
        "is_group": is_group
    })
    doc.insert(ignore_permissions=True)
    return name
