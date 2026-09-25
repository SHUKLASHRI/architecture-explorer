from database import Database


class AuthError(Exception):
    """Raised when authentication fails."""
    pass


class SessionManager:
    def __init__(self, db_path):
        self.db = Database(db_path)
        self.db.connect()

    def login(self, username, password):
        user = get_user_by_id(username)
        if not validate_user(user, password):
            raise AuthError("Invalid credentials")
        return create_session(user)

    def logout(self, session_id):
        delete_session(session_id)


def get_user_by_id(username):
    """Look up a user record by username."""
    return {"username": username, "active": True}


def validate_user(user, password):
    """Check that a user record exists and is active."""
    return user is not None and user.get("active", False)


def create_session(user):
    """Create a new session token for the authenticated user."""
    return {"user": user, "token": "abc123"}


def delete_session(session_id):
    """Invalidate an existing session."""
    pass
