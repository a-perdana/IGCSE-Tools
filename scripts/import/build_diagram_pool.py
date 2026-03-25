#!/usr/bin/env python3
"""
build_diagram_pool.py
Reads importedQuestions where hasImage==True, deduplicates by imageName,
and writes/merges entries into the diagramPool collection.

Designed to be idempotent — safe to re-run after importing new subjects.

Usage:
    python build_diagram_pool.py --key igcse-tools-sa.json
    python build_diagram_pool.py --key igcse-tools-sa.json --subject Biology
    python build_diagram_pool.py --key igcse-tools-sa.json --dry-run

Requirements:
    pip install firebase-admin
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import json
import argparse
import time
from pathlib import Path
from datetime import datetime, timezone

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("❌  firebase-admin not installed. Run:")
    print("    pip install firebase-admin")
    sys.exit(1)


FIREBASE_PROJECT = "igcse-tools"
COLLECTION_SOURCE = "importedQuestions"
COLLECTION_TARGET = "diagramPool"
BATCH_SIZE = 400


def build_pool(db, subject: str | None, dry_run: bool) -> int:
    """
    Query importedQuestions with hasImage==True, deduplicate by imageName,
    write merged entries to diagramPool.
    Returns count of pool entries written.
    """
    col = db.collection(COLLECTION_SOURCE)
    query = col.where("hasImage", "==", True)
    if subject:
        query = query.where("subject", "==", subject)

    print(f"🔍  Querying {COLLECTION_SOURCE} (hasImage=True{f', subject={subject}' if subject else ''})…")
    docs = list(query.stream())
    print(f"    Found {len(docs)} questions with images")

    if not docs:
        print("   No image questions found. Nothing to do.")
        return 0

    # ── Group by imageName ─────────────────────────────────────────────────────
    groups: dict[str, list[dict]] = {}
    for d in docs:
        data = d.to_dict()
        image_name = data.get("imageName")
        if not image_name:
            continue
        if image_name not in groups:
            groups[image_name] = []
        groups[image_name].append(data)

    print(f"    Deduplicated to {len(groups)} unique images")

    # ── Build pool entries ─────────────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    pool_col = db.collection(COLLECTION_TARGET)
    batch = db.batch()
    count = 0

    for image_name, questions in groups.items():
        # Aggregate metadata from all questions sharing this image
        topics = sorted({q.get("topic", "") for q in questions if q.get("topic")})
        subtopics = sorted({q.get("subtopic", "") for q in questions if q.get("subtopic")})
        subjects = sorted({q.get("subject", "") for q in questions if q.get("subject")})
        uids = sorted({q.get("uid", "") for q in questions if q.get("uid")})

        # Use first question that has a valid imageURL / storagePath
        sample = next((q for q in questions if q.get("imageURL")), questions[0])
        image_url = sample.get("imageURL") or ""
        storage_path = sample.get("imageStoragePath") or f"diagrams/{subjects[0].lower() if subjects else 'unknown'}/{image_name}"
        subject_val = subjects[0] if len(subjects) == 1 else (subjects[0] if subjects else "")

        # Document ID = image name without extension (idempotent)
        doc_id = Path(image_name).stem

        entry = {
            "imageName": image_name,
            "storagePath": storage_path,
            "imageURL": image_url,
            "subject": subject_val,
            "topics": topics,
            "subtopics": subtopics,
            "tags": [],          # to be curated manually
            "description": "",   # to be filled manually or by future AI pass
            "category": "diagram",
            "usedInQuestionUids": uids,
            "updatedAt": now,
        }

        if not dry_run:
            doc_ref = pool_col.document(doc_id)
            # merge=True: preserves manually curated description/tags/category
            batch.set(doc_ref, entry, merge=True)
            # Always overwrite computed fields (topics, uids, imageURL, etc.)
            # by setting them explicitly — merge handles the rest.

        count += 1

        if count % BATCH_SIZE == 0:
            if not dry_run:
                batch.commit()
                batch = db.batch()
                time.sleep(0.3)
            print(f"   Committed {count}/{len(groups)}…")

    # Commit remainder
    if count % BATCH_SIZE != 0 and not dry_run:
        batch.commit()

    return count


def main():
    parser = argparse.ArgumentParser(
        description="Build/update diagramPool from importedQuestions"
    )
    parser.add_argument("--key",      required=True, help="Firebase service account JSON key path")
    parser.add_argument("--subject",  default=None,  help="Filter by subject (e.g. Biology)")
    parser.add_argument("--dry-run",  action="store_true", help="Print what would be written without doing it")
    args = parser.parse_args()

    print("🔑  Initialising Firebase…")
    cred = credentials.Certificate(args.key)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    if args.dry_run:
        print("    Mode: DRY RUN — nothing will be written\n")

    written = build_pool(db, args.subject, args.dry_run)

    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}Done.")
    print(f"  diagramPool entries written/merged: {written}")
    print(f"  Firestore collection: {COLLECTION_TARGET}")


if __name__ == "__main__":
    main()
