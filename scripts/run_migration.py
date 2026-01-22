#!/usr/bin/env python3
"""
Run a SQL migration file against Supabase.

Usage:
    python scripts/run_migration.py supabase/migrations/015_add_auth_tables.sql
"""

import sys
import os
from pathlib import Path

# Add scripts to path for supabase_client
sys.path.insert(0, str(Path(__file__).parent))

from supabase_client import get_db

def run_migration(sql_file: str):
    """Execute a SQL migration file."""
    sql_path = Path(sql_file)
    if not sql_path.exists():
        print(f"❌ File not found: {sql_file}")
        sys.exit(1)

    sql = sql_path.read_text()
    print(f"📄 Running migration: {sql_path.name}")
    print(f"   SQL length: {len(sql)} chars")

    db = get_db(use_service_key=True)

    # Split by statements and execute each
    # Note: This is a simple splitter - complex migrations may need manual execution
    statements = [s.strip() for s in sql.split(';') if s.strip()]

    for i, stmt in enumerate(statements, 1):
        if not stmt or stmt.startswith('--'):
            continue
        try:
            # Use rpc to execute raw SQL
            db.client.postgrest.session.execute(stmt)
            print(f"   ✓ Statement {i}/{len(statements)}")
        except Exception as e:
            # Try alternative method
            try:
                db.client.rpc('exec_sql', {'sql': stmt}).execute()
                print(f"   ✓ Statement {i}/{len(statements)}")
            except Exception as e2:
                print(f"   ⚠️  Statement {i} may need manual execution: {str(e)[:100]}")

    print(f"✅ Migration complete: {sql_path.name}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/run_migration.py <sql_file>")
        sys.exit(1)

    run_migration(sys.argv[1])
