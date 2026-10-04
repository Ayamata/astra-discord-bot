import {
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
    OverwriteType
} from "discord.js";

import config from "../config.js";

import {
    addTicket,
    getOpenTickets,
    getTicket,
    claimTicket,
    closeTicket,
    countTicketsByKind
} from "./database.js";

import {
    crashLogTooLarge,
    isAllowedLauncherWebhook,
    parseLauncherTicketContent,
    sanitizeLine,
    sanitizeTicketName,
    MAX_LOG_BYTES
} from "./launcherTicketParse.js";

const processedIntake = new Set();
const DISCORD_ID = /^\d{17,20}$/;

function ticketButtons() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("ticket_claim")
                .setLabel("Claim")
                .setEmoji("🙋")
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId("ticket_close")
                .setLabel("Close")
                .setEmoji("🔒")
                .setStyle(ButtonStyle.Secondary)
        );
}

function supportMentions() {
    const roles = DISCORD_ID.test(String(config.tickets.supportRoleId || ""))
        ? [String(config.tickets.supportRoleId)]
        : [];
    const content = roles.map((id) => `<@&${id}>`).join(" ");
    return {
        content: content || null,
        allowedMentions: {
            parse: [],
            users: [],
            roles,
            repliedUser: false
        }
    };
}

async function createTicketChannel(guild, user, kind = "support") {
    const existingChannel = await resolveOpenChannel(guild, user.id);
    const openCount = getOpenTickets(guild.id, user.id).length;

    if (existingChannel) {
        return { existingChannel };
    }

    if (openCount >= config.tickets.maximumOpenTickets) {
        return {
            error: "You already have the maximum number of open tickets."
        };
    }

    const overwrites = [
        {
            id: guild.roles.everyone.id,
            type: OverwriteType.Role,
            deny: [PermissionFlagsBits.ViewChannel]
        },
        ...(config.tickets.supportRoleId
            ? [{
                id: config.tickets.supportRoleId,
                type: OverwriteType.Role,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageMessages
                ]
            }]
            : [])
    ];

    if (user?.id) {
        overwrites.splice(1, 0, {
            id: user.id,
            type: OverwriteType.Member,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
            ]
        });
    }

    for (const staffId of config.tickets.staffUserIds || []) {
        if (!DISCORD_ID.test(String(staffId)) || staffId === user?.id) continue;
        overwrites.push({
            id: staffId,
            type: OverwriteType.Member,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
            ]
        });
    }

    const name = kind === "crashlog"
        ? `ticket-crashlog-${countTicketsByKind(guild.id, "crashlog") + 1}`
        : sanitizeTicketName(user.username);

    const channel = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: config.tickets.categoryId || null,
        permissionOverwrites: overwrites
    });

    addTicket(guild.id, channel.id, user.id, kind);
    return { channel };
}

async function sendWelcome(channel, user, guild) {
    const embed = new EmbedBuilder()
        .setColor(config.tickets.ticketColor)
        .setTitle("🎫 Support Ticket")
        .setDescription(
            `Welcome <@${user.id}>!\n\n` +
            `Please describe your issue and a member of the support team will help you.\n\n` +
            `Use the buttons below to manage this ticket.`
        )
        .setFooter({ text: guild.name })
        .setTimestamp();

    const mentions = supportMentions();

    await channel.send({
        content: mentions.content,
        allowedMentions: mentions.allowedMentions,
        embeds: [embed],
        components: [ticketButtons()]
    });
}

export async function createTicket(interaction) {
    const guild = interaction.guild;
    const user = interaction.user;

    const result = await createTicketChannel(guild, user);

    if (result.error) {
        return interaction.reply({
            content: result.error,
            ephemeral: true
        });
    }

    if (result.existingChannel) {
        return interaction.reply({
            content: `You already have an open ticket: ${result.existingChannel}`,
            ephemeral: true
        });
    }

    await sendWelcome(result.channel, user, guild);

    await interaction.reply({
        content: `Your ticket has been created: ${result.channel}`,
        ephemeral: true
    });
}

export async function handleTicketButton(interaction) {
    if (interaction.customId === "ticket_claim") {
        return claim(interaction);
    }

    if (interaction.customId === "ticket_close") {
        return close(interaction);
    }
}

async function claim(interaction) {
    const ticket = getTicket(interaction.channel.id);

    if (!ticket) {
        return interaction.reply({
            content: "This is not an active ticket.",
            ephemeral: true
        });
    }

    if (
        config.tickets.supportRoleId &&
        !interaction.member.roles.cache.has(config.tickets.supportRoleId)
    ) {
        return interaction.reply({
            content: "Only support staff can claim tickets.",
            ephemeral: true
        });
    }

    claimTicket(interaction.channel.id, interaction.user.id);

    await interaction.reply({
        content: `🙋 This ticket has been claimed by ${interaction.user}.`
    });
}

