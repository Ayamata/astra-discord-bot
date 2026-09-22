import {
    SlashCommandBuilder,
    PermissionFlagsBits
} from "discord.js";

import {
    successEmbed
} from "../../utils/embeds.js";

export default {
    data: new SlashCommandBuilder()
        .setName("unlock")
        .setDescription("Unlock the current channel.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageChannels
        ),

    async execute(interaction) {
        await interaction.channel.permissionOverwrites.edit(
            interaction.guild.roles.everyone,
            {
                SendMessages: null
            }
        );

        return interaction.reply({
            embeds: [
                successEmbed(
                    "Channel Unlocked",
                    "This channel has been unlocked."
                )
            ]
        });
    }
};