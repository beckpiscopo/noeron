#!/usr/bin/env python3
"""
Seed an allowed email for testing auth.

Usage:
    python scripts/seed_allowed_email.py beckpiscopo@gmail.com
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from supabase_client import get_db

def add_allowed_email(email: str):
    """Add an email to the allowlist."""
    db = get_db(use_service_key=True)

    try:
        result = db.client.table("allowed_emails").upsert({
            "email": email.lower().strip()
        }).execute()

        if result.data:
            print(f"✅ Added to allowlist: {email}")
        else:
            print(f"⚠️  No data returned, but may have succeeded")
    except Exception as e:
        if "duplicate" in str(e).lower():
            print(f"✓ Already in allowlist: {email}")
        else:
            print(f"❌ Error: {e}")
            sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/seed_allowed_email.py <email>")
        sys.exit(1)

    add_allowed_email(sys.argv[1])
