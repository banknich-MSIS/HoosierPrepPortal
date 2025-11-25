"""
Database migration script to add status and progress_state columns to attempts table
Run this once to update your existing database schema
"""
import sqlite3
import sys
from pathlib import Path

# Find the database file
db_paths = [
    Path(__file__).parent / "exam.db",
    Path(__file__).parent.parent / "exam.db",
]

db_path = None
for path in db_paths:
    if path.exists():
        db_path = path
        break

if not db_path:
    print("No exam.db file found. The database will be created fresh on server startup.")
    sys.exit(0)

print(f"Found database at: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if columns already exist
    cursor.execute("PRAGMA table_info(attempts)")
    columns = {row[1] for row in cursor.fetchall()}
    
    changes_made = False
    
    # Add status column if it doesn't exist
    if "status" not in columns:
        print("Adding status column...")
        cursor.execute("""
            ALTER TABLE attempts 
            ADD COLUMN status TEXT DEFAULT 'completed'
        """)
        changes_made = True
        print("[OK] status column added")
    else:
        print("[OK] status column already exists")
    
    # Add progress_state column if it doesn't exist
    if "progress_state" not in columns:
        print("Adding progress_state column...")
        cursor.execute("""
            ALTER TABLE attempts 
            ADD COLUMN progress_state TEXT
        """)
        changes_made = True
        print("[OK] progress_state column added")
    else:
        print("[OK] progress_state column already exists")
    
    if changes_made:
        conn.commit()
        print("\n[SUCCESS] Database migration completed successfully!")
        print("You can now restart your server.")
    else:
        print("\n[SUCCESS] Database schema is already up to date!")
    
except Exception as e:
    print(f"\n[ERROR] Migration failed: {e}")
    print("\nIf migration fails, you can delete exam.db and let the server recreate it.")
    sys.exit(1)
finally:
    if conn:
        conn.close()


