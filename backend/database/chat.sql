-- =========================================
-- DATABASE
-- =========================================
CREATE DATABASE IF NOT EXISTS chatBot
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE chatBot;

-- =========================================
-- USERS
-- =========================================
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =========================================
-- ROLES
-- =========================================
CREATE TABLE roles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(255)
) ENGINE=InnoDB;

-- =========================================
-- USER ↔ ROLE (MANY-TO-MANY)
-- =========================================
CREATE TABLE user_role (
    user_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,

    PRIMARY KEY (user_id, role_id),

    CONSTRAINT fk_user_role_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_role_role
        FOREIGN KEY (role_id) REFERENCES roles(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================================
-- CHATS
-- =========================================
CREATE TABLE chats (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    topic VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_chats_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================================
-- CHAT LOGS (MESSAGES)
-- =========================================
CREATE TABLE chat_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    chat_id BIGINT UNSIGNED NOT NULL,
    role ENUM('system','user','assistant') NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_chat_logs_chat
        FOREIGN KEY (chat_id) REFERENCES chats(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================================
-- INDEXES
-- =========================================
CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_chat_logs_chat_id ON chat_logs(chat_id);
CREATE INDEX idx_chat_logs_created_at ON chat_logs(created_at);
CREATE INDEX idx_user_role_user_id ON user_role(user_id);
CREATE INDEX idx_user_role_role_id ON user_role(role_id);

-- =========================================
-- DEFAULT ROLES
-- =========================================
INSERT INTO roles (name, description) VALUES
('admin', 'System administrator'),
('user', 'Regular user');

-- =========================================
-- DONE
-- =========================================
