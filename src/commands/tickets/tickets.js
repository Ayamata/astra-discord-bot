import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from "discord.js";

import config from "../../config.js";

export default {
    data: new SlashCommandBuilder()
        .setName("ticket-panel")
        .setDescription(
            "Send the ticket panel."
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        ),

    async execute(interaction) {
        const embed =
            new EmbedBuilder()
                .setColor(
                    config.tickets.ticketColor
                )
                .setTitle("🎫 Support")
                .setDescription(
                    "Need help from the staff team?\n\n" +
                    "Click **Open Ticket** below to create a private support ticket."
                )
                .setFooter({
                    text:
                        "Please do not open unnecessary tickets."
                });

        const row =
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            "ticket_create"
                        )
                        .setLabel(
                            "Open Ticket"
                        )
                        .setEmoji("🎫")
                        .setStyle(
                            ButtonStyle.Primary
                        )
                );

        await interaction.channel.send({
            embeds: [embed],
            components: [row]
        });

        await interaction.reply({
            content:
                "Ticket panel created.",
            ephemeral: true
        });
    }
};