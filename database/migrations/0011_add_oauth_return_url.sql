-- Add return_url column to oauth_states to support custom redirects after OAuth callback

ALTER TABLE oauth_states
  ADD COLUMN return_url TEXT NULL;
