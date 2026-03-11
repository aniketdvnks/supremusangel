import frappe

@frappe.whitelist()
def get_item_prices():
    today =frappe.utils.nowdate()
    return frappe.db.sql(f"""select 
                            `tabItem`.image,
                            `tabItem`.item_code,
                            `tabItem`.item_name,
                            `tabItem Price`.price_list_rate
                        from `tabItem Price`
                        Left join `tabItem`
                        on `tabItem Price`.item_code = `tabItem`.item_code
                        where 
                        `tabItem Price`.valid_from >= {today}
         """,as_dict=1)


@frappe.whitelist()
def get_item_wise_purchase_history(customer):
    from frappe.query_builder import DocType
    SalesInvoice = DocType("Sales Invoice")
    SalesInvoiceItem = DocType("Sales Invoice Item")

    query = (
        frappe.qb.from_(SalesInvoiceItem)
        .left_join(SalesInvoice)
        .on(SalesInvoiceItem.parent == SalesInvoice.name)
        .select(
            SalesInvoiceItem.item_code,
            SalesInvoiceItem.qty,
            SalesInvoiceItem.rate,
            SalesInvoiceItem.description,
            SalesInvoice.posting_date,
            SalesInvoice.name,
        )
        .where(SalesInvoice.docstatus == 1)
        .where(SalesInvoice.customer == customer)
    )

    return query.run(as_dict=True)