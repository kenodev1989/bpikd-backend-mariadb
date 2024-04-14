-- SQL to find user by username
SELECT * FROM users WHERE username = ?;

-- SQL to create new user (Admin/User)
INSERT INTO users (firstname, lastname, username, email,nickname, password, role) VALUES (?, ?, ?, ?, ?, ?);

-- SQL to update user data
UPDATE users SET firstname = ?, lastname = ?, email = ? WHERE id = ?;

-- SQL to delete user
DELETE FROM users WHERE id = ?;

-- SQL to get all users (for Admin and Owner)
SELECT * FROM users WHERE role IN ('Owner', 'admin', 'editor');

-- SQL to get user by ID (includes password)
SELECT * FROM users WHERE id = ?;

-- SQL to get user by ID without password (for security reasons)
SELECT id, firstname, lastname, username, email, role, verified, created_at, updated_at FROM users WHERE id = ?;
