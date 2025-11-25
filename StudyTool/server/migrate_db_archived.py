import sqlite3
import os

DB_PATH = "StudyTool/exam.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(uploads)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if "is_archived" not in columns:
            print("Adding is_archived column to uploads table...")
            cursor.execute("ALTER TABLE uploads ADD COLUMN is_archived BOOLEAN DEFAULT 0 NOT NULL")
            conn.commit()
            print("Migration successful.")
        else:
            print("Column is_archived already exists.")
            
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()

