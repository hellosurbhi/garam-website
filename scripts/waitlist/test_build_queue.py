#!/usr/bin/env python3
"""Fixture self-test for build_queue.py and the sender's manifest gate.

Run: ../.venv/bin/python test_build_queue.py    (from sender/)
Zero PII: every fixture address is synthetic. Exercises every drop reason,
the cross-campaign regression (a different campaign's sent-log must NOT
exclude anyone), atomic-publish invalidation, and — via subprocess — the
Node sender's refusal of unsigned/tampered/wrong-campaign/renamed lists
(Codex audit 2026-07-28, #20: Python-only tests cannot prove Node behavior).
"""
import csv
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
PY = sys.executable
FAILS = []


def check(label, cond, detail=""):
    if cond:
        print(f"  ok  {label}")
    else:
        FAILS.append(label)
        print(f"FAIL  {label}  {detail}")


def write_csv(path, rows, header=("first_name", "email", "city", "state", "unsubscribed")):
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def build_fixture_root():
    root = Path(tempfile.mkdtemp(prefix="gate-test-"))
    (root / "sender").mkdir()
    (root / "downloads-stuff").mkdir()
    (root / "garam-masala-audience").mkdir()

    with open(root / "sender" / "suppressed.csv", "w") as f:
        f.write("email,reason\nsuppressed.person@fixture.dev,unsubscribed fixture\n")
    with open(root / "downloads-stuff" / "Profile Exclusions 2026-01-01.csv", "w") as f:
        f.write("Email Address,First Name,Last Name,Exclusion Time,Exclusion Reason\n"
                "klaviyo.excluded@fixture.dev,K,E,2026-01-01,Unsubscribed\n")
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Master"
    ws.append(["Email", "Emailable"])
    ws.append(["master.blocked@fixture.dev", "no"])
    ws.append(["master.fine@fixture.dev", "yes"])
    wb.save(root / "garam-masala-audience" / "Garam_Masala_Master_Audience.xlsx")

    with open(root / "sender" / "sent-log-gmail-v1.json", "w") as f:
        json.dump({
            "camp-a:already.sent@fixture.dev": "2026-07-26T02:00:00Z",
            "camp-OLD:previous.campaign@fixture.dev": "2026-06-01T02:00:00Z",
        }, f)
    with open(root / "sender" / "location-updates.csv", "w") as f:
        f.write("email,new_region,new_city\n"
                "moved.away@fixture.dev,LA,Los Angeles\n"
                "moved.here@fixture.dev,NYC,New York\n")
    return root


def run_gate(root, src, dst, *extra, campaign="camp-a"):
    env = {**os.environ, "GATE_TEST_ROOT": str(root)}
    return subprocess.run(
        [PY, str(HERE / "build_queue.py"), str(src), str(dst), "--campaign", campaign, *extra],
        capture_output=True, text=True, env=env,
    )


def dropped_reasons(dst):
    out = {}
    with open(f"{dst}.dropped.csv") as f:
        for r in csv.DictReader(f):
            out.setdefault(r["email"].strip().lower(), []).append(r["dropped_because"])
    return out


