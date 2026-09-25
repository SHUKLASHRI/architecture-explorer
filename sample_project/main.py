from reservation import book_seat, cancel_seat, get_available_seats
from auth import SessionManager


def run():
    """Main entry point for the railway reservation application."""
    mgr = SessionManager("railway.db")
    mgr.login("alice", "secret123")

    seats = get_available_seats("NYC-BOS")
    if seats:
        ticket = book_seat("alice", "NYC-BOS", seats[0])
        if ticket:
            print(ticket.describe())
            cancel_seat(ticket.ticket_id)

    mgr.logout("session_abc123")


if __name__ == "__main__":
    run()
