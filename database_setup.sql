USE alumni_influencers;

-- =========================================================
-- TABLES
-- =========================================================

-- USERS
CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- EMAIL VERIFICATION TOKENS
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_email_verification_tokens_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- PASSWORD RESET TOKENS
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_password_reset_tokens_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- AUTH AUDIT LOG
CREATE TABLE IF NOT EXISTS auth_audit_logs (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NULL,
    email_attempted VARCHAR(255) NULL,
    action VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_auth_audit_logs_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ALUMNI PROFILES
CREATE TABLE IF NOT EXISTS alumni_profiles (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL UNIQUE,
    biography TEXT NULL,
    linkedin_url VARCHAR(2048) NULL,
    profile_image_path VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_alumni_profiles_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- PROFILE DEGREES
CREATE TABLE IF NOT EXISTS profile_degrees (
    id CHAR(36) PRIMARY KEY,
    profile_id CHAR(36) NOT NULL,
    degree_name VARCHAR(255) NOT NULL,
    institution_name VARCHAR(255) NULL,
    degree_url VARCHAR(2048) NULL,
    completion_date DATE NULL,
    CONSTRAINT fk_profile_degrees_profile
        FOREIGN KEY (profile_id) REFERENCES alumni_profiles(id) ON DELETE CASCADE
);

-- PROFILE CERTIFICATIONS
CREATE TABLE IF NOT EXISTS profile_certifications (
    id CHAR(36) PRIMARY KEY,
    profile_id CHAR(36) NOT NULL,
    certification_name VARCHAR(255) NOT NULL,
    provider_name VARCHAR(255) NULL,
    course_url VARCHAR(2048) NULL,
    completion_date DATE NULL,
    CONSTRAINT fk_profile_certifications_profile
        FOREIGN KEY (profile_id) REFERENCES alumni_profiles(id) ON DELETE CASCADE
);

-- PROFILE LICENCES
CREATE TABLE IF NOT EXISTS profile_licences (
    id CHAR(36) PRIMARY KEY,
    profile_id CHAR(36) NOT NULL,
    licence_name VARCHAR(255) NOT NULL,
    awarding_body_name VARCHAR(255) NULL,
    awarding_body_url VARCHAR(2048) NULL,
    completion_date DATE NULL,
    CONSTRAINT fk_profile_licences_profile
        FOREIGN KEY (profile_id) REFERENCES alumni_profiles(id) ON DELETE CASCADE
);

-- PROFILE SHORT COURSES
CREATE TABLE IF NOT EXISTS profile_short_courses (
    id CHAR(36) PRIMARY KEY,
    profile_id CHAR(36) NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    provider_name VARCHAR(255) NULL,
    course_url VARCHAR(2048) NULL,
    completion_date DATE NULL,
    CONSTRAINT fk_profile_short_courses_profile
        FOREIGN KEY (profile_id) REFERENCES alumni_profiles(id) ON DELETE CASCADE
);

-- EMPLOYMENT HISTORY
CREATE TABLE IF NOT EXISTS employment_history (
    id CHAR(36) PRIMARY KEY,
    profile_id CHAR(36) NOT NULL,
    employer_name VARCHAR(255) NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    is_current_role BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT NULL,
    CONSTRAINT fk_employment_history_profile
        FOREIGN KEY (profile_id) REFERENCES alumni_profiles(id) ON DELETE CASCADE
);

-- ALUMNI EVENTS
CREATE TABLE IF NOT EXISTS alumni_events (
    id CHAR(36) PRIMARY KEY,
    event_name VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    location VARCHAR(255) NULL
);

-- ALUMNI EVENT ATTENDANCE
CREATE TABLE IF NOT EXISTS alumni_event_attendance (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    event_id CHAR(36) NOT NULL,
    attended BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_alumni_event_attendance_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_alumni_event_attendance_event
        FOREIGN KEY (event_id) REFERENCES alumni_events(id) ON DELETE CASCADE
);

-- BIDDING CYCLES
CREATE TABLE IF NOT EXISTS bidding_cycles (
    id CHAR(36) PRIMARY KEY,
    cycle_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bidding_cycles_cycle_date (cycle_date)
);

-- BIDS
CREATE TABLE IF NOT EXISTS bids (
    id CHAR(36) PRIMARY KEY,
    cycle_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    current_bid_amount DECIMAL(10,2) NOT NULL,
    bid_status VARCHAR(50) NOT NULL DEFAULT 'losing',
    is_winner BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_bids_cycle
        FOREIGN KEY (cycle_id) REFERENCES bidding_cycles(id) ON DELETE CASCADE,
    CONSTRAINT fk_bids_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- BID REVISIONS
CREATE TABLE IF NOT EXISTS bid_revisions (
    id CHAR(36) PRIMARY KEY,
    bid_id CHAR(36) NOT NULL,
    revision_number INT NOT NULL,
    bid_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bid_revisions_bid
        FOREIGN KEY (bid_id) REFERENCES bids(id) ON DELETE CASCADE
);

-- FEATURED ALUMNI
CREATE TABLE IF NOT EXISTS featured_alumni (
    id CHAR(36) PRIMARY KEY,
    cycle_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    bid_id CHAR(36) NOT NULL,
    featured_date DATE NOT NULL,
    winning_bid_amount DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_featured_alumni_cycle
        FOREIGN KEY (cycle_id) REFERENCES bidding_cycles(id) ON DELETE CASCADE,
    CONSTRAINT fk_featured_alumni_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_featured_alumni_bid
        FOREIGN KEY (bid_id) REFERENCES bids(id) ON DELETE CASCADE,
    UNIQUE KEY uq_featured_alumni_featured_date (featured_date)
);

-- API TOKENS
CREATE TABLE IF NOT EXISTS api_tokens (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    token_name VARCHAR(255) NOT NULL,
    -- Comma-separated list of scopes e.g. 'read:alumni,read:analytics'
    permissions VARCHAR(500) NOT NULL DEFAULT 'read:alumni_of_day',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_api_tokens_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- API REQUEST LOGS
CREATE TABLE IF NOT EXISTS api_request_logs (
    id CHAR(36) PRIMARY KEY,
    api_token_id CHAR(36) NULL,
    user_id CHAR(36) NULL,
    http_method VARCHAR(10) NOT NULL,
    endpoint_accessed VARCHAR(255) NOT NULL,
    response_status_code INT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_api_request_logs_token
        FOREIGN KEY (api_token_id) REFERENCES api_tokens(id) ON DELETE SET NULL,
    CONSTRAINT fk_api_request_logs_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_verified ON users(is_verified);

CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);

CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

CREATE INDEX idx_auth_audit_logs_user_id ON auth_audit_logs(user_id);
CREATE INDEX idx_auth_audit_logs_action ON auth_audit_logs(action);
CREATE INDEX idx_auth_audit_logs_created_at ON auth_audit_logs(created_at);

CREATE INDEX idx_alumni_profiles_user_id ON alumni_profiles(user_id);

CREATE INDEX idx_profile_degrees_profile_id ON profile_degrees(profile_id);
CREATE INDEX idx_profile_certifications_profile_id ON profile_certifications(profile_id);
CREATE INDEX idx_profile_licences_profile_id ON profile_licences(profile_id);
CREATE INDEX idx_profile_short_courses_profile_id ON profile_short_courses(profile_id);
CREATE INDEX idx_employment_history_profile_id ON employment_history(profile_id);

CREATE INDEX idx_alumni_event_attendance_user_id ON alumni_event_attendance(user_id);
CREATE INDEX idx_alumni_event_attendance_event_id ON alumni_event_attendance(event_id);

CREATE INDEX idx_bids_cycle_id ON bids(cycle_id);
CREATE INDEX idx_bids_user_id ON bids(user_id);
CREATE INDEX idx_bids_bid_status ON bids(bid_status);

CREATE INDEX idx_bid_revisions_bid_id ON bid_revisions(bid_id);
CREATE INDEX idx_bid_revisions_revision_number ON bid_revisions(revision_number);

CREATE INDEX idx_featured_alumni_user_id ON featured_alumni(user_id);
CREATE INDEX idx_featured_alumni_cycle_id ON featured_alumni(cycle_id);

CREATE INDEX idx_api_tokens_user_id ON api_tokens(user_id);
CREATE INDEX idx_api_tokens_is_active ON api_tokens(is_active);
CREATE INDEX idx_api_tokens_expires_at ON api_tokens(expires_at);

CREATE INDEX idx_api_request_logs_api_token_id ON api_request_logs(api_token_id);
CREATE INDEX idx_api_request_logs_user_id ON api_request_logs(user_id);
CREATE INDEX idx_api_request_logs_endpoint_accessed ON api_request_logs(endpoint_accessed);
CREATE INDEX idx_api_request_logs_created_at ON api_request_logs(created_at);

-- =========================================================
-- MIGRATION: Run this if the database was created before
-- permissions scoping was added (adds the column to existing tables)
-- =========================================================
-- ALTER TABLE api_tokens ADD COLUMN permissions VARCHAR(500) NOT NULL DEFAULT 'read:alumni_of_day';