CREATE TABLE IF NOT EXISTS part_b_story_ratings (
    participant_id BIGINT NOT NULL,
    phase ENUM('practice', 'formal') NOT NULL,
    story_id INT NOT NULL,
    engaging TINYINT UNSIGNED NOT NULL,
    easy TINYINT UNSIGNED NOT NULL,
    informative TINYINT UNSIGNED NOT NULL,
    learned TINYINT UNSIGNED NOT NULL,
    continue_reading TINYINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (participant_id, phase, story_id),
    FOREIGN KEY (participant_id) REFERENCES participants(participant_id)
);
