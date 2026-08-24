# RM Performance

Turns the eight WRM minimum-performance standards into a measured, daily
scorecard, with a manager board, three reports and a dashboard.

## What is where

| Piece | Path | Purpose |
|---|---|---|
| Scoring engine | `kpi_engine.py` | Counts all eight pointers for one RM on one date |
| Row security | `scoping.py` | The single visibility rule shared by every surface |
| Page endpoints | `api.py` | Backs the two desk pages |
| Capture fields | `../patches/v1_0/create_rm_performance_fields.py` | Custom fields on Lead / Event / Event Booking / Job Applicant |
| Seed data | `demo_data.py` | `seed()` and `clear_demo_data()` |

## The eight pointers

Only KPI 1 is genuinely daily. The rest are weekly or monthly targets, so on any
given day the scorecard reports *pace to date* inside the period the policy
names. KPI 2 carries two sub-targets but scores as a single point.

| # | Read from | Period |
|---|---|---|
| 1 | `Lead Contact Log` rows, distinct Lead per RM per day | Daily |
| 2 | `Event` (`event_category=Meeting`, `custom_rm`, `custom_meeting_support`) | Week + month |
| 3 | `Event` with `custom_venue_type = Office` | Month |
| 4 | `Event Booking Attendee` under bookings with `custom_credited_rm` | Month |
| 5 | `Scope Meeting Attendee` marked Present on a `Team Meeting` | Month |
| 6 | `Job Applicant.custom_referred_by_rm` + Sales Persons opened beneath them | Month |
| 7, 8 | `RM Monthly Rating` filled by the reporting manager | Month |

KPI 7 and 8 are deliberately subjective and are never inferred. With no rating
for the month, both count as not met — so nobody reaches 8/8 until their manager
has actually rated them.

## Row security

`scoping.visible_employees()` is the only rule:

* HR Manager / HR User / System Manager — every RM, every branch.
* Anyone else with an Employee record — themselves plus their whole `reports_to`
  subtree.
* Branch Manager — additionally their entire branch.

It is enforced in the reports and page endpoints directly, and on the doctypes
through `permission_query_conditions` in `hooks.py`.

### Why the reports avoid Link columns

`employee`, `branch` and the activity references are **Data** columns carrying an
anchor, not Link columns, and the scorecard's Link fields set
`ignore_user_permissions`.

This is deliberate. Frappe runs report rows through User Permission matching, and
on this site HR and all five RM managers carry an `Employee = <themselves>` User
Permission. With Link columns the report collapsed to a single row for exactly
the people it is built for, and `RM Activity Trail` failed outright because a
Link to `DocType` made Frappe check read access on `tabDocType`.

Row security is applied once, in `scoping`. Adding Link columns back would layer
a second, stricter filter on top and silently empty the report.

## Rebuilding scorecards

The nightly job (`kpi_engine.build_yesterday`) snapshots the day that closed.
To rebuild by hand:

```bash
bench --site <site> execute supremusangel.rm_performance.kpi_engine.build_for_date --args "['2026-08-19']"
bench --site <site> execute supremusangel.rm_performance.kpi_engine.build_range --args "['2026-07-01','2026-07-31']"
```

The RM EOD Desk also has a **Rebuild This Day** button (HR only).

## Seed data

Every seeded record carries a marker (`demo_data.SEED_MARKERS`), so cleanup
removes exactly those records:

```bash
bench --site <site> execute supremusangel.rm_performance.demo_data.seed
bench --site <site> execute supremusangel.rm_performance.demo_data.clear_demo_data
```

## Settings

`RM KPI Settings` holds all eight targets, the flag thresholds, and
`Evaluation Mode`. Targets are never hard-coded — the policy will change.

`Evaluation Mode` starts at **Observation Only**, which shows a banner on the
desk saying flags are for coaching and are not an official record. Switch it to
**Consequential** once the logging habit is real and the numbers can be trusted.