def main():
    root = build_fixture_root()
    work = root / "work"
    work.mkdir()
    src = work / "candidates.csv"
    dst = work / "queue.csv"

    rows = [
        ("Valid", "valid.person@fixture.dev", "New York", "NY", "false"),
        ("NoLoc", "no.location@fixture.dev", "", "", "false"),
        ("BadSyntax", "steph. romero@fixture.dev", "New York", "NY", "false"),
        ("DoubleDot", "double..dot@fixture.dev", "", "", "false"),
        ("Junk", "test@test.com", "", "", "false"),
        ("Typo", "someone@gamail.com", "", "", "false"),
        ("TypoTld", "someone2@gmail.con", "", "", "false"),
        ("Role", "info@somewhere.dev", "", "", "false"),
        ("RoleSuffix", "guestlist.service@eventbrite.com", "", "", "false"),
        ("AppleRelay", "k9f2qx7w@privaterelay.appleid.com", "New York", "NY", "false"),
        ("Suppressed", "suppressed.person@fixture.dev", "", "", "false"),
        ("Klaviyo", "klaviyo.excluded@fixture.dev", "", "", "false"),
        ("MasterNo", "master.blocked@fixture.dev", "", "", "false"),
        ("AlreadySent", "already.sent@fixture.dev", "", "", "false"),
        ("PrevCampaign", "previous.campaign@fixture.dev", "New York", "NY", "false"),
        ("Unsub", "unsubscribed.flag@fixture.dev", "", "", "true"),
        # duplicate pair: first row clean, second row unsubscribed -> person dropped
        ("DupClean", "dup.person@fixture.dev", "New York", "NY", "false"),
        ("DupUnsub", "dup.person@fixture.dev", "", "", "true"),
        ("FarState", "far.state@fixture.dev", "San Jose", "CA", "false"),
        ("FarStateFull", "far.fullname@fixture.dev", "", "California", "false"),
        ("FarCityOnly", "far.cityonly@fixture.dev", "Santa Clara", "", "false"),
        ("MovedAway", "moved.away@fixture.dev", "New York", "NY", "false"),
        ("MovedHere", "moved.here@fixture.dev", "San Francisco", "CA", "false"),
        ("UpperCase", "MiXeD.CaSe@Fixture.DEV", "", "", "false"),
    ]
    write_csv(src, rows)

    print("== gate run ==")
    p = run_gate(root, src, dst)
    check("gate exits 0", p.returncode == 0, p.stderr + p.stdout)
    kept = {r["email"] for r in csv.DictReader(open(dst))}
    expected_kept = {
        "valid.person@fixture.dev",
        "no.location@fixture.dev",          # unknown location: kept (composition is upstream's call)
        "k9f2qx7w@privaterelay.appleid.com",  # Apple relay = real person (audit #11)
        "previous.campaign@fixture.dev",    # camp-OLD send must NOT exclude from camp-a
        "moved.here@fixture.dev",           # mover INTO region wins over stale far city
        "mixed.case@fixture.dev",           # canonicalized to lowercase
    }
    check("kept set exact", kept == expected_kept, f"got {sorted(kept)}")

    dr = dropped_reasons(dst)
    for email, frag in [
        ("steph. romero@fixture.dev", "invalid syntax"),
        ("double..dot@fixture.dev", "invalid syntax"),
        ("test@test.com", "junk"),
        ("someone@gamail.com", "typo"),
        ("someone2@gmail.con", "typo"),
        ("info@somewhere.dev", "role"),
        ("guestlist.service@eventbrite.com", "role"),
        ("suppressed.person@fixture.dev", "suppressed.csv"),
        ("klaviyo.excluded@fixture.dev", "klaviyo"),
        ("master.blocked@fixture.dev", "master"),
        ("already.sent@fixture.dev", "already sent"),
        ("unsubscribed.flag@fixture.dev", "unsubscribed"),
        ("dup.person@fixture.dev", "unsubscribed"),
        ("far.state@fixture.dev", "far from"),
        ("far.fullname@fixture.dev", "far from"),
        ("far.cityonly@fixture.dev", "far from"),
        ("moved.away@fixture.dev", "moved away"),
    ]:
        reasons = " | ".join(dr.get(email, ["<not in dropped audit>"]))
        check(f"dropped: {email}", frag.lower() in reasons.lower(), reasons)

    manifest = json.load(open(f"{dst}.manifest.json"))
    import hashlib
    check("manifest sha matches", manifest["sha256"] == hashlib.sha256(dst.read_bytes()).hexdigest())
    check("manifest campaign", manifest["campaign"] == "camp-a")
    check("manifest output name", manifest["output"] == "queue.csv")

    print("== exclude-all-campaigns ==")
    # Own directory: the automatic same-campaign overlap protection would
    # (correctly) refuse a second overlapping queue next to queue.csv.
    work2 = root / "work2"
    work2.mkdir()
    dst2 = work2 / "queue2.csv"
    p = run_gate(root, src, dst2, "--exclude-all-campaigns")
    check("all-campaigns gate exits 0", p.returncode == 0, p.stderr + p.stdout)
    kept2 = {r["email"] for r in csv.DictReader(open(dst2))}
    check("all-campaigns drops prev-campaign person", "previous.campaign@fixture.dev" not in kept2)

    print("== cross-queue overlap ==")
    # queue2 shares recipients with queue -> building a THIRD overlapping queue must fail...
    dst3 = work / "queue3.csv"
    p = run_gate(root, src, dst3)
    check("overlapping same-campaign build refused", p.returncode != 0 and "overlap" in (p.stdout + p.stderr).lower(),
          p.stdout + p.stderr)
    check("refused build leaves no manifest", not Path(f"{dst3}.manifest.json").exists())
    # ...and passing the earlier queue via --exclude-list must succeed with zero overlap.
    p = run_gate(root, src, dst3, "--exclude-list", str(dst))
    if p.returncode == 0:
        kept3 = {r["email"] for r in csv.DictReader(open(dst3))}
        check("exclude-list disjoint", not (kept3 & kept), f"overlap: {kept3 & kept}")
    else:
        # every candidate is already in queue.csv -> zero survivors is the correct hard stop
        check("exclude-list zero-survivor hard stop", "zero rows" in (p.stdout + p.stderr).lower(),
              p.stdout + p.stderr)

    print("== failed build invalidates stale manifest ==")
    bad_src = work / "empty.csv"
    write_csv(bad_src, [("X", "test@test.com", "", "", "false")])  # everything drops -> zero kept
    p = run_gate(root, src, dst)  # rebuild valid manifest for dst first
    check("rebuild ok", p.returncode == 0, p.stderr)
    p = run_gate(root, bad_src, dst)
    check("zero-kept build errors", p.returncode != 0)
    check("stale manifest gone after failed build", not Path(f"{dst}.manifest.json").exists())

    print("== region=any keeps far people ==")
    work3 = root / "work3"
    work3.mkdir()
    p = run_gate(root, src, work3 / "queue-any.csv", "--region", "any")
    check("region=any gate exits 0", p.returncode == 0, p.stderr + p.stdout)
    kept_any = {r["email"] for r in csv.DictReader(open(work3 / "queue-any.csv"))}
    check("far state kept under any", "far.state@fixture.dev" in kept_any)

    print("== node sender refusals (cross-process) ==")
    # Gated with the sender's REAL hardcoded campaign so the positive case can
    # pass; the wrong-campaign case below proves the mismatch refusal. Own dir
    # so the camp-a manifests elsewhere don't interact.
    work4 = root / "work4"
    work4.mkdir()
    dst = work4 / "queue.csv"
    p = run_gate(root, src, dst, campaign="nyc-2026-07-26")
    check("fresh gate ok", p.returncode == 0, p.stderr)
    node_env = {
        **os.environ,
        "GATE_TEST_ROOT": str(root),
        "GMAIL_CLIENT_ID": "x", "GMAIL_CLIENT_SECRET": "x",
        "GMAIL_REFRESH_TOKEN": "x", "GMAIL_USER": "fixture@example.com",
    }

    def run_sender(*sargs):
        # dry mode (no --send / --test): parses + prints, never calls any API.
        return subprocess.run(
            ["node", str(HERE / "send-waitlist-gmail-v1.mjs"), *sargs],
            capture_output=True, text=True, env=node_env, cwd=HERE,
        )

    unsigned = work / "unsigned.csv"
    shutil.copy(dst, unsigned)
    p = run_sender("--list", str(unsigned))
    check("sender refuses unsigned", p.returncode != 0 and "UNGATED" in p.stderr, p.stderr)

    tampered = work / "tampered.csv"
    shutil.copy(dst, tampered)
    shutil.copy(f"{dst}.manifest.json", f"{tampered}.manifest.json")
    with open(tampered, "a") as f:
        f.write("Evil,injected@fixture.dev,,,false\n")
    p = run_sender("--list", str(tampered))
    # tampered copy fails two ways (renamed + modified); either refusal is correct
    check("sender refuses tampered/renamed", p.returncode != 0 and ("STALE" in p.stderr or "RENAMED" in p.stderr), p.stderr)

    wrongcamp = work / "wrongcamp.csv"
    shutil.copy(dst, wrongcamp)
    m = json.load(open(f"{dst}.manifest.json"))
    m["output"] = "wrongcamp.csv"
    m["campaign"] = "some-other-campaign"
    json.dump(m, open(f"{wrongcamp}.manifest.json", "w"))
    p = run_sender("--list", str(wrongcamp))
    check("sender refuses wrong campaign", p.returncode != 0 and "CAMPAIGN MISMATCH" in p.stderr, p.stderr)

    renamed = work / "renamed.csv"
    shutil.copy(dst, renamed)
    shutil.copy(f"{dst}.manifest.json", f"{renamed}.manifest.json")
    p = run_sender("--list", str(renamed))
    check("sender refuses renamed", p.returncode != 0 and "RENAMED" in p.stderr, p.stderr)

    p = run_sender("--list", str(dst))
    check("sender accepts valid gated queue (dry)", p.returncode == 0 and "on list" in p.stdout, p.stderr + p.stdout)

    p = run_sender("--list", str(dst), "--test", "x@y.dev", "--send")
    check("sender refuses --test with --send", p.returncode != 0 and "mutually exclusive" in p.stderr, p.stderr)

    p = run_sender("--test", "test@test.com")
    check("sender test-send refuses junk address", p.returncode != 0 and "REFUSED" in p.stderr, p.stderr)

    shutil.rmtree(root)
    print()
    if FAILS:
        print(f"{len(FAILS)} FAILURES: {FAILS}")
        sys.exit(1)
    print("ALL GATE TESTS GREEN")


if __name__ == "__main__":
    main()
