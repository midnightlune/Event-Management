-- Database-level role-based access control (MySQL 8 roles).
-- Run by:  npm run db:roles      (after db:setup; it also creates the login accounts, see scripts/setup-roles.mjs)
-- Or by hand as an administrator:  mysql -u root -p < db/roles.sql
--
-- This file defines ROLES (bundles of privileges) only. It contains no accounts and no passwords.
-- The web app connects with one account per role, so a bug or SQL injection in a customer request can
-- never do more than role_customer is allowed to do.
--
--   role_guest      anonymous visitors: read the public catalogue
--   role_auth       login / register only: reads and inserts users (never used for anything else)
--   role_customer   guest + own bookings through procedures
--   role_organizer  customer + manage events and shows, see sales reports
--   role_admin      everything in ticketdb
USE ticketdb;

CREATE ROLE IF NOT EXISTS 'role_guest', 'role_auth', 'role_customer', 'role_organizer', 'role_admin';

-- ---------- GUEST: browse events, shows, seats ----------
GRANT SELECT ON ticketdb.events          TO 'role_guest';
GRANT SELECT ON ticketdb.shows           TO 'role_guest';
GRANT SELECT ON ticketdb.venues          TO 'role_guest';
GRANT SELECT ON ticketdb.seat_categories TO 'role_guest';
GRANT SELECT ON ticketdb.seats           TO 'role_guest';
GRANT SELECT ON ticketdb.show_seats      TO 'role_guest';
GRANT SELECT (user_id, full_name) ON ticketdb.users TO 'role_guest';     -- organiser name on the event page; never email or hash
GRANT EXECUTE ON FUNCTION ticketdb.fn_available_seats TO 'role_guest';

-- ---------- AUTH: only what login and registration need ----------
GRANT SELECT ON ticketdb.users TO 'role_auth';
GRANT SELECT ON ticketdb.roles TO 'role_auth';
GRANT INSERT ON ticketdb.users TO 'role_auth';

-- ---------- CUSTOMER: guest + bookings ----------
-- Customers get NO insert/update/delete on any table. Every change they cause goes through a
-- stored procedure (which runs with the procedure owner's rights) and is checked by the triggers.
GRANT 'role_guest' TO 'role_customer';
GRANT SELECT ON ticketdb.bookings       TO 'role_customer';
GRANT SELECT ON ticketdb.booking_seats  TO 'role_customer';
GRANT SELECT ON ticketdb.cancellations  TO 'role_customer';
GRANT SELECT ON ticketdb.v_user_booking_history TO 'role_customer';
GRANT EXECUTE ON PROCEDURE ticketdb.book_seats      TO 'role_customer';
GRANT EXECUTE ON PROCEDURE ticketdb.confirm_payment TO 'role_customer';
GRANT EXECUTE ON PROCEDURE ticketdb.cancel_booking  TO 'role_customer';
GRANT EXECUTE ON FUNCTION  ticketdb.fn_refund_amount TO 'role_customer';

-- ---------- ORGANIZER: customer + manage events and shows, see reports ----------
GRANT 'role_customer' TO 'role_organizer';
GRANT INSERT, UPDATE ON ticketdb.events TO 'role_organizer';
GRANT INSERT, UPDATE ON ticketdb.shows  TO 'role_organizer';
GRANT SELECT ON ticketdb.payments            TO 'role_organizer';
GRANT SELECT ON ticketdb.v_show_occupancy    TO 'role_organizer';
GRANT SELECT ON ticketdb.v_organizer_revenue TO 'role_organizer';
GRANT EXECUTE ON PROCEDURE ticketdb.generate_show_seats TO 'role_organizer';

-- ---------- ADMIN: full control of the application database ----------
GRANT ALL PRIVILEGES ON ticketdb.* TO 'role_admin';
