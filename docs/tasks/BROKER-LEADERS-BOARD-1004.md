# Broker cities, tour leaders and airport Board

Owner approval: bounded PC-A execution of Master Data producer and Reservations consumer; PC-B retains permanent Master Data ownership.

New broker form: Persian name, English name, encrypted broker phone, airport pickup Board text, country, multiple cities, and multiple named tour leaders with encrypted phones. Broker save and leader mutations are one transaction. Existing phone input omission preserves encryption; ordinary reads remain masked. Leader versions protect concurrent edits. Removing a leader deactivates it.

The existing Reservations-authorized audited leader contact endpoint additionally returns the broker Board. Selecting a leader fills voucher transferBoard, leaderName and leaderPhone. Changes of broker clear previous selection; stale async contact responses must not overwrite newer choices.

Additive nullable broker contact columns and restrictive FK city-link table, legacy city backfill. Apply migration before API rollout; no operational migration or local rollout is part of this request. Generic broker API inputs omit new values for backwards compatibility.
