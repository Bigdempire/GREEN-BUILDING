import os
import shutil
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / 'ecobuild.db'
BACKUP_PATH = BASE_DIR / 'ecobuild.db.bak'


def has_column(conn, table, column):
    cursor = conn.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def ensure_column(conn, table, column_sql):
    column_name = column_sql.split()[0]
    if not has_column(conn, table, column_name):
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column_sql}")
        return True
    return False


def migrate():
    if not DB_PATH.exists():
        print(f"Database file not found: {DB_PATH}")
        return

    if not BACKUP_PATH.exists():
        shutil.copy2(DB_PATH, BACKUP_PATH)
        print(f"Backup created at {BACKUP_PATH}")
    else:
        print(f"Backup already exists at {BACKUP_PATH}")

    conn = sqlite3.connect(DB_PATH)
    try:
        added = []
        if ensure_column(conn, 'products', 'supplier_id INTEGER'):
            added.append('supplier_id')
        if ensure_column(conn, 'products', "status TEXT NOT NULL DEFAULT 'approved'"):
            added.append('status')
        if added:
            conn.commit()
            print('Migration complete. Added columns:', ', '.join(added))
        else:
            print('No schema changes were required.')
    except sqlite3.DatabaseError as exc:
        print('Migration failed:', exc)
    finally:
        conn.close()


if __name__ == '__main__':
    migrate()
