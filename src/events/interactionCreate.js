import {
    Events
} from "discord.js";

import {
    createTicket,
    handleTicketButton
} from "../utils/tickets.js";

export default {
    name: Events.InteractionCreate,

    async execute(interaction, client) {
        try {
            if (
                interaction.isChatInputCommand()
            ) {
                const command =
                    client.commands.get(
                        interaction.commandName
                    );

                if (!command) return;

                await command.execute(
                    interaction
                );

                return;
            }

            if (
                interaction.isButton()
            ) {
                if (
                    interaction.customId ===
                    "ticket_create"
                ) {
                    await createTicket(
                        interaction
                    );

                    return;
                }

                if (
                    interaction.customId ===
                    "ticket_claim" ||
                    interaction.customId ===
                    "ticket_close"
                ) {
                    await handleTicketButton(
                        interaction
                    );
                }
            }
        } catch (error) {
            console.error(
                "Interaction error:",
                error
            );

            const response = {
                content:
                    "Something went wrong while processing that action.",
                ephemeral: true
            };

            if (interaction.replied ||
                interaction.deferred) {
                await interaction.followUp(
                    response
                ).catch(() => {});
            } else {
                await interaction.reply(
                    response
                ).catch(() => {});
            }
        }
    }
};