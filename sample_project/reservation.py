from auth import get_user_by_id, validate_user


class Ticket:
    def __init__(self, ticket_id, route):
        self.ticket_id = ticket_id
        self.route = route

    def describe(self):
        return f"Ticket {self.ticket_id} for route {self.route}"


class ReservationTicket(Ticket):
    """A ticket with an assigned seat — inherits from Ticket."""

    def __init__(self, ticket_id, route, seat):
        super().__init__(ticket_id, route)
        self.seat = seat

    def describe(self):
        base = super().describe()
        return f"{base}, seat {self.seat}"


def book_seat(username, route, seat):
    """Reserve a seat for an authenticated user."""
    user = get_user_by_id(username)
    if not validate_user(user, None):
        return None
    return ReservationTicket("T001", route, seat)


def cancel_seat(ticket_id):
    """Cancel an existing reservation."""
    pass


def get_available_seats(route):
    """Return a list of available seat codes for a route."""
    return ["1A", "1B", "2A", "2B"]
