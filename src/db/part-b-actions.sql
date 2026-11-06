CREATE TABLE IF NOT EXISTS part_b_practice_actions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id CHAR(36) NULL,
    participant_id BIGINT NOT NULL,
    story_id INT NOT NULL,
    segment_id INT NOT NULL,
    action_type ENUM('continue', 'switch', 'start_story', 'timeout', 'test_skip') NOT NULL,
    reading_time_ms INT UNSIGNED NOT NULL,
    timestamp TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY participant_event (participant_id, event_id),
    FOREIGN KEY (participant_id) REFERENCES participants(participant_id),
    FOREIGN KEY (story_id) REFERENCES part_b_practice_stories(id),
    FOREIGN KEY (segment_id) REFERENCES part_b_practice_segments(id)
);

CREATE TABLE IF NOT EXISTS part_b_formal_actions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id CHAR(36) NULL,
    participant_id BIGINT NOT NULL,
    story_id INT NOT NULL,
    segment_id INT NOT NULL,
    action_type ENUM('continue', 'switch', 'start_story', 'timeout', 'test_skip') NOT NULL,
    reading_time_ms INT UNSIGNED NOT NULL,
    timestamp TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY participant_event (participant_id, event_id),
    FOREIGN KEY (participant_id) REFERENCES participants(participant_id),
    FOREIGN KEY (story_id) REFERENCES part_b_formal_stories(id),
    FOREIGN KEY (segment_id) REFERENCES part_b_formal_segments(id)
);

