from supremusangel.unlisted_shares.reports import run_report


def execute(filters=None):
    return run_report("agent_summary", filters)

