"""
Database migration script to add is_active column to questions table
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
    cursor.execute("PRAGMA table_info(questions)")
    columns = {row[1] for row in cursor.fetchall()}
    
    changes_made = False
    
    # Add is_active column if it doesn't exist
    if "is_active" not in columns:
        print("Adding is_active column...")
        cursor.execute("""
            ALTER TABLE questions 
            ADD COLUMN is_active BOOLEAN DEFAULT 1 NOT NULL
        """)
        changes_made = True
        print("[OK] is_active column added")
    else:
        print("[OK] is_active column already exists")
    
    if changes_made:
        conn.commit()
        print("\n[SUCCESS] Database migration completed successfully!")
    else:
        print("\n[SUCCESS] Database schema is already up to date!")
    
except Exception as e:
    print(f"\n[ERROR] Migration failed: {e}")
    sys.exit(1)
finally:
    if conn:
        conn.close()

