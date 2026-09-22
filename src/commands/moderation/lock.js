import {
    SlashCommandBuilder,
    PermissionFlagsBits
} from "discord.js";

import {
    successEmbed
} from "../../utils/embeds.js";

export default {
    data: new SlashCommandBuilder()
        .setName("lock")
        .setDescription("Lock the current channel.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageChannels
        ),

    async execute(interaction) {
        await interaction.channel.permissionOverwrites.edit(
            interaction.guild.roles.everyone,
            {
                SendMessages: false
            }
        );

        return interaction.reply({
            embeds: [
                successEmbed(
                    "Channel Locked",
                    "This channel has been locked."
                )
            ]
        });
    }
};