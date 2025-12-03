"""
Database migration: Add explanation field to questions table.
Run this script to add the explanation column for storing AI-generated answer explanations.
"""
from sqlalchemy import text
from sqlalchemy import create_engine

def migrate():
    """Add explanation column to questions table."""
    print("Starting migration: Add explanation column to questions table...")
    
    # Create engine with relative path (same as db.py)
    engine = create_engine("sqlite:///./exam.db")
    
    try:
        with engine.connect() as conn:
            # Check if column already exists
            result = conn.execute(text("""
                SELECT COUNT(*) 
                FROM pragma_table_info('questions') 
                WHERE name='explanation'
            """))
            exists = result.scalar()
            
            if exists:
                print("WARNING: Column 'explanation' already exists in questions table. Skipping migration.")
                return
            
            # Add explanation column
            conn.execute(text("ALTER TABLE questions ADD COLUMN explanation TEXT NULL"))
            conn.commit()
            print("SUCCESS: Added explanation column to questions table")
            
    except Exception as e:
        print(f"ERROR: Migration failed: {str(e)}")
        raise

if __name__ == "__main__":
    migrate()

