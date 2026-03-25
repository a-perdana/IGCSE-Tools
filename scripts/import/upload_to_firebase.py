#!/usr/bin/env python3
"""
upload_to_firebase.py
Uploads parsed IGCSE questions and images to Firebase (Storage + Firestore).

Usage:
    python upload_to_firebase.py questions.json images/ --key igcse-tools-sa.json

    # Dry run (no actual uploads):
    python upload_to_firebase.py questions.json images/ --key sa.json --dry-run

    # Skip image upload (questions only):
    python upload_to_firebase.py questions.json images/ --key sa.json --skip-images

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
    from firebase_admin import credentials, firestore, storage
except ImportError:
    print("❌  firebase-admin not installed. Run:")
    print("    pip install firebase-admin")
    sys.exit(1)


# ─── Config ───────────────────────────────────────────────────────────────────

FIREBASE_PROJECT = "igcse-tools"
STORAGE_BUCKET   = "igcse-tools.firebasestorage.app"
COLLECTION_NAME  = "importedQuestions"
STORAGE_PREFIX   = "diagrams/biology"

BATCH_SIZE = 400   # Firestore max is 500; leave margin


# ─── Upload images to Cloud Storage ──────────────────────────────────────────

def upload_images(
    questions: list[dict],
    images_dir: Path,
    bucket,
    dry_run: bool
) -> dict[str, str]:
    """
    Upload images referenced by questions to Firebase Storage.
    Returns {imageName: publicURL} mapping.
    """
    image_names = sorted({
        q['imageName'] for q in questions if q.get('imageName')
    })

    if not image_names:
        print("   No images to upload.")
        return {}

    print(f"🖼️   Uploading {len(image_names)} unique images…")
    urls: dict[str, str] = {}
    missing: list[str] = []

    for i, name in enumerate(image_names):
        image_path = images_dir / name
        if not image_path.exists():
            missing.append(name)
            continue

        storage_path = f"{STORAGE_PREFIX}/{name}"

        if not dry_run:
            blob = bucket.blob(storage_path)
            blob.upload_from_filename(
                str(image_path),
                content_type='image/png'
            )
            blob.make_public()
            urls[name] = blob.public_url
        else:
            urls[name] = (
                f"https://storage.googleapis.com/{STORAGE_BUCKET}/{storage_path}"
            )

        if (i + 1) % 100 == 0 or (i + 1) == len(image_names):
            print(f"   {i+1}/{len(image_names)} uploaded")

    if missing:
        print(f"   ⚠️   {len(missing)} images not found in images/ directory:")
        for m in missing[:10]:
            print(f"        {m}")
        if len(missing) > 10:
            print(f"        … and {len(missing) - 10} more")

    print(f"✅  Images done  ({len(urls)} uploaded)")
    return urls


# ─── Upload questions to Firestore ────────────────────────────────────────────

def upload_questions(
    questions: list[dict],
    image_urls: dict[str, str],
    db,
    dry_run: bool
) -> int:
    """
    Batch-write questions to Firestore importedQuestions collection.
    Returns count of documents written.
    """
    print(f"📝  Uploading {len(questions)} questions to '{COLLECTION_NAME}'…")

    now = datetime.now(timezone.utc)
    collection = db.collection(COLLECTION_NAME)
    count = 0

    batch = db.batch()

    for q in questions:
        doc_data = {
            **q,
            'createdAt': now,
            'importedAt': now,
        }

        # Attach image URL if available
        image_name = q.get('imageName')
        if image_name and image_name in image_urls:
            doc_data['imageURL'] = image_urls[image_name]

        if not dry_run:
            doc_ref = collection.document(q['uid'])
            batch.set(doc_ref, doc_data)

        count += 1

        # Commit in batches
        if count % BATCH_SIZE == 0:
            if not dry_run:
                batch.commit()
                batch = db.batch()
                time.sleep(0.5)  # avoid rate limits
            print(f"   Committed {count}/{len(questions)}…")

    # Commit remainder
    remaining = count % BATCH_SIZE
    if remaining and not dry_run:
        batch.commit()

    print(f"✅  Questions done  ({count} documents)")
    return count


# ─── Entry point ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='Upload parsed IGCSE Biology questions to Firebase'
    )
    parser.add_argument('questions_json', help='Path to questions.json from parse step')
    parser.add_argument('images_dir',     help='Path to extracted images directory')
    parser.add_argument('--key',          required=True,
                        help='Firebase service account JSON key path')
    parser.add_argument('--dry-run',      action='store_true',
                        help='Print what would be uploaded without actually doing it')
    parser.add_argument('--skip-images',  action='store_true',
                        help='Skip image upload (Firestore only)')
    parser.add_argument('--topic',        default=None,
                        help='Only upload questions matching this topic (partial match)')
    args = parser.parse_args()

    # ── Load data ─────────────────────────────────────────────────────────────
    data_path = Path(args.questions_json)
    images_dir = Path(args.images_dir)

    if not data_path.exists():
        print(f"❌  File not found: {data_path}")
        sys.exit(1)

    data = json.loads(data_path.read_text(encoding='utf-8'))
    questions: list[dict] = data['questions']
    meta = data.get('metadata', {})

    # Optional topic filter
    if args.topic:
        questions = [
            q for q in questions
            if args.topic.lower() in q.get('topic', '').lower()
        ]
        print(f"🔎  Topic filter '{args.topic}': {len(questions)} questions")

    print(f"📦  Source  : {meta.get('source', data_path.name)}")
    print(f"    Total   : {len(questions)} questions")
    if args.dry_run:
        print("    Mode    : DRY RUN — nothing will be uploaded\n")

    # ── Init Firebase ─────────────────────────────────────────────────────────
    print("🔑  Initialising Firebase…")
    cred = credentials.Certificate(args.key)
    firebase_admin.initialize_app(cred, {
        'storageBucket': STORAGE_BUCKET
    })
    db     = firestore.client()
    bucket = storage.bucket()

    # ── Upload images ─────────────────────────────────────────────────────────
    image_urls: dict[str, str] = {}
    if not args.skip_images:
        image_urls = upload_images(questions, images_dir, bucket, args.dry_run)

    # ── Upload questions ──────────────────────────────────────────────────────
    written = upload_questions(questions, image_urls, db, args.dry_run)

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}Import complete.")
    print(f"  Questions uploaded : {written}")
    print(f"  Images uploaded    : {len(image_urls)}")
    print(f"\nFirestore collection : {COLLECTION_NAME}")
    print(f"Storage prefix       : gs://{STORAGE_BUCKET}/{STORAGE_PREFIX}/")


if __name__ == "__main__":
    main()
