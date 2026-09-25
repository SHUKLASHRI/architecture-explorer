import sqlite3


class Database:
    def __init__(self, db_path):
        self.db_path = db_path
        self.conn = None

    def connect(self):
        # Note: sqlite3.connect — receiver is sqlite3 (stdlib), not self
        self.conn = sqlite3.connect(self.db_path)
        return self.conn

    def disconnect(self):
        if self.conn:
            self.conn.close()

    def execute(self, query, params=()):
        cursor = self.conn.cursor()
        cursor.execute(query, params)
        self.conn.commit()
        return cursor


def unused_debug_dump(db):
    """Intentionally unreachable function — tests dead code detection."""
    print(db.__dict__)
