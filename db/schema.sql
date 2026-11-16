-- Event Ticket Booking & Seat Allocation System
-- MySQL 8.0.16+ (CHECK constraints are enforced from this version)

CREATE DATABASE IF NOT EXISTS ticketdb CHARACTER SET utf8mb4;
USE ticketdb;

-- ---------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------

CREATE TABLE roles (
  role_id     TINYINT PRIMARY KEY AUTO_INCREMENT,
  role_name   VARCHAR(20) NOT NULL UNIQUE      -- CUSTOMER, ORGANIZER, ADMIN
);

CREATE TABLE users (
  user_id        INT PRIMARY KEY AUTO_INCREMENT,
  role_id        TINYINT NOT NULL,
  full_name      VARCHAR(100) NOT NULL,
  email          VARCHAR(120) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,         -- bcrypt hash, never plain text
  phone          VARCHAR(15),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(role_id),
  CONSTRAINT chk_users_email CHECK (email LIKE '%_@_%._%')
);

CREATE TABLE venues (
  venue_id   INT PRIMARY KEY AUTO_INCREMENT,
  name       VARCHAR(120) NOT NULL,
  city       VARCHAR(60)  NOT NULL,
  address    VARCHAR(255),
  capacity   INT NOT NULL,
  CONSTRAINT chk_venue_capacity CHECK (capacity > 0),
  UNIQUE (name, city)
);

CREATE TABLE seat_categories (
  category_id  INT PRIMARY KEY AUTO_INCREMENT,
  venue_id     INT NOT NULL,
  name         VARCHAR(30) NOT NULL,            -- VIP, GOLD, SILVER
  base_price   DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_cat_venue FOREIGN KEY (venue_id) REFERENCES venues(venue_id) ON DELETE CASCADE,
  CONSTRAINT chk_cat_price CHECK (base_price >= 0),
  UNIQUE (venue_id, name)
);

CREATE TABLE seats (
  seat_id      INT PRIMARY KEY AUTO_INCREMENT,
  venue_id     INT NOT NULL,
  category_id  INT NOT NULL,
  row_label    VARCHAR(3) NOT NULL,
  seat_number  INT NOT NULL,
  CONSTRAINT fk_seat_venue FOREIGN KEY (venue_id) REFERENCES venues(venue_id) ON DELETE CASCADE,
  CONSTRAINT fk_seat_cat   FOREIGN KEY (category_id) REFERENCES seat_categories(category_id),
  CONSTRAINT chk_seat_no CHECK (seat_number > 0),
  UNIQUE (venue_id, row_label, seat_number)
);

