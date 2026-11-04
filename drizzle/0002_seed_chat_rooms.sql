INSERT INTO "chat_rooms" ("id", "name", "description", "language", "slow_mode_seconds", "sort_order") VALUES
  ('genel', 'Genel', 'Herkese açık genel sohbet', NULL, 5, 0),
  ('tr', 'Türkçe', 'Türkçe sohbet odası', 'tr', 3, 1),
  ('en', 'English', 'English chat room', 'en', 3, 2),
  ('ar', 'العربية', 'غرفة الدردشة العربية', 'ar', 3, 3)
ON CONFLICT ("id") DO NOTHING;
