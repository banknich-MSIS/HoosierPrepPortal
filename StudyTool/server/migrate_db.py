"""
Database migration script to add exam_type and duration_seconds columns
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
    
    # Add exam_type column if it doesn't exist
    if "exam_type" not in columns:
        print("Adding exam_type column...")
        cursor.execute("""
            ALTER TABLE attempts 
            ADD COLUMN exam_type TEXT DEFAULT 'exam'
        """)
        changes_made = True
        print("[OK] exam_type column added")
    else:
        print("[OK] exam_type column already exists")
    
    # Add duration_seconds column if it doesn't exist
    if "duration_seconds" not in columns:
        print("Adding duration_seconds column...")
        cursor.execute("""
            ALTER TABLE attempts 
            ADD COLUMN duration_seconds INTEGER
        """)
        changes_made = True
        print("[OK] duration_seconds column added")
    else:
        print("[OK] duration_seconds column already exists")
    
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