CREATE TABLE events (
  event_id      INT PRIMARY KEY AUTO_INCREMENT,
  organizer_id  INT NOT NULL,
  title         VARCHAR(150) NOT NULL,
  category      ENUM('CONCERT','MOVIE','SPORTS','THEATRE','CONFERENCE','OTHER') NOT NULL,
  status        ENUM('DRAFT','PUBLISHED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  mongo_doc_id  VARCHAR(24),                    -- link to event details in MongoDB
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_event_org FOREIGN KEY (organizer_id) REFERENCES users(user_id),
  FULLTEXT KEY ft_event_title (title)
);

CREATE TABLE shows (
  show_id     INT PRIMARY KEY AUTO_INCREMENT,
  event_id    INT NOT NULL,
  venue_id    INT NOT NULL,
  start_time  DATETIME NOT NULL,
  end_time    DATETIME NOT NULL,
  status      ENUM('SCHEDULED','CANCELLED','COMPLETED') NOT NULL DEFAULT 'SCHEDULED',
  CONSTRAINT fk_show_event FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
  CONSTRAINT fk_show_venue FOREIGN KEY (venue_id) REFERENCES venues(venue_id),
  CONSTRAINT chk_show_time CHECK (end_time > start_time),
  UNIQUE (venue_id, start_time)                 -- one show per venue per slot
);

-- Per-show seat inventory: one row per (show, seat)
CREATE TABLE show_seats (
  show_seat_id  INT PRIMARY KEY AUTO_INCREMENT,
  show_id       INT NOT NULL,
  seat_id       INT NOT NULL,
  price         DECIMAL(10,2) NOT NULL,
  status        ENUM('AVAILABLE','HELD','BOOKED') NOT NULL DEFAULT 'AVAILABLE',
  CONSTRAINT fk_ss_show FOREIGN KEY (show_id) REFERENCES shows(show_id) ON DELETE CASCADE,
  CONSTRAINT fk_ss_seat FOREIGN KEY (seat_id) REFERENCES seats(seat_id),
  CONSTRAINT chk_ss_price CHECK (price >= 0),
  UNIQUE (show_id, seat_id)                     -- a seat exists once per show
);

CREATE TABLE bookings (
  booking_id       INT PRIMARY KEY AUTO_INCREMENT,
  user_id          INT NOT NULL,
  show_id          INT NOT NULL,
  status           ENUM('PENDING','CONFIRMED','CANCELLED','EXPIRED') NOT NULL DEFAULT 'PENDING',
  total_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
  hold_expires_at  DATETIME,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_book_user FOREIGN KEY (user_id) REFERENCES users(user_id),
  CONSTRAINT fk_book_show FOREIGN KEY (show_id) REFERENCES shows(show_id),
  CONSTRAINT chk_book_total CHECK (total_amount >= 0)
);

CREATE TABLE booking_seats (
  booking_id     INT NOT NULL,
  show_seat_id   INT NOT NULL,
  price_paid     DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (booking_id, show_seat_id),
  CONSTRAINT fk_bs_booking  FOREIGN KEY (booking_id)   REFERENCES bookings(booking_id) ON DELETE CASCADE,
  CONSTRAINT fk_bs_showseat FOREIGN KEY (show_seat_id) REFERENCES show_seats(show_seat_id)
);

CREATE TABLE payments (
  payment_id  INT PRIMARY KEY AUTO_INCREMENT,
  booking_id  INT NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  method      ENUM('UPI','CARD','NETBANKING','WALLET') NOT NULL,
  status      ENUM('SUCCESS','FAILED','REFUNDED') NOT NULL,
  txn_ref     VARCHAR(60) UNIQUE,
  paid_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pay_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
  CONSTRAINT chk_pay_amount CHECK (amount > 0)
);

CREATE TABLE cancellations (
  cancellation_id  INT PRIMARY KEY AUTO_INCREMENT,
  booking_id       INT NOT NULL UNIQUE,
  refund_amount    DECIMAL(10,2) NOT NULL,
  cancelled_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cancel_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
  CONSTRAINT chk_refund CHECK (refund_amount >= 0)
);

-- ---------------------------------------------------------
-- 2. INDEXES (beyond PK/UNIQUE)
-- ---------------------------------------------------------
CREATE INDEX idx_ss_show_status   ON show_seats (show_id, status);
CREATE INDEX idx_book_user        ON bookings (user_id, created_at);
CREATE INDEX idx_book_status_hold ON bookings (status, hold_expires_at);
CREATE INDEX idx_show_event_time  ON shows (event_id, start_time);

-- ---------------------------------------------------------
-- 3. VIEWS
-- ---------------------------------------------------------
CREATE VIEW v_show_occupancy AS
SELECT sh.show_id, e.title, sh.start_time,
       COUNT(*) AS total_seats,
       SUM(ss.status = 'BOOKED') AS booked,
       SUM(ss.status = 'HELD')   AS held,
       ROUND(100 * SUM(ss.status = 'BOOKED') / COUNT(*), 2) AS occupancy_pct
FROM shows sh
JOIN events e      ON e.event_id = sh.event_id
JOIN show_seats ss ON ss.show_id = sh.show_id
GROUP BY sh.show_id, e.title, sh.start_time;

CREATE VIEW v_organizer_revenue AS
SELECT e.organizer_id, e.event_id, e.title,
       COUNT(DISTINCT b.booking_id) AS confirmed_bookings,
       SUM(b.total_amount)          AS gross_revenue
FROM events e
JOIN shows sh    ON sh.event_id = e.event_id
JOIN bookings b  ON b.show_id = sh.show_id AND b.status = 'CONFIRMED'
GROUP BY e.organizer_id, e.event_id, e.title;

CREATE VIEW v_user_booking_history AS
SELECT b.user_id, b.booking_id, e.title, sh.start_time, v.name AS venue,
       b.status, b.total_amount, COUNT(bs.show_seat_id) AS seat_count
FROM bookings b
JOIN shows sh  ON sh.show_id = b.show_id
JOIN events e  ON e.event_id = sh.event_id
JOIN venues v  ON v.venue_id = sh.venue_id
JOIN booking_seats bs ON bs.booking_id = b.booking_id
GROUP BY b.booking_id, b.user_id, e.title, sh.start_time, v.name, b.status, b.total_amount;

-- ---------------------------------------------------------
-- 4. STORED PROCEDURES, TRIGGER, EVENT
-- ---------------------------------------------------------
DELIMITER $$

-- Function: number of seats still available for a show
CREATE FUNCTION fn_available_seats(p_show_id INT)
RETURNS INT
READS SQL DATA
BEGIN
  DECLARE v_cnt INT;
  SELECT COUNT(*) INTO v_cnt
  FROM show_seats
  WHERE show_id = p_show_id AND status = 'AVAILABLE';
  RETURN v_cnt;
END$$

-- Function: refund for a booking (100% if more than 24h before the show, else 50%)
CREATE FUNCTION fn_refund_amount(p_booking_id INT)
RETURNS DECIMAL(10,2)
READS SQL DATA
BEGIN
  DECLARE v_total DECIMAL(10,2);
  DECLARE v_start DATETIME;
  SELECT b.total_amount, sh.start_time INTO v_total, v_start
  FROM bookings b JOIN shows sh ON sh.show_id = b.show_id
  WHERE b.booking_id = p_booking_id;
  RETURN IF(v_start > NOW() + INTERVAL 24 HOUR, v_total, ROUND(v_total * 0.5, 2));
END$$

-- Create the seat inventory for a show from the venue's seat map
CREATE PROCEDURE generate_show_seats(IN p_show_id INT)
BEGIN
  INSERT INTO show_seats (show_id, seat_id, price)
  SELECT p_show_id, s.seat_id, c.base_price
  FROM seats s
  JOIN seat_categories c ON c.category_id = s.category_id
  WHERE s.venue_id = (SELECT venue_id FROM shows WHERE show_id = p_show_id);
END$$

-- Core booking transaction: lock the seats, verify, hold for 10 minutes
-- p_seat_ids is a JSON array of show_seat_id values, e.g. '[101,102,103]'
CREATE PROCEDURE book_seats(
  IN  p_user_id INT,
  IN  p_show_id INT,
  IN  p_seat_ids JSON,
  OUT p_booking_id INT
)
BEGIN
  DECLARE v_available INT DEFAULT 0;
  DECLARE v_total DECIMAL(10,2) DEFAULT 0;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET p_booking_id = NULL;
    RESIGNAL;
  END;

  START TRANSACTION;

  -- Lock the requested rows so concurrent bookings must wait
  SELECT COUNT(*), COALESCE(SUM(ss.price), 0)
    INTO v_available, v_total
  FROM show_seats ss
  WHERE ss.show_id = p_show_id
    AND ss.status = 'AVAILABLE'
    AND ss.show_seat_id IN (
      SELECT jt.id FROM JSON_TABLE(p_seat_ids, '$[*]' COLUMNS (id INT PATH '$')) jt
    )
  FOR UPDATE;

  IF v_available <> JSON_LENGTH(p_seat_ids) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'One or more seats are no longer available';
  END IF;

  INSERT INTO bookings (user_id, show_id, status, total_amount, hold_expires_at)
  VALUES (p_user_id, p_show_id, 'PENDING', v_total, NOW() + INTERVAL 10 MINUTE);
  SET p_booking_id = LAST_INSERT_ID();

  INSERT INTO booking_seats (booking_id, show_seat_id, price_paid)
  SELECT p_booking_id, ss.show_seat_id, ss.price
  FROM show_seats ss
  WHERE ss.show_seat_id IN (
    SELECT jt.id FROM JSON_TABLE(p_seat_ids, '$[*]' COLUMNS (id INT PATH '$')) jt
  );

  UPDATE show_seats
  SET status = 'HELD'
  WHERE show_seat_id IN (
    SELECT jt.id FROM JSON_TABLE(p_seat_ids, '$[*]' COLUMNS (id INT PATH '$')) jt
  );

  COMMIT;
END$$

-- Record payment and confirm the booking
CREATE PROCEDURE confirm_payment(
  IN p_booking_id INT,
  IN p_method VARCHAR(20),
  IN p_txn_ref VARCHAR(60)
)
BEGIN
  DECLARE v_amount DECIMAL(10,2);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT total_amount INTO v_amount
  FROM bookings
  WHERE booking_id = p_booking_id AND status = 'PENDING' AND hold_expires_at > NOW()
  FOR UPDATE;

  IF v_amount IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Booking is not pending or the hold has expired';
  END IF;

  INSERT INTO payments (booking_id, amount, method, status, txn_ref)
  VALUES (p_booking_id, v_amount, p_method, 'SUCCESS', p_txn_ref);

  UPDATE show_seats ss
  JOIN booking_seats bs ON bs.show_seat_id = ss.show_seat_id
  SET ss.status = 'BOOKED'
  WHERE bs.booking_id = p_booking_id;

  UPDATE bookings SET status = 'CONFIRMED', hold_expires_at = NULL
  WHERE booking_id = p_booking_id;

  COMMIT;
END$$

-- Trigger: when a booking is cancelled or expires, release its seats;
-- for confirmed bookings that get cancelled, also log the refund.
CREATE TRIGGER trg_booking_release_seats
AFTER UPDATE ON bookings
FOR EACH ROW
BEGIN
  IF OLD.status <> NEW.status AND NEW.status IN ('CANCELLED','EXPIRED') THEN
    UPDATE show_seats ss
    JOIN booking_seats bs ON bs.show_seat_id = ss.show_seat_id
    SET ss.status = 'AVAILABLE'
    WHERE bs.booking_id = NEW.booking_id;

    IF OLD.status = 'CONFIRMED' AND NEW.status = 'CANCELLED' THEN
      INSERT INTO cancellations (booking_id, refund_amount)
      VALUES (NEW.booking_id, fn_refund_amount(NEW.booking_id));
    END IF;
  END IF;
END$$

-- Trigger: the booking status is a small state machine. Only these moves are legal:
--     PENDING   -> CONFIRMED | CANCELLED | EXPIRED
--     CONFIRMED -> CANCELLED
--     CANCELLED and EXPIRED are final.
-- Any other change (e.g. CANCELLED -> CONFIRMED, EXPIRED -> PENDING) is rejected, no matter who
-- runs the UPDATE (application, a DBA at the mysql prompt, a mistake in a future procedure).
-- A booking may also become CONFIRMED only if a successful payment row exists for it.
CREATE TRIGGER trg_booking_status_guard
BEFORE UPDATE ON bookings
FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status THEN
    IF NOT (
         (OLD.status = 'PENDING'   AND NEW.status IN ('CONFIRMED','CANCELLED','EXPIRED'))
      OR (OLD.status = 'CONFIRMED' AND NEW.status = 'CANCELLED')
    ) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Illegal booking status change: a booking can only go PENDING to CONFIRMED/CANCELLED/EXPIRED or CONFIRMED to CANCELLED';
    END IF;

    IF NEW.status = 'CONFIRMED'
       AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = NEW.booking_id AND p.status = 'SUCCESS') THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'A booking cannot be CONFIRMED without a successful payment';
    END IF;
  END IF;
END$$

-- Cancel a booking on behalf of its owner. Customers are not given UPDATE rights on bookings;
-- they may only run this procedure, which checks ownership and lets the triggers do the rest
-- (status guard -> release seats -> log refund).
CREATE PROCEDURE cancel_booking(
  IN  p_booking_id INT,
  IN  p_user_id    INT,
  OUT p_refund     DECIMAL(10,2)
)
BEGIN
  DECLARE v_status VARCHAR(20) DEFAULT NULL;
  DECLARE v_msg VARCHAR(100);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET p_refund = NULL;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT status INTO v_status
  FROM bookings
  WHERE booking_id = p_booking_id AND user_id = p_user_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Booking not found';
  END IF;
  IF v_status NOT IN ('PENDING','CONFIRMED') THEN          -- a no-change UPDATE would not trip the trigger, so say no here
    SET v_msg = CONCAT('A ', LOWER(v_status), ' booking cannot be cancelled');   -- MESSAGE_TEXT must be a literal or variable
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
  END IF;

  UPDATE bookings SET status = 'CANCELLED', hold_expires_at = NULL
  WHERE booking_id = p_booking_id;                  -- trigger rejects it if the status is final

  SET p_refund = 0;
  IF v_status = 'CONFIRMED' THEN
    UPDATE payments SET status = 'REFUNDED'
    WHERE booking_id = p_booking_id AND status = 'SUCCESS';
    SELECT COALESCE(refund_amount, 0) INTO p_refund
    FROM cancellations WHERE booking_id = p_booking_id;
  END IF;

  COMMIT;
END$$

-- Scheduled event: expire unpaid holds every minute (trigger frees the seats)
CREATE EVENT ev_expire_holds
ON SCHEDULE EVERY 1 MINUTE
DO
BEGIN
  UPDATE bookings
  SET status = 'EXPIRED'
  WHERE status = 'PENDING' AND hold_expires_at < NOW();
END$$

DELIMITER ;

-- Needed once so the scheduled event actually runs:
-- SET GLOBAL event_scheduler = ON;

-- Seed roles
INSERT INTO roles (role_name) VALUES ('CUSTOMER'), ('ORGANIZER'), ('ADMIN');
