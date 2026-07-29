-- Short-lived one-time tokens for SSE EventSource authentication
-- (EventSource API cannot send custom headers, so we exchange a short-lived token)
CREATE TABLE IF NOT EXISTS sse_tokens (
    id         INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    user_id    INT UNSIGNED    NOT NULL,
    token_hash VARCHAR(64)     NOT NULL,
    expires_at DATETIME        NOT NULL,
    used       TINYINT(1)      NOT NULL DEFAULT 0,
    created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_token  (token_hash),
    KEY        idx_user  (user_id),
    KEY        idx_exp   (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
