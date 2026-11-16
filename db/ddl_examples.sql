-- ALTER and DROP examples. Safe to run on the working database (nothing important is dropped).
-- Run after db/schema.sql:   mysql -u root -p ticketdb < db/ddl_examples.sql
USE ticketdb;

-- ALTER: add a column, change a column type, add then remove an optional column
ALTER TABLE users  ADD COLUMN last_login DATETIME NULL;
ALTER TABLE events MODIFY COLUMN title VARCHAR(200) NOT NULL;
ALTER TABLE events ADD COLUMN banner_url VARCHAR(255) NULL;
ALTER TABLE events DROP COLUMN banner_url;

-- DROP: create a scratch table and drop it again (never drop real tables on a working database)
CREATE TABLE temp_audit (id INT PRIMARY KEY, note VARCHAR(50));
DROP TABLE temp_audit;

DESCRIBE users;

-- To undo the last_login column:  ALTER TABLE users DROP COLUMN last_login;
