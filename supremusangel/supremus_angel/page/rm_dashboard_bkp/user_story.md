Detailed user story
Actors
Telecaller

Relationship Manager (RM)

Share Transfer Team

Lead and customer lifecycle
Lead selection & context

RM opens RM Dashboard.

RM can choose to work with:

a Lead assigned to them, or

an existing Customer.

The system remembers the last selected Lead/Customer in local storage and auto-loads it on next visit (like POS remembers last profile).

Lead view (RM starting from lead)

RM selects one lead from their assigned leads.

The Lead panel shows:

Lead name, phone, WhatsApp, email, address.

Current owner (assigned_to).

Linked Customer, if any.

On the right, a timeline shows chronological activities and communications for this lead (Communications, Events, uploads, etc.).

Lead activities

From the lead view, RM can:

Log a new meeting (phone/visit) as Communication/Event.

Update meeting status (e.g. meeting done, rescheduled).

Upload proof (selfie at customer office / signboard) attached to the lead as a file + Communication entry.

Activities appear immediately in the timeline for fast feedback.

Onboarding to customer (from lead)

If the lead is not yet a customer:

RM sees an “Onboard as Customer” button.

Clicking this opens the Customer KYC panel.

If the lead is already onboarded (Lead has linked Customer via lead_name on Customer), then:

Onboard button is disabled / visually muted.

The linked Customer name is shown and offers a shortcut to open that customer in Customer mode.

Customer KYC panel (from lead or direct customer mode)

The Customer panel is a compact form:

Basic info (name, phone, WhatsApp, email, address) prefilled from Lead when onboarding.

KYC fields: demat account, PAN, Aadhaar, bank account, IFSC (custom fields on Customer).

On save:

If new customer: insert Customer and link back to Lead.

If existing: update KYC fields only.

The panel also displays Customer workflow state using workflow_state field as a colored badge (Pending Verification, Verified, Rejected, etc.).

Customer view (RM starting with customer)

RM can start the dashboard in Customer mode directly (e.g. from a customer list or as a convenience).

Customer view shows:

Basic header details (name, Demat, Bank, workflow state badge).

Current KYC form (editable, same fields as above).

A Purchase History area:

Scrollable table listing item-wise history from Sales Invoices:

Item code, Sales Invoice posting_date, item_rate, and link to the Sales Invoice.

Visible only if there is at least one Sales Invoice Item for this customer.

Payment & Sales Order

From either Lead → Customer or direct Customer mode, once a Customer exists:

RM can open Payment step:

Fixed mode: “Wire Transfer”.

Fields: Customer, paid amount, customer bank account (from KYC), transaction reference.

On submit: creates a Payment Entry in “Pending Verification” (via Workflow).

Next, Sales Order step:

RM selects items and quantities.

A minimal item list is shown with dynamic rows; pricing can be looked up from a sidebar.

On submit: Sales Order is created.

Share Transfer Team actions (out of scope of this UI)

Share Transfer Team:

Verifies Payment Entry vs Customer KYC Bank details (manual check).

On successful match and share transfer to Demat, creates Delivery Note and completes internal flow.

Email Notifications:

RM receives email once Payment Entry is verified and Delivery Note is created (via Notification and Workflow in backend).

Sidebar

On the right, a sidebar shows popular items with images and current selling rates (read-only).

This helps RM to quickly pick items when creating Sales Orders.