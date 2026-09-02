-- 002_identity.sql
-- Identity tables deliberately separate login users from financial clients.

BEGIN;

CREATE TABLE identity.client_segments (
    segment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_code TEXT NOT NULL UNIQUE,
    segment_name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (segment_code = upper(segment_code))
);

CREATE TABLE identity.users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ,
    CHECK (status IN ('ACTIVE', 'LOCKED', 'DISABLED')),
    CHECK (length(password_hash) >= 20),
    CHECK (position('@' IN email::TEXT) > 1)
);

CREATE TABLE identity.clients (
    client_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES identity.users(user_id) ON DELETE RESTRICT,
    segment_id UUID REFERENCES identity.client_segments(segment_id) ON DELETE SET NULL,
    client_reference TEXT NOT NULL UNIQUE,
    client_status TEXT NOT NULL DEFAULT 'ACTIVE',
    onboarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deactivated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (client_status IN ('PROSPECT', 'ACTIVE', 'SUSPENDED', 'CLOSED')),
    CHECK (client_reference = upper(client_reference))
);

CREATE TABLE identity.roles (
    role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_code TEXT NOT NULL UNIQUE,
    role_name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (role_code = upper(role_code))
);

CREATE TABLE identity.user_roles (
    user_id UUID NOT NULL REFERENCES identity.users(user_id) ON DELETE RESTRICT,
    role_id UUID NOT NULL REFERENCES identity.roles(role_id) ON DELETE RESTRICT,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    granted_by UUID REFERENCES identity.users(user_id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE identity.sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(user_id) ON DELETE RESTRICT,
    session_token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES identity.users(user_id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    CHECK (expires_at > created_at),
    CHECK (session_token_hash <> '')
);

CREATE INDEX idx_clients_user_id ON identity.clients(user_id);
CREATE INDEX idx_clients_segment_id ON identity.clients(segment_id);
CREATE INDEX idx_sessions_user_active ON identity.sessions(user_id, expires_at)
    WHERE revoked_at IS NULL;
CREATE INDEX idx_user_roles_role_id ON identity.user_roles(role_id);

COMMENT ON TABLE identity.users IS 'Login identities. Stores password hashes only, never plain-text passwords.';
COMMENT ON TABLE identity.clients IS 'Financial client profile linked to a login user. Kept separate because one person may have login access without being a trading client.';
COMMENT ON TABLE identity.sessions IS 'Time-limited, revocable login sessions identified by token hashes.';

COMMIT;
