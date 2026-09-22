import {
    Events
} from "discord.js";

import {
    createTicket,
    handleTicketButton
} from "../utils/tickets.js";

import {
    isApplicationButton,
    handleApplicationButton
} from "../utils/applications.js";

export default {
    name: Events.InteractionCreate,

    async execute(
        interaction,
        client
    ) {
        try {

            /*
             * =====================================
             * SLASH COMMANDS
             * =====================================
             */

            if (
                interaction.isChatInputCommand()
            ) {
                const command =
                    client.commands.get(
                        interaction.commandName
                    );

                if (!command) {
                    return;
                }

                await command.execute(
                    interaction
                );

                return;
            }

            /*
             * =====================================
             * BUTTONS
             * =====================================
             */

            if (
                interaction.isButton()
            ) {

                /*
                 * APPLICATION BUTTONS
                 */

                if (
                    isApplicationButton(
                        interaction
                    )
                ) {
                    await handleApplicationButton(
                        interaction
                    );

                    return;
                }

                /*
                 * TICKET CREATION
                 */

                if (
                    interaction.customId ===
                    "ticket_create"
                ) {
                    await createTicket(
                        interaction
                    );

                    return;
                }

                /*
                 * TICKET CONTROLS
                 */

                if (
                    interaction.customId ===
                        "ticket_claim" ||
                    interaction.customId ===
                        "ticket_close"
                ) {
                    await handleTicketButton(
                        interaction
                    );

                    return;
                }
            }

        } catch (error) {
            console.error(
                "Interaction error:",
                error
            );

            const response = {
                content:
                    "❌ Something went wrong while processing that action.",

                ephemeral: true
            };

            if (
                interaction.replied ||
                interaction.deferred
            ) {
                await interaction
                    .followUp(
                        response
                    )
                    .catch(() => {});
            } else {
                await interaction
                    .reply(
                        response
                    )
                    .catch(() => {});
            }
        }
    }
};