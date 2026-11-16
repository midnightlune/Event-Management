USE ticketdb;

-- ---------- Users (password_hash holds bcrypt hashes, never plain text) ----------
INSERT INTO users (role_id, full_name, email, password_hash, phone) VALUES
(3, 'Admin User',      'admin@ticketdb.in',   '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '9000000001'),
(2, 'Meera Organizers','meera@liveevents.in', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '9000000002'),
(2, 'Karthik Productions','karthik@showtime.in','$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy','9000000003'),
(1, 'Anita Rao',       'anita@mail.com',      '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '9000000004'),
(1, 'Rohan Shetty',    'rohan@mail.com',      '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '9000000005'),
(1, 'Divya Nair',      'divya@mail.com',      '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '9000000006'),
(1, 'Imran Khan',      'imran@mail.com',      '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '9000000007');

-- ---------- Venues and seat categories ----------
INSERT INTO venues (name, city, address, capacity) VALUES
('Phoenix Arena',   'Bengaluru', 'Whitefield Main Road', 30),
('Ranga Hall',      'Bengaluru', 'JP Nagar 2nd Phase',   20);

INSERT INTO seat_categories (venue_id, name, base_price) VALUES
(1, 'VIP',      2500.00),
(1, 'GOLD',     1500.00),
(1, 'SILVER',    800.00),
(2, 'PREMIUM',   700.00),
(2, 'STANDARD',  400.00);

-- ---------- Seats (rows x 6 seats for Phoenix Arena, rows x 5 for Ranga Hall) ----------
INSERT INTO seats (venue_id, category_id, row_label, seat_number)
WITH RECURSIVE n AS (SELECT 1 AS k UNION ALL SELECT k + 1 FROM n WHERE k < 6)
SELECT 1, r.cat, r.row_label, n.k
FROM n JOIN (SELECT 'A' AS row_label, 1 AS cat UNION ALL SELECT 'B', 2 UNION ALL SELECT 'C', 2
             UNION ALL SELECT 'D', 3 UNION ALL SELECT 'E', 3) r
ORDER BY r.row_label, n.k;

INSERT INTO seats (venue_id, category_id, row_label, seat_number)
WITH RECURSIVE n AS (SELECT 1 AS k UNION ALL SELECT k + 1 FROM n WHERE k < 5)
SELECT 2, r.cat, r.row_label, n.k
FROM n JOIN (SELECT 'A' AS row_label, 4 AS cat UNION ALL SELECT 'B', 4
             UNION ALL SELECT 'C', 5 UNION ALL SELECT 'D', 5) r
ORDER BY r.row_label, n.k;

-- ---------- Events and shows ----------
INSERT INTO events (organizer_id, title, category, status, mongo_doc_id) VALUES
(2, 'Rock Nation Live 2026',   'CONCERT',    'PUBLISHED', '665f1a2b3c4d5e6f70818293'),
(2, 'Stand-Up Saturday',       'THEATRE',    'PUBLISHED', '665f1a2b3c4d5e6f70818294'),
(3, 'Tech Summit Bengaluru',   'CONFERENCE', 'PUBLISHED', '665f1a2b3c4d5e6f70818295'),
(3, 'Classical Evening',       'CONCERT',    'DRAFT',     NULL);

INSERT INTO shows (event_id, venue_id, start_time, end_time) VALUES
(1, 1, '2026-12-05 19:00:00', '2026-12-05 22:00:00'),
(1, 1, '2026-12-06 19:00:00', '2026-12-06 22:00:00'),
(2, 2, '2026-12-10 20:00:00', '2026-12-10 22:00:00'),
(3, 2, '2026-12-15 09:00:00', '2026-12-15 17:00:00');

-- Build the seat inventory for every show
CALL generate_show_seats(1);
CALL generate_show_seats(2);
CALL generate_show_seats(3);
CALL generate_show_seats(4);

-- ---------- Bookings (through the transactional procedures) ----------
-- Anita: VIP seats A1, A2 for show 1, paid by UPI
SELECT JSON_ARRAYAGG(ss.show_seat_id) INTO @seats
FROM show_seats ss JOIN seats s ON s.seat_id = ss.seat_id
WHERE ss.show_id = 1 AND s.row_label = 'A' AND s.seat_number IN (1, 2);
CALL book_seats(4, 1, @seats, @b1);
CALL confirm_payment(@b1, 'UPI', 'UPI-TXN-1001');

-- Rohan: GOLD seats B1, B2, B3 for show 1, paid by card
SELECT JSON_ARRAYAGG(ss.show_seat_id) INTO @seats
FROM show_seats ss JOIN seats s ON s.seat_id = ss.seat_id
WHERE ss.show_id = 1 AND s.row_label = 'B' AND s.seat_number IN (1, 2, 3);
CALL book_seats(5, 1, @seats, @b2);
CALL confirm_payment(@b2, 'CARD', 'CARD-TXN-2001');

-- Divya: SILVER seat D1 for show 1
SELECT JSON_ARRAYAGG(ss.show_seat_id) INTO @seats
FROM show_seats ss JOIN seats s ON s.seat_id = ss.seat_id
WHERE ss.show_id = 1 AND s.row_label = 'D' AND s.seat_number = 1;
CALL book_seats(6, 1, @seats, @b3);
CALL confirm_payment(@b3, 'WALLET', 'WAL-TXN-3001');

-- Anita: PREMIUM seats A1, A2 for the stand-up show (show 3)
SELECT JSON_ARRAYAGG(ss.show_seat_id) INTO @seats
FROM show_seats ss JOIN seats s ON s.seat_id = ss.seat_id
WHERE ss.show_id = 3 AND s.row_label = 'A' AND s.seat_number IN (1, 2);
CALL book_seats(4, 3, @seats, @b4);
CALL confirm_payment(@b4, 'UPI', 'UPI-TXN-1002');

-- Imran: SILVER seats E1, E2 for show 2, left PENDING (seats on hold)
SELECT JSON_ARRAYAGG(ss.show_seat_id) INTO @seats
FROM show_seats ss JOIN seats s ON s.seat_id = ss.seat_id
WHERE ss.show_id = 2 AND s.row_label = 'E' AND s.seat_number IN (1, 2);
CALL book_seats(7, 2, @seats, @b5);

-- Rohan: STANDARD seat C1 for the tech summit (show 4), confirmed
SELECT JSON_ARRAYAGG(ss.show_seat_id) INTO @seats
FROM show_seats ss JOIN seats s ON s.seat_id = ss.seat_id
WHERE ss.show_id = 4 AND s.row_label = 'C' AND s.seat_number = 1;
CALL book_seats(5, 4, @seats, @b6);
CALL confirm_payment(@b6, 'NETBANKING', 'NB-TXN-4001');

-- Divya: attempted a booking but never paid; the hold lapsed (trigger frees the seat)
SELECT JSON_ARRAYAGG(ss.show_seat_id) INTO @seats
FROM show_seats ss JOIN seats s ON s.seat_id = ss.seat_id
WHERE ss.show_id = 4 AND s.row_label = 'C' AND s.seat_number = 2;
CALL book_seats(6, 4, @seats, @b7);
UPDATE bookings SET status = 'EXPIRED' WHERE booking_id = @b7;
