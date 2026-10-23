ALTER TABLE admin_users
  ADD COLUMN password_algorithm TEXT NOT NULL DEFAULT 'pbkdf2-sha256'
  CHECK (password_algorithm IN ('pbkdf2-sha256', 'argon2id-v19-m19456-t2-p1'));
