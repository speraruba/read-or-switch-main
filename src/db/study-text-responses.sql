CREATE TABLE IF NOT EXISTS study_text_responses (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    submission_id CHAR(36) NOT NULL UNIQUE,
    participant_id BIGINT NOT NULL,
    part ENUM('a', 'b', 'c') NOT NULL,
    phase ENUM('practice', 'formal') NOT NULL,
    task ENUM('recall', 'summary') NOT NULL,
    input_method ENUM('speech', 'typed') NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX study_response_lookup (participant_id, part, phase, task),
    FOREIGN KEY (participant_id) REFERENCES participants(participant_id)
);
