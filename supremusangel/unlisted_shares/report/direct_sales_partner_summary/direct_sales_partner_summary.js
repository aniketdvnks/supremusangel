frappe.query_reports["Direct Sales Partner Summary"] = {
  filters: [
    {"fieldname":"from_date","label":"From Date","fieldtype":"Date","default":frappe.datetime.add_months(frappe.datetime.get_today(), -3),"reqd":1},
    {"fieldname":"to_date","label":"To Date","fieldtype":"Date","default":frappe.datetime.get_today(),"reqd":1},
    {"fieldname":"sales_person","label":"Sales Partner","fieldtype":"Link","options":"Sales Person"},
    {"fieldname":"deal","label":"Deal","fieldtype":"Link","options":"Item"}
  ]
};
