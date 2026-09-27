import {
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder
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
    sanitizeTicketName
} from "./launcherTicketParse.js";

const processedIntake = new Set();

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

function supportMentions(userId, extraUserIds = []) {
    const users = [...new Set(
        [userId, ...extraUserIds, ...(config.tickets.staffUserIds || [])]
            .filter((id) => /^\d{17,20}$/.test(String(id || "")))
            .map(String)
    )];
    const roles = /^\d{17,20}$/.test(String(config.tickets.supportRoleId || ""))
        ? [String(config.tickets.supportRoleId)]
        : [];
    const content = [
        ...roles.map((id) => `<@&${id}>`),
        ...users.map((id) => `<@${id}>`)
    ].join(" ");
    return {
        content: content || null,
        allowedMentions: { parse: [], users, roles }
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
            deny: [PermissionFlagsBits.ViewChannel]
        },
        ...(config.tickets.supportRoleId
            ? [{
                id: config.tickets.supportRoleId,
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

    const mentions = supportMentions(user.id);

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
    if (!parsed) return false;
    if (parsed.error) {
        console.error(`[TICKETS] Ignored launcher ticket: ${parsed.error}`);
        return true;
    }

    const guild = message.guild;
    if (!guild) return true;

    // "Upload" is handled by the API; only "Contact Support" opens a ticket.
    if (parsed.source === "upload") return true;

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
                console.error(`[TICKETS] Could not open launcher ticket: ${result.error}`);
                return true;
            }
            channel = result.channel || result.existingChannel;
            created = Boolean(result.channel);
        } catch (error) {
            console.error("[TICKETS] Failed to create launcher ticket channel:", error);
            return true;
        }
    }

    if (!channel) return true;

    const logFile = await readCrashAttachment(message);
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
        allowedMentions: { parse: [], users: [], roles: [] },
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
        await message.delete().catch(() => {});
        console.log(
            `[TICKETS] Launcher ticket ${created ? "created" : "updated"} for ${parsed.discordId} in #${channel.name}`
        );
    } catch (error) {
        console.error("[TICKETS] Failed to post launcher crash log:", error);
    }

    return true;
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