async function close(interaction) {
    const ticket = getTicket(interaction.channel.id);

    if (!ticket) {
        return interaction.reply({
            content: "This is not an active ticket.",
            ephemeral: true
        });
    }

    const isOwner = ticket.user_id === interaction.user.id;
    const isSupport =
        config.tickets.supportRoleId &&
        interaction.member.roles.cache.has(config.tickets.supportRoleId);

    if (!isOwner && !isSupport) {
        return interaction.reply({
            content: "You cannot close this ticket.",
            ephemeral: true
        });
    }

    await interaction.reply({
        content: "🔒 Saving transcript and closing ticket..."
    });

    try {
        await sendTranscript(interaction.channel, ticket, interaction.user);
    } catch (error) {
        console.error(
            `[TICKETS] Failed to save transcript for #${interaction.channel.name}:`,
            error
        );

        return interaction.followUp({
            content:
                "The transcript could not be saved, so this ticket was left open. " +
                "Check that the bot can send files in the transcript channel, then try again."
        }).catch(() => {});
    }

    closeTicket(interaction.channel.id);

    setTimeout(async () => {
        await interaction.channel.delete().catch(() => {});
    }, 3000);
}

const MAX_TRANSCRIPT_MESSAGES = 5000;

async function fetchAllMessages(channel) {
    const messages = [];
    let before;

    while (messages.length < MAX_TRANSCRIPT_MESSAGES) {
        const batch = await channel.messages.fetch({ limit: 100, before });
        if (!batch.size) break;
        messages.push(...batch.values());
        before = batch.last().id;
        if (batch.size < 100) break;
    }

    return messages.reverse();
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function renderMessage(message) {
    const author = message.member?.displayName || message.author.username;
    const time = message.createdAt.toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC";
    const parts = [];

    if (message.content) {
        parts.push(`<div class="content">${escapeHtml(message.cleanContent)}</div>`);
    }

    for (const embed of message.embeds) {
        const fields = embed.fields
            .map((field) => `<div><b>${escapeHtml(field.name)}</b><br>${escapeHtml(field.value)}</div>`)
            .join("");
        parts.push(
            `<div class="embed">` +
            (embed.title ? `<div class="embed-title">${escapeHtml(embed.title)}</div>` : "") +
            (embed.description ? `<div class="content">${escapeHtml(embed.description)}</div>` : "") +
            fields +
            `</div>`
        );
    }

    for (const attachment of message.attachments.values()) {
        parts.push(
            `<div class="attachment">📎 <a href="${escapeHtml(attachment.url)}">${escapeHtml(attachment.name)}</a></div>`
        );
    }

    return (
        `<div class="msg">` +
        `<img class="avatar" src="${escapeHtml(message.author.displayAvatarURL({ size: 64 }))}" alt="">` +
        `<div><div class="meta"><span class="author">${escapeHtml(author)}</span>` +
        (message.author.bot ? ` <span class="bot">BOT</span>` : "") +
        ` <span class="time">${escapeHtml(time)}</span></div>` +
        (parts.join("") || `<div class="content muted">(no content)</div>`) +
        `</div></div>`
    );
}

function buildTranscriptHtml(channel, messages) {
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Transcript - ${escapeHtml(channel.name)}</title>
<style>
body{margin:0;padding:24px;background:#313338;color:#dbdee1;font-family:"gg sans","Segoe UI",Helvetica,Arial,sans-serif;font-size:15px}
h1{font-size:18px;margin:0 0 4px;color:#f2f3f5}
.sub{color:#949ba4;font-size:13px;margin-bottom:20px}
.msg{display:flex;gap:14px;padding:8px 0}
.avatar{width:40px;height:40px;border-radius:50%;flex:none}
.author{font-weight:600;color:#f2f3f5}
.bot{background:#5865F2;color:#fff;font-size:10px;padding:1px 4px;border-radius:3px}
.time{color:#949ba4;font-size:12px}
.content{white-space:pre-wrap;word-break:break-word}
.muted{color:#949ba4}
.embed{border-left:4px solid #5865F2;background:#2b2d31;padding:8px 12px;margin-top:4px;border-radius:4px;max-width:520px}
.embed-title{font-weight:600;margin-bottom:4px}
a{color:#00a8fc}
</style></head><body>
<h1>#${escapeHtml(channel.name)}</h1>
<div class="sub">${escapeHtml(channel.guild.name)} · ${messages.length} messages</div>
${messages.map(renderMessage).join("\n")}
</body></html>`;
}

async function sendTranscript(channel, ticket, closedBy) {
    const transcriptChannelId =
        config.tickets.transcriptChannelId ||
        config.tickets.logChannelId;

    if (!transcriptChannelId) {
        console.warn("[TICKETS] No transcript or log channel configured; closing without a transcript.");
        return;
    }

    const transcriptChannel = await channel.client.channels.fetch(transcriptChannelId);

    if (!transcriptChannel?.isTextBased() || typeof transcriptChannel.send !== "function") {
        throw new Error(`Transcript channel ${transcriptChannelId} is missing or cannot receive messages.`);
    }

    const messages = await fetchAllMessages(channel);
    const file = new AttachmentBuilder(
        Buffer.from(buildTranscriptHtml(channel, messages), "utf8"),
        { name: `transcript-${channel.name}.html` }
    );

    const embed = new EmbedBuilder()
        .setColor(config.tickets.ticketColor)
        .setTitle("📄 Ticket Transcript")
        .addFields(
            { name: "Ticket", value: `#${channel.name}`, inline: true },
            { name: "Opened by", value: `<@${ticket.user_id}>`, inline: true },
            { name: "Closed by", value: `${closedBy}`, inline: true },
            { name: "Claimed by", value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : "Unclaimed", inline: true },
            { name: "Messages", value: String(messages.length), inline: true }
        )
        .setTimestamp();

    await transcriptChannel.send({
        embeds: [embed],
        files: [file],
        allowedMentions: { parse: [] }
    });
}

/**
 * Webhook messages in the admin console:
 * - upload / unmarked crash logs stay there. No ticket, no ping, no delete.
 * - source: support is ignored here. Contact Support uses the bot API, not the webhook.
 */
export async function handleLauncherTicketMessage(message) {
    if (!config.tickets.enabled) return false;
    if (!isAllowedLauncherWebhook(message, config)) return false;

    if (processedIntake.has(message.id)) return true;
    processedIntake.add(message.id);
    if (processedIntake.size > 400) {
        const first = processedIntake.values().next().value;
        processedIntake.delete(first);
    }

    const parsed = parseLauncherTicketContent(message.content);
    if (!parsed || parsed.error || parsed.source !== "support") {
        console.log("[TICKETS] Left admin-console webhook message in place (Upload).");
        return true;
    }

    const logFile = await readCrashAttachment(message);
    const guild = message.guild;
    if (!guild) return true;
    const result = await openCrashSupportTicket(guild, parsed, logFile);
    if (!result.ok) {
        console.error(`[TICKETS] Webhook Contact Support failed: ${result.error}`);
        return true;
    }
    await message.delete().catch(() => {});
    return true;
}

async function readCrashAttachment(message) {
    const attachment =
        message.attachments.find((item) => /crashlog/i.test(item.name || "")) ||
        message.attachments.first();
    if (!attachment) return null;
    if (crashLogTooLarge(attachment.size)) return null;

    try {
        const response = await fetch(attachment.url);
        if (!response.ok) return null;
        const bytes = Buffer.from(await response.arrayBuffer());
        if (crashLogTooLarge(bytes.length)) return null;
        return new AttachmentBuilder(bytes, {
            name: "crashlog.txt",
            description: "Astra launcher crash log"
        });
    } catch (error) {
        console.error("[TICKETS] Could not download launcher crash log:", error);
        return null;
    }
}

export async function handleLauncherSupportApi(client, body) {
    if (!config.tickets.enabled) {
        return { ok: false, status: 503, error: "Tickets are disabled." };
    }

    const parsed = parseSupportApiBody(body);
    if (parsed.error) {
        return { ok: false, status: 400, error: parsed.error };
    }

    const guildId = String(process.env.GUILD_ID || "").trim();
    if (!DISCORD_ID.test(guildId)) {
        return { ok: false, status: 503, error: "Set GUILD_ID in the Discord bot .env." };
    }

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
        return { ok: false, status: 503, error: "The Discord bot is not in that server." };
    }

    const result = await openCrashSupportTicket(guild, parsed, crashLogFile(parsed.crashLog));
    if (!result.ok) {
        return { ok: false, status: 502, error: result.error };
    }

    return { ok: true, channelId: result.channelId };
}

async function openCrashSupportTicket(guild, parsed, logFile) {
    let member = guild.members.cache.get(parsed.discordId) || null;
    if (!member) {
        member = await guild.members.fetch(parsed.discordId).catch(() => null);
    }

    const user = member?.user || {
        id: parsed.discordId,
        username: parsed.discordUsername || parsed.player || "player"
    };

    let channel = await resolveOpenChannel(guild, parsed.discordId);
    let created = false;

    if (!channel) {
        try {
            const result = await createTicketChannel(guild, user, "crashlog");
            if (result.error) {
                return { ok: false, error: result.error };
            }
            channel = result.channel || result.existingChannel;
            created = Boolean(result.channel);
        } catch (error) {
            console.error("[TICKETS] Failed to create launcher ticket channel:", error);
            return { ok: false, error: "Could not create a support ticket." };
        }
    }

    if (!channel) {
        return { ok: false, error: "Could not create a support ticket." };
    }

    const mentions = supportMentions();
    const pingLine = [
        mentions.content,
        "New support ticket from Astra launcher."
    ].filter(Boolean).join("\n");

    try {
        await channel.send({
            content: pingLine,
            allowedMentions: mentions.allowedMentions
        });
    } catch (error) {
        console.error("[TICKETS] Failed to ping staff/ticket creator:", error);
        return { ok: false, error: "Could not ping staff in the support ticket." };
    }

    const embed = new EmbedBuilder()
        .setColor(config.tickets.ticketColor)
        .setTitle("Crash report from Astra launcher")
        .setDescription(
            member
                ? `A crash ticket was opened for <@${parsed.discordId}>.`
                : `A crash ticket was opened for <@${parsed.discordId}>. They may still need to join ${config.tickets.inviteUrl || "the Astra Discord"}.`
        )
        .addFields(
            { name: "Player", value: parsed.player, inline: true },
            { name: "Discord", value: `${parsed.discordName} (@${parsed.discordUsername})`, inline: true },
            { name: "Error ID", value: `\`${parsed.errorId}\``, inline: true },
            { name: "Version", value: parsed.versionLabel, inline: true },
            { name: "Title", value: parsed.title, inline: false }
        )
        .setFooter({ text: created ? "New ticket" : "Added to an existing ticket" })
        .setTimestamp();

    const payload = {
        content: mentions.content,
        allowedMentions: mentions.allowedMentions,
        embeds: [embed]
    };

    if (created) {
        payload.components = [ticketButtons()];
    }

    if (logFile) {
        payload.files = [logFile];
    }

    try {
        await channel.send(payload);
        console.log(
            `[TICKETS] Launcher ticket ${created ? "created" : "updated"} for ${parsed.discordId} in #${channel.name}`
        );
    } catch (error) {
        console.error("[TICKETS] Failed to post launcher crash log:", error);
        return { ok: false, error: "Could not post the crash log in the support ticket." };
    }

    return { ok: true, channelId: channel.id };
}

function parseSupportApiBody(body) {
    const discordId = String(body?.discordId || "").trim();
    if (!DISCORD_ID.test(discordId)) {
        return { error: "Sign in with Discord to contact support." };
    }

    const crashLog = String(body?.crashLog || "No crash log was captured for this session.\n");
    if (crashLogTooLarge(Buffer.byteLength(crashLog, "utf8"))) {
        return { error: "That crash log is too large to send." };
    }

    return {
        source: "support",
        discordId,
        discordName: sanitizeLine(body?.discordName, 80),
        discordUsername: sanitizeLine(body?.discordUsername, 80).replace(/^@/, ""),
        player: sanitizeLine(body?.player, 80),
        errorId: sanitizeLine(body?.errorId || "unknown", 80),
        versionLabel: sanitizeLine(body?.versionLabel || "Astra", 40),
        title: sanitizeLine(body?.title || "Unexpected Error", 180),
        crashLog
    };
}

function crashLogFile(crashLog) {
    const text = String(crashLog || "");
    if (!text.trim()) return null;
    const bytes = Buffer.from(text, "utf8");
    if (crashLogTooLarge(bytes.length) || bytes.length > MAX_LOG_BYTES) return null;
    return new AttachmentBuilder(bytes, {
        name: "crashlog.txt",
        description: "Astra launcher crash log"
    });
}

async function resolveOpenChannel(guild, userId) {
    const open = getOpenTickets(guild.id, userId);
    for (const ticket of open) {
        const cached = guild.channels.cache.get(ticket.channel_id);
        if (cached) return cached;
        const fetched = await guild.channels.fetch(ticket.channel_id).catch(() => null);
        if (fetched) return fetched;
    }
    return null;
}
