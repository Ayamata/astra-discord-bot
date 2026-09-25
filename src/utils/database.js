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

export default db;