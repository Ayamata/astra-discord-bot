const MARKER = "ASTRA_LAUNCHER_TICKET v1";
const DISCORD_ID = /^\d{17,20}$/;
const ERROR_ID = /^[a-f0-9]{16}$/i;
const MAX_LINE = 120;
const MAX_TITLE = 180;
const MAX_LOG_BYTES = 7 * 1024 * 1024;

export const LAUNCHER_TICKET_MARKER = MARKER;

export function sanitizeTicketName(value) {
    const raw = String(value || "player")
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    const name = `ticket-${raw || "player"}`.slice(0, 80);
    return name.length < 8 ? "ticket-player" : name;
}

export function sanitizeLine(value, max = MAX_LINE) {
    return String(value || "")
        .replace(/[\r\n`]/g, " ")
        .trim()
        .slice(0, max) || "Unknown";
}

export function parseLauncherTicketContent(content) {
    const text = String(content || "").replace(/^\uFEFF/, "").trim();
    if (!text.startsWith(MARKER)) {
        return null;
    }

    const fields = {};
    for (const line of text.split(/\r?\n/).slice(1)) {
        const cut = line.indexOf(":");
        if (cut <= 0) continue;
        const key = line.slice(0, cut).trim().toLowerCase();
        const value = line.slice(cut + 1).trim();
        if (!key || !value) continue;
        fields[key] = value;
    }

    const discordId = String(fields.discord_id || "").trim();
    if (!DISCORD_ID.test(discordId)) {
        return { error: "missing-discord-id" };
    }

    const errorId = String(fields.error_id || "unknown").trim();
    if (errorId !== "unknown" && !ERROR_ID.test(errorId) && !/^unknown$/i.test(errorId)) {
        return { error: "invalid-error-id" };
    }

    const source = String(fields.source || "").trim().toLowerCase() === "upload"
        ? "upload"
        : "support";

    return {
        source,
        discordId,
        discordName: sanitizeLine(fields.discord_name, 80),
        discordUsername: sanitizeLine(fields.discord_username, 80).replace(/^@/, ""),
        player: sanitizeLine(fields.player, 80),
        errorId: errorId === "unknown" ? "unknown" : errorId.toLowerCase(),
        versionLabel: sanitizeLine(fields.version, 40),
        title: sanitizeLine(fields.title, MAX_TITLE)
    };
}

export function buildLauncherTicketContent(ticket) {
    return [
        MARKER,
        `source: ${ticket.source === "upload" ? "upload" : "support"}`,
        `discord_id: ${String(ticket.discordId || "").trim()}`,
        `discord_name: ${sanitizeLine(ticket.discordName, 80)}`,
        `discord_username: ${sanitizeLine(ticket.discordUsername, 80)}`,
        `player: ${sanitizeLine(ticket.player, 80)}`,
        `error_id: ${String(ticket.errorId || "unknown").trim() || "unknown"}`,
        `version: ${sanitizeLine(ticket.versionLabel, 40)}`,
        `title: ${sanitizeLine(ticket.title, MAX_TITLE)}`
    ].join("\n");
}

export function isAllowedLauncherWebhook(message, config) {
    const intakeId = String(config?.tickets?.launcherIntakeChannelId || "").trim();
    const webhookIds = Array.isArray(config?.tickets?.launcherWebhookIds)
        ? config.tickets.launcherWebhookIds
        : [];
    if (!message?.webhookId || !intakeId) return false;
    if (String(message.channelId) !== intakeId) return false;
    if (!webhookIds.length) return Boolean(message.webhookId);
    return webhookIds.includes(String(message.webhookId));
}

export function crashLogTooLarge(bytes) {
    return Number(bytes) > MAX_LOG_BYTES;
}

export { MAX_LOG_BYTES };
