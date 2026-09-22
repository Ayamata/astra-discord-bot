import {
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from "discord.js";

import config from "../config.js";

import {
    addTicket,
    getOpenTickets,
    getTicket,
    claimTicket,
    closeTicket
} from "./database.js";

export async function createTicket(
    interaction
) {
    const guild =
        interaction.guild;

    const user =
        interaction.user;

    const existing =
        getOpenTickets(
            guild.id,
            user.id
        );

    if (
        existing.length >=
        config.tickets.maximumOpenTickets
    ) {
        return interaction.reply({
            content:
                "You already have the maximum number of open tickets.",
            ephemeral: true
        });
    }

    const existingChannel =
        existing
            .map(ticket =>
                guild.channels.cache.get(
                    ticket.channel_id
                )
            )
            .find(Boolean);

    if (existingChannel) {
        return interaction.reply({
            content:
                `You already have an open ticket: ${existingChannel}`,
            ephemeral: true
        });
    }

    const channel =
        await guild.channels.create({
            name:
                `ticket-${user.username}`
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "")
                    .slice(0, 80),

            type: ChannelType.GuildText,

            parent:
                config.tickets.categoryId || null,

            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: [
                        PermissionFlagsBits.ViewChannel
                    ]
                },

                {
                    id: user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory
                    ]
                },

                ...(config.tickets.supportRoleId
                    ? [{
                        id:
                            config.tickets.supportRoleId,

                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.ManageMessages
                        ]
                    }]
                    : [])
            ]
        });

    addTicket(
        guild.id,
        channel.id,
        user.id
    );

    const embed =
        new EmbedBuilder()
            .setColor(config.tickets.ticketColor)
            .setTitle("🎫 Support Ticket")
            .setDescription(
                `Welcome <@${user.id}>!\n\n` +
                `Please describe your issue and a member of the support team will help you.\n\n` +
                `Use the buttons below to manage this ticket.`
            )
            .setFooter({
                text: guild.name
            })
            .setTimestamp();

    const buttons =
        new ActionRowBuilder()
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

    await channel.send({
        content:
            config.tickets.supportRoleId
                ? `<@&${config.tickets.supportRoleId}>`
                : null,

        embeds: [embed],

        components: [buttons]
    });

    await interaction.reply({
        content:
            `Your ticket has been created: ${channel}`,
        ephemeral: true
    });
}

export async function handleTicketButton(
    interaction
) {
    if (
        interaction.customId ===
        "ticket_claim"
    ) {
        return claim(interaction);
    }

    if (
        interaction.customId ===
        "ticket_close"
    ) {
        return close(interaction);
    }
}

async function claim(interaction) {
    const ticket =
        getTicket(
            interaction.channel.id
        );

    if (!ticket) {
        return interaction.reply({
            content:
                "This is not an active ticket.",
            ephemeral: true
        });
    }

    if (
        config.tickets.supportRoleId &&
        !interaction.member.roles.cache.has(
            config.tickets.supportRoleId
        )
    ) {
        return interaction.reply({
            content:
                "Only support staff can claim tickets.",
            ephemeral: true
        });
    }

    claimTicket(
        interaction.channel.id,
        interaction.user.id
    );

    await interaction.reply({
        content:
            `🙋 This ticket has been claimed by ${interaction.user}.`
    });
}

async function close(interaction) {
    const ticket =
        getTicket(
            interaction.channel.id
        );

    if (!ticket) {
        return interaction.reply({
            content:
                "This is not an active ticket.",
            ephemeral: true
        });
    }

    const isOwner =
        ticket.user_id ===
        interaction.user.id;

    const isSupport =
        config.tickets.supportRoleId &&
        interaction.member.roles.cache.has(
            config.tickets.supportRoleId
        );

    if (
        !isOwner &&
        !isSupport
    ) {
        return interaction.reply({
            content:
                "You cannot close this ticket.",
            ephemeral: true
        });
    }

    closeTicket(
        interaction.channel.id
    );

    await interaction.reply({
        content:
            "🔒 Closing ticket..."
    });

    setTimeout(async () => {
        await interaction.channel.delete()
            .catch(() => {});
    }, 3000);
}