import argparse
import json
import os
import urllib.request

from lockmyitem_qqbot.client import build_signed_envelope


def call(action: str, payload: dict) -> dict:
    url = os.environ["LOCKMYITEM_INGEST_URL"]
    secret = os.environ["QQ_ADMIN_SECRET"].encode("utf-8")
    body = json.dumps(build_signed_envelope(action, payload, secret), ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=30) as response:
        result = json.loads(response.read().decode("utf-8"))
    if isinstance(result.get("body"), str):
        result = json.loads(result["body"])
    if result.get("ok") is False:
        raise RuntimeError(result.get("message") or result.get("code"))
    return result.get("data", result)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Review LockMyItem QQ ingestion drafts")
    subparsers = parser.add_subparsers(dest="command", required=True)
    list_parser = subparsers.add_parser("list")
    list_parser.add_argument("--limit", type=int, default=20)
    approve_parser = subparsers.add_parser("approve")
    approve_parser.add_argument("draft_id")
    approve_parser.add_argument("--type", choices=("found", "lost"))
    approve_parser.add_argument("--title")
    approve_parser.add_argument("--description")
    approve_parser.add_argument("--category")
    approve_parser.add_argument("--location-id")
    approve_parser.add_argument("--location-raw")
    approve_parser.add_argument("--occurred-at")
    reject_parser = subparsers.add_parser("reject")
    reject_parser.add_argument("draft_id")
    args = parser.parse_args()
    if args.command == "list":
        print(json.dumps(call("listQQDrafts", {"limit": args.limit}), ensure_ascii=False, indent=2, default=str))
    else:
        payload = {"draftId": args.draft_id, "decision": args.command}
        if args.command == "approve":
            corrections = {
                "type": args.type,
                "title": args.title,
                "description": args.description,
                "category": args.category,
                "locationId": args.location_id,
                "locationRaw": args.location_raw,
                "occurredAtText": args.occurred_at,
            }
            payload["corrections"] = {key: value for key, value in corrections.items() if value is not None}
        print(json.dumps(call("reviewQQDraft", payload), ensure_ascii=False, indent=2))
