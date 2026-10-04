import {
    PermissionFlagsBits
} from "discord.js";

import config from "../../config.js";

import {
    closeEmailSupportCase,
    getEmailSupportCase
} from "../../utils/database.js";

import {
    errorEmbed,
    successEmbed
} from "../../utils/embeds.js";

import {
    sendSupportEmail,
    testEmailSupport
} from "../../utils/emailSupport.js";

function canManageEmailSupport(member) {
    return Boolean(
        member?.permissions.has(
            PermissionFlagsBits.ManageGuild
        ) ||
        member?.roles.cache.has(
            config.emailSupport.staffRoleId ||
            config.tickets.supportRoleId
        )
    );
}

function usage(prefix) {
    return [
        `\`${prefix}email respond <case id> <message>\` — reply to a support email.`,
        `\`${prefix}email end <case id>\` — close a support case.`,
        `\`${prefix}email test\` — test inbox access and send a test email.`
    ].join("\n");
}

export default {
    data: {
        name: "email"
    },

    async prefixExecute({
        message,
        args,
        prefix
    }) {
        if (!message.guild) {
            return message.reply(
                "Email support commands can only be used in a server."
            );
        }

        if (!canManageEmailSupport(message.member)) {
            return message.reply({
                embeds: [
                    errorEmbed(
                        "Permission Denied",
                        "You need the configured email support staff role or **Manage Server** permission."
                    )
                ]
            });
        }

        const subcommand =
            args.shift()?.toLowerCase();

        if (subcommand === "respond") {
            const caseId =
                Number(args.shift());
            const response =
                args.join(" ").trim();

            if (
                !Number.isSafeInteger(caseId) ||
                caseId < 1 ||
                !response
            ) {
                return message.reply(
                    `Usage: \`${prefix}email respond <case id> <message>\``
                );
            }

            const supportCase =
                getEmailSupportCase(caseId);

            if (
                !supportCase ||
                supportCase.status !== "open"
            ) {
                return message.reply({
                    embeds: [
                        errorEmbed(
                            "Case Not Open",
                            `No open email support case was found with ID **${caseId}**.`
                        )
                    ]
                });
            }

            try {
                await sendSupportEmail({
                    toEmail: supportCase.from_email,
                    subject: /^re:/i.test(supportCase.subject)
                        ? supportCase.subject
                        : `Re: ${supportCase.subject}`,
                    message: response,
                    caseId
                });
            } catch (error) {
                console.error(
                    `[EMAIL SUPPORT] Could not send a reply for case #${caseId}:`,
                    error
                );

                return message.reply({
                    embeds: [
                        errorEmbed(
                            "Email Not Sent",
                            `The reply could not be sent. ${error.message}`
                        )
                    ]
                });
            }

            try {
                const caseChannel =
                    await message.client.channels.fetch(
                        supportCase.discord_channel_id
                    );

                if (
                    caseChannel?.isTextBased() &&
                    typeof caseChannel.send === "function"
                ) {
                    await caseChannel.send({
                        content:
                            `📨 Staff reply sent for email case **#${caseId}** by ${message.author}.`,
                        allowedMentions: {
                            parse: []
                        }
                    });
                }
            } catch (error) {
                console.error(
                    `[EMAIL SUPPORT] Reply was emailed, but the Discord case log could not be updated for case #${caseId}:`,
                    error
                );
            }

            return message.reply({
                embeds: [
                    successEmbed(
                        "Email Sent",
                        `Your reply for case **#${caseId}** was emailed to **${supportCase.from_email}**.`
                    )
                ]
            });
        }

        if (subcommand === "end") {
            const caseId =
                Number(args.shift());

            if (
                !Number.isSafeInteger(caseId) ||
                caseId < 1
            ) {
                return message.reply(
                    `Usage: \`${prefix}email end <case id>\``
                );
            }

            const supportCase =
                getEmailSupportCase(caseId);

            if (
                !supportCase ||
                supportCase.status !== "open"
            ) {
                return message.reply({
                    embeds: [
                        errorEmbed(
                            "Case Not Open",
                            `No open email support case was found with ID **${caseId}**.`
                        )
                    ]
                });
            }

            const result =
                closeEmailSupportCase(caseId);

            if (!result.changes) {
                return message.reply({
                    embeds: [
                        errorEmbed(
                            "Case Not Open",
                            `Support case **#${caseId}** was already closed.`
                        )
                    ]
                });
            }

            try {
                const caseChannel =
                    await message.client.channels.fetch(
                        supportCase.discord_channel_id
                    );

                if (
                    caseChannel?.isTextBased() &&
                    typeof caseChannel.send === "function"
                ) {
                    await caseChannel.send({
                        content:
                            `✅ Email support case **#${caseId}** was closed by ${message.author}.`,
                        allowedMentions: {
                            parse: []
                        }
                    });
                }
            } catch (error) {
                console.error(
                    `[EMAIL SUPPORT] Case #${caseId} was closed, but the Discord case log could not be updated:`,
                    error
                );
            }

            return message.reply({
                embeds: [
                    successEmbed(
                        "Email Case Closed",
                        `Support case **#${caseId}** has been closed.`
                    )
                ]
            });
        }

        if (subcommand === "test") {
            try {
                await testEmailSupport();
            } catch (error) {
                console.error(
                    "[EMAIL SUPPORT] Integration test failed:",
                    error
                );

                return message.reply({
                    embeds: [
                        errorEmbed(
                            "Email Test Failed",
                            error.message
                        )
                    ]
                });
            }

            return message.reply({
                embeds: [
                    successEmbed(
                        "Email Test Sent",
                        `Inbox access succeeded and a test email was sent to **${config.emailSupport.mailboxEmail}**.`
                    )
                ]
            });
        }

        return message.reply({
            embeds: [
                errorEmbed(
                    "Email Support",
                    usage(prefix)
                )
            ]
        });
    }
};
