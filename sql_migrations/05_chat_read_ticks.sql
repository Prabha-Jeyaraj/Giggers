-- Add last_read_at to chat_threads (for private chat unread tracking)
ALTER TABLE chat_threads ADD COLUMN IF NOT EXISTS employer_last_read_at timestamptz;
ALTER TABLE chat_threads ADD COLUMN IF NOT EXISTS worker_last_read_at timestamptz;

-- Add delivery/read ticks to chat_messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS read_at timestamptz;
