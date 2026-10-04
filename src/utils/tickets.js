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

    closeTicket(interaction.channel.id);

    await interaction.reply({
        content: "🔒 Closing ticket..."
    });

    setTimeout(async () => {
        await interaction.channel.delete().catch(() => {});
    }, 3000);
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
