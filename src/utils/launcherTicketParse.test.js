import assert from "node:assert/strict";
import test from "node:test";

import {
    LAUNCHER_TICKET_MARKER,
    buildLauncherTicketContent,
    crashLogTooLarge,
    isAllowedLauncherWebhook,
    parseLauncherTicketContent,
    sanitizeTicketName,
    MAX_LOG_BYTES
} from "./launcherTicketParse.js";

test("builds and parses a launcher ticket payload", () => {
    const content = buildLauncherTicketContent({
        discordId: "797752390680838174",
        discordName: "Elk",
        discordUsername: "elk3ufps",
        player: "Elk3ufps",
        errorId: "abcdef0123456789",
        versionLabel: "1.21.11",
        title: "Mixin crash: EntityRenderer"
    });

    assert.equal(content.startsWith(LAUNCHER_TICKET_MARKER), true);

    const parsed = parseLauncherTicketContent(content);
    assert.equal(parsed.error, undefined);
    assert.equal(parsed.discordId, "797752390680838174");
    assert.equal(parsed.player, "Elk3ufps");
    assert.equal(parsed.errorId, "abcdef0123456789");
    assert.equal(parsed.versionLabel, "1.21.11");
    assert.equal(parsed.title, "Mixin crash: EntityRenderer");
});

test("rejects missing or invalid discord ids", () => {
    assert.equal(parseLauncherTicketContent("hello"), null);
    assert.equal(
        parseLauncherTicketContent(`${LAUNCHER_TICKET_MARKER}\nplayer: Steve`).error,
        "missing-discord-id"
    );
    assert.equal(
        parseLauncherTicketContent(`${LAUNCHER_TICKET_MARKER}\ndiscord_id: 12`).error,
        "missing-discord-id"
    );
});

test("sanitizes ticket channel names", () => {
    assert.equal(sanitizeTicketName("Elk3ufps"), "ticket-elk3ufps");
    assert.equal(sanitizeTicketName("Bad Name!!!"), "ticket-badname");
    assert.equal(sanitizeTicketName(""), "ticket-player");
});

test("only accepts the configured launcher webhook in the intake channel", () => {
    const config = {
        tickets: {
            launcherIntakeChannelId: "1551953644826665051",
            launcherWebhookIds: ["1551915966416429066"]
        }
    };

    assert.equal(
        isAllowedLauncherWebhook(
            { webhookId: "1551915966416429066", channelId: "1551953644826665051" },
            config
        ),
        true
    );
    assert.equal(
        isAllowedLauncherWebhook(
            { webhookId: "1551915966416429066", channelId: "1" },
            config
        ),
        false
    );
    assert.equal(
        isAllowedLauncherWebhook(
            { webhookId: "999", channelId: "1551953644826665051" },
            config
        ),
        false
    );
    assert.equal(
        isAllowedLauncherWebhook(
            { webhookId: null, channelId: "1551953644826665051" },
            config
        ),
        false
    );
});

test("accepts unknown error ids from Contact Support without a crash log", () => {
    const parsed = parseLauncherTicketContent(
        `${LAUNCHER_TICKET_MARKER}\ndiscord_id: 797752390680838174\nerror_id: unknown\nplayer: Guest`
    );
    assert.equal(parsed.error, undefined);
    assert.equal(parsed.errorId, "unknown");
});

test("reads the launcher source, defaulting to upload", () => {
    const base = `${LAUNCHER_TICKET_MARKER}\ndiscord_id: 797752390680838174`;
    assert.equal(parseLauncherTicketContent(`${base}\nsource: upload`).source, "upload");
    assert.equal(parseLauncherTicketContent(`${base}\nsource: Upload`).source, "upload");
    assert.equal(parseLauncherTicketContent(`${base}\nsource: support`).source, "support");
    assert.equal(parseLauncherTicketContent(base).source, "upload");

    const built = buildLauncherTicketContent({ source: "upload", discordId: "797752390680838174" });
    assert.equal(parseLauncherTicketContent(built).source, "upload");
    const support = buildLauncherTicketContent({ source: "support", discordId: "797752390680838174" });
    assert.equal(parseLauncherTicketContent(support).source, "support");
});
