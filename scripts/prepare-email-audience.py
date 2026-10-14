"""Prepare a private audience import without reading credentials or sending email."""
import argparse
import csv
import json
import re
from datetime import datetime
from pathlib import Path
import openpyxl


def prepare(source):
    suppressed = set()
    with (source / "sender/suppressed.csv").open(newline="") as handle:
        for row in csv.DictReader(handle):
            suppressed.add(row["email"].strip().lower())
    workbook = openpyxl.load_workbook(source / "garam-masala-audience/Garam_Masala_Master_Audience.xlsx", read_only=True, data_only=True)
    rows = iter(workbook["Master"].values)
    headers = next(rows)
    contacts = {}
    for values in rows:
        row = dict(zip(headers, values))
        email = str(row.get("Email") or "").strip().lower()
        if not email or "@" not in email:
            continue
        blocked = str(row.get("Emailable") or "").strip().lower() != "yes"
        if blocked:
            suppressed.add(email)
        contacts[email] = {"email": email, "city": str(row.get("City") or "").strip(), "suppressed": blocked}
    workbook.close()
    # The archive is append-only. Read it to carry historical announcement exclusions forward.
    history = {}
    last_gmail_send_at = 0
    with (source / "sent-archive.jsonl").open() as handle:
        for line in handle:
            record = json.loads(line)
            if record.get("via") == "gmail":
                timestamp = datetime.fromisoformat(record["sentAt"].replace("Z", "+00:00")).timestamp() * 1000
                last_gmail_send_at = max(last_gmail_send_at, timestamp)
            if record.get("kind") != "campaign":
                continue
            campaign = record.get("campaign", "")
            match = re.match(r"^(.*?-\d{4}-\d{2}-\d{2})(?:-.*)?$", campaign)
            if not match:
                continue
            show_id = re.sub(r"^(?:gmd-)?nyc-", "manhattan-", match.group(1))
            email = str(record.get("to") or "").strip().lower()
            if email:
                history[(show_id, email)] = {"showId": show_id, "email": email}
    return {"contacts": list(contacts.values()), "suppressed": sorted(suppressed), "history": list(history.values()), "lastGmailSendAt": last_gmail_send_at}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    if args.output.resolve().is_relative_to(Path(__file__).resolve().parents[1]):
        parser.error("Audience data must be written outside the website repository")
    data = prepare(args.source)
    with args.output.open("x") as handle:
        json.dump(data, handle)
    args.output.chmod(0o600)
    print(f"Prepared {len(data['contacts'])} contacts, {len(data['suppressed'])} suppressions and {len(data['history'])} historical sends.")
