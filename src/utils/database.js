import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDirectory = path.resolve("data");

if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, { recursive: true });
}

const db = new Database(
    path.join(dataDirectory, "bot.sqlite")
);

db.pragma("journal_mode = WAL");

db.exec(`
    CREATE TABLE IF NOT EXISTS warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        claimed_by TEXT,
        created_at INTEGER NOT NULL,
        closed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        description TEXT NOT NULL,
        questions TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE (guild_id, name)
    );

    CREATE TABLE IF NOT EXISTS application_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        application_name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        channel_id TEXT,
        message_id TEXT,
        reviewer_id TEXT,
        reviewed_at INTEGER,
        created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_support_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gmail_message_id TEXT NOT NULL UNIQUE,
        from_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        discord_channel_id TEXT,
        discord_message_id TEXT,
        created_at INTEGER NOT NULL,
        closed_at INTEGER
    );
`);

export function addWarning(
    guildId,
    userId,
    moderatorId,
    reason
) {
    const statement = db.prepare(`
        INSERT INTO warnings
        (
            guild_id,
            user_id,
            moderator_id,
            reason,
            created_at
        )
        VALUES (?, ?, ?, ?, ?)
    `);

    const result = statement.run(
        guildId,
        userId,
        moderatorId,
        reason,
        Date.now()
    );

    return result.lastInsertRowid;
}

export function getWarnings(guildId, userId) {
    return db.prepare(`
        SELECT *
        FROM warnings
        WHERE guild_id = ?
        AND user_id = ?
        ORDER BY created_at DESC
    `).all(guildId, userId);
}

export function removeWarning(id) {
    return db.prepare(`
        DELETE FROM warnings
        WHERE id = ?
    `).run(id);
}

export function addTicket(
    guildId,
    channelId,
    userId
) {
    return db.prepare(`
        INSERT INTO tickets
        (
            guild_id,
            channel_id,
            user_id,
            created_at
        )
        VALUES (?, ?, ?, ?)
    `).run(
        guildId,
        channelId,
        userId,
        Date.now()
    );
}

export function getOpenTickets(guildId, userId) {
    return db.prepare(`
        SELECT *
        FROM tickets
        WHERE guild_id = ?
        AND user_id = ?
        AND closed_at IS NULL
    `).all(guildId, userId);
}

export function getTicket(channelId) {
    return db.prepare(`
        SELECT *
        FROM tickets
        WHERE channel_id = ?
        AND closed_at IS NULL
    `).get(channelId);
}

export function claimTicket(channelId, userId) {
    return db.prepare(`
        UPDATE tickets
        SET claimed_by = ?
        WHERE channel_id = ?
    `).run(userId, channelId);
}

export function closeTicket(channelId) {
    return db.prepare(`
        UPDATE tickets
        SET closed_at = ?
        WHERE channel_id = ?
    `).run(Date.now(), channelId);
}

/*
 * Applications
 *
 * Questions are stored as a JSON array.
 */

function parseApplication(row) {
    if (!row) {
        return null;
    }

    return {
        ...row,
        questions: JSON.parse(row.questions)
    };
}

export function createApplication(
    guildId,
    name,
    displayName,
    description,
    questions,
    createdBy
) {
    return db.prepare(`
        INSERT INTO applications
        (
            guild_id,
            name,
            display_name,
            description,
            questions,
            created_by,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        guildId,
        name,
        displayName,
        description,
        JSON.stringify(questions),
        createdBy,
        Date.now()
    );
}

export function getApplication(guildId, name) {
    return parseApplication(
        db.prepare(`
            SELECT *
            FROM applications
            WHERE guild_id = ?
            AND name = ?
        `).get(guildId, name)
    );
}

export function getApplications(guildId) {
    return db.prepare(`
        SELECT *
        FROM applications
        WHERE guild_id = ?
        ORDER BY name ASC
    `).all(guildId).map(parseApplication);
}

export function deleteApplication(guildId, name) {
    return db.prepare(`
        DELETE FROM applications
        WHERE guild_id = ?
        AND name = ?
    `).run(guildId, name);
}

/*
 * Application submissions
 *
 * The id is the application number reviewers use
 * with >approve and >deny.
 *
 * status: pending | interview | accepted | denied
 */

export function createSubmission(
    guildId,
    applicationName,
    userId
) {
    return db.prepare(`
        INSERT INTO application_submissions
        (
            guild_id,
            application_name,
            user_id,
            created_at
        )
        VALUES (?, ?, ?, ?)
    `).run(
        guildId,
        applicationName,
        userId,
        Date.now()
    ).lastInsertRowid;
}

export function setSubmissionMessage(
    id,
    channelId,
    messageId
) {
    return db.prepare(`
        UPDATE application_submissions
        SET channel_id = ?,
            message_id = ?
        WHERE id = ?
    `).run(channelId, messageId, id);
}

export function getSubmission(id) {
    return db.prepare(`
        SELECT *
        FROM application_submissions
        WHERE id = ?
    `).get(id);
}

export function getSubmissionByMessage(messageId) {
    return db.prepare(`
        SELECT *
        FROM application_submissions
        WHERE message_id = ?
    `).get(messageId);
}

export function updateSubmissionStatus(
    id,
    status,
    reviewerId
) {
    return db.prepare(`
        UPDATE application_submissions
        SET status = ?,
            reviewer_id = ?,
            reviewed_at = ?
        WHERE id = ?
    `).run(status, reviewerId, Date.now(), id);
}

export function deleteSubmission(id) {
    return db.prepare(`
        DELETE FROM application_submissions
        WHERE id = ?
    `).run(id);
}

export function createEmailSupportCase(
    gmailMessageId,
    fromEmail,
    subject,
    body
) {
    return db.prepare(`
        INSERT INTO email_support_cases
        (
            gmail_message_id,
            from_email,
            subject,
            body,
            created_at
        )
        VALUES (?, ?, ?, ?, ?)
    `).run(
        gmailMessageId,
        fromEmail,
        subject,
        body,
        Date.now()
    ).lastInsertRowid;
}

export function getEmailSupportCase(id) {
    return db.prepare(`
        SELECT *
        FROM email_support_cases
        WHERE id = ?
    `).get(id);
}

export function getEmailSupportCaseByMessageId(messageId) {
    return db.prepare(`
        SELECT *
        FROM email_support_cases
        WHERE gmail_message_id = ?
    `).get(messageId);
}

export function setEmailSupportCaseMessage(
    id,
    channelId,
    messageId
) {
    return db.prepare(`
        UPDATE email_support_cases
        SET discord_channel_id = ?,
            discord_message_id = ?
        WHERE id = ?
    `).run(channelId, messageId, id);
}

export function closeEmailSupportCase(id) {
    return db.prepare(`
        UPDATE email_support_cases
        SET status = 'closed',
            closed_at = ?
        WHERE id = ?
        AND status = 'open'
    `).run(Date.now(), id);
}

export function deleteEmailSupportCase(id) {
    return db.prepare(`
        DELETE FROM email_support_cases
        WHERE id = ?
    `).run(id);
}

export default db;