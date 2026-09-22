import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} from "discord.js";

import config from "../config.js";

import {
    errorEmbed,
    successEmbed
} from "./embeds.js";

const APPLICATION_BUTTON_ID =
    "application_start";

const APPLICATION_ACCEPT_ID =
    "application_accept";

const APPLICATION_DENY_ID =
    "application_deny";

const APPLICATION_INTERVIEW_ID =
    "application_interview";

const CANCEL_TEXT =
    "cancel";

/*
 * ============================================================
 * APPLICATION PANEL
 * ============================================================
 */

export function createApplicationPanel() {
    const embed =
        new EmbedBuilder()
            .setColor(
                config.applications.panelColor
            )
            .setTitle("Staff Applications")
            .setDescription(
                [
                    "Interested in joining the staff team?",
                    "",
                    "Click the button below to start your application.",
                    "",
                    "The application will take place through **DMs**.",
                    "You will receive one question at a time.",
                    "",
                    `You have **${Math.floor(
                        config.applications.questionTimeout / 60000
                    )} minutes** to answer each question.`,
                    "",
                    `Type \`${CANCEL_TEXT}\` at any time to cancel.`
                ].join("\n")
            )
            .setFooter({
                text:
                    "Staff Application System"
            })
            .setTimestamp();

    const row =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        APPLICATION_BUTTON_ID
                    )
                    .setLabel(
                        "Start Application"
                    )
                    .setEmoji("📝")
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );

    return {
        embeds: [embed],
        components: [row]
    };
}

/*
 * ============================================================
 * START APPLICATION
 * ============================================================
 */

export async function startApplication(
    interaction
) {
    const user =
        interaction.user;

    let dm;

    try {
        dm =
            await user.createDM();

        await dm.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(
                        config.applications.panelColor
                    )
                    .setTitle(
                        "Staff Application"
                    )
                    .setDescription(
                        [
                            `Hello ${user}!`,
                            "",
                            "Welcome to the staff application.",
                            "",
                            "Please answer each question with **one message**.",
                            "",
                            `Type \`${CANCEL_TEXT}\` at any time to cancel.`,
                            "",
                            `You have **${Math.floor(
                                config.applications.questionTimeout / 60000
                            )} minutes** to answer each question.`
                        ].join("\n")
                    )
                    .setFooter({
                        text:
                            "Staff Application System"
                    })
                    .setTimestamp()
            ]
        });

    } catch (error) {
        console.error(
            "[APPLICATION] Could not open DM:",
            error
        );

        return interaction.reply({
            embeds: [
                errorEmbed(
                    "Unable to Start Application",
                    "I couldn't send you a DM. Please enable direct messages from server members and try again."
                )
            ],
            ephemeral: true
        });
    }

    await interaction.reply({
        embeds: [
            successEmbed(
                "Application Started",
                "I've sent you a DM with your staff application."
            )
        ],
        ephemeral: true
    });

    const answers = [];

    /*
     * Ask each question
     */

    for (
        let index = 0;
        index <
        config.applications.questions.length;
        index++
    ) {
        const question =
            config.applications.questions[
                index
            ];

        const total =
            config.applications.questions.length;

        await dm.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(
                        config.applications.panelColor
                    )
                    .setTitle(
                        `Question ${index + 1} of ${total}`
                    )
                    .setDescription(
                        [
                            question,
                            "",
                            "**Reply with one message containing your answer.**",
                            "",
                            `Type \`${CANCEL_TEXT}\` to cancel.`
                        ].join("\n")
                    )
                    .setFooter({
                        text:
                            `${index + 1}/${total} • Staff Application`
                    })
            ]
        });

        const collected =
            await dm.awaitMessages({
                filter: message =>
                    message.author.id ===
                        user.id &&
                    !message.author.bot,

                max: 1,

                time:
                    config.applications
                        .questionTimeout,

                errors: ["time"]
            }).catch(() => null);

        /*
         * Timeout
         */

        if (!collected) {
            await dm.send({
                embeds: [
                    errorEmbed(
                        "Application Cancelled",
                        "You took too long to answer the current question."
                    )
                ]
            });

            return;
        }

        const answer =
            collected.first();

        if (!answer) {
            await dm.send({
                embeds: [
                    errorEmbed(
                        "Application Cancelled",
                        "Something went wrong while reading your answer."
                    )
                ]
            });

            return;
        }

        const content =
            answer.content.trim();

        /*
         * Cancel
         */

        if (
            content.toLowerCase() ===
            CANCEL_TEXT
        ) {
            await dm.send({
                embeds: [
                    errorEmbed(
                        "Application Cancelled",
                        "Your staff application has been cancelled."
                    )
                ]
            });

            return;
        }

        /*
         * Empty answer
         */

        if (!content) {
            await dm.send({
                embeds: [
                    errorEmbed(
                        "Invalid Answer",
                        "Your answer cannot be empty."
                    )
                ]
            });

            index--;
            continue;
        }

        answers.push(content);

        /*
         * Progress message
         */

        if (index + 1 < total) {
            await dm.send({
                embeds: [
                    successEmbed(
                        "Answer Recorded",
                        "Your answer has been recorded. Moving to the next question..."
                    )
                ]
            });
        }
    }

    /*
     * All questions completed
     */

    await submitApplication(
        user,
        answers,
        dm
    );
}

/*
 * ============================================================
 * SUBMIT APPLICATION
 * ============================================================
 */

async function submitApplication(
    user,
    answers,
    dm
) {
    console.log(
        `[APPLICATION] Preparing submission for ${user.tag} (${user.id})`
    );

    const channel =
        await user.client.channels
            .fetch(
                config.applications.channelId
            )
            .catch(error => {
                console.error(
                    "[APPLICATION] Failed to fetch application channel:",
                    error
                );

                return null;
            });

    /*
     * Channel not found
     */

    if (!channel) {
        await dm.send({
            embeds: [
                errorEmbed(
                    "Application Error",
                    "Your application was completed, but I couldn't find the configured application channel."
                )
            ]
        });

        return;
    }

    /*
     * Make sure it's a text channel
     */

    if (!channel.isTextBased()) {
        await dm.send({
            embeds: [
                errorEmbed(
                    "Application Error",
                    "The configured application channel cannot receive messages."
                )
            ]
        });

        return;
    }

    /*
     * Check bot permissions
     */

    const guild =
        channel.guild;

    const botMember =
        guild.members.me ??
        await guild.members
            .fetch(user.client.user.id)
            .catch(() => null);

    if (!botMember) {
        console.error(
            "[APPLICATION] Could not find bot member."
        );

        return;
    }

    const permissions =
        channel.permissionsFor(
            botMember
        );

    if (
        !permissions?.has(
            "ViewChannel"
        ) ||
        !permissions?.has(
            "SendMessages"
        ) ||
        !permissions?.has(
            "EmbedLinks"
        )
    ) {
        await dm.send({
            embeds: [
                errorEmbed(
                    "Application Error",
                    "I don't have permission to send applications to the configured channel."
                )
            ]
        });

        return;
    }

    /*
     * Create application embeds
     */

    const embeds = [];

    let currentEmbed =
        createApplicationEmbed(user, true);

    let fieldCount = 0;

    for (
        let index = 0;
        index < answers.length;
        index++
    ) {
        const question =
            config.applications.questions[
                index
            ];

        const answer =
            answers[index] ||
            "No answer provided.";

        const safeAnswer =
            answer.length > 1024
                ? `${answer.slice(0, 1021)}...`
                : answer;

        currentEmbed.addFields({
            name:
                `Q${index + 1}: ${question}`
                    .slice(0, 256),

            value: safeAnswer,

            inline: false
        });

        fieldCount++;

        /*
         * Discord allows a maximum of 25
         * fields per embed.
         *
         * Four questions per embed keeps
         * the application readable.
         */

        if (
            fieldCount >= 4 &&
            index <
                answers.length - 1
        ) {
            embeds.push(
                currentEmbed
            );

            currentEmbed =
                createApplicationEmbed(
                    user,
                    false
                );

            fieldCount = 0;
        }
    }

    embeds.push(
        currentEmbed
    );

    /*
     * Review buttons
     */

    const reviewRow =
        createReviewButtons(
            user.id
        );

    try {
        await channel.send({
            content:
                `📋 **New Staff Application**\nApplicant: ${user}`,

            embeds,

            components: [
                reviewRow
            ]
        });

        console.log(
            `[APPLICATION] Successfully submitted application from ${user.tag}.`
        );

    } catch (error) {
        console.error(
            "[APPLICATION] Failed to send application:",
            error
        );

        await dm.send({
            embeds: [
                errorEmbed(
                    "Submission Failed",
                    "Your application was completed, but I couldn't send it to the staff team."
                )
            ]
        });

        return;
    }

    /*
     * Tell applicant
     */

    await dm.send({
        embeds: [
            successEmbed(
                "Application Submitted",
                [
                    "Thank you for applying to the staff team!",
                    "",
                    "Your application has been submitted successfully.",
                    "",
                    "The staff team will review your application."
                ].join("\n")
            )
        ]
    });
}

/*
 * ============================================================
 * APPLICATION EMBED
 * ============================================================
 */

function createApplicationEmbed(
    user,
    isFirstEmbed = false
) {
    const embed =
        new EmbedBuilder()
            .setColor(
                config.applications.applicationColor
            );

    // Only the first embed gets the application header.
    if (isFirstEmbed) {
        embed
            .setTitle("New Staff Application")
            .setAuthor({
                name: user.tag,
                iconURL: user.displayAvatarURL({
                    size: 256
                })
            })
    }

    return embed;
}

/*
 * ============================================================
 * REVIEW BUTTONS
 * ============================================================
 */

function createReviewButtons(
    userId,
    disabled = false
) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `${APPLICATION_ACCEPT_ID}:${userId}`
                )
                .setLabel("Accept")
                .setEmoji("✅")
                .setStyle(
                    ButtonStyle.Success
                )
                .setDisabled(disabled),

            new ButtonBuilder()
                .setCustomId(
                    `${APPLICATION_DENY_ID}:${userId}`
                )
                .setLabel("Deny")
                .setEmoji("❌")
                .setStyle(
                    ButtonStyle.Danger
                )
                .setDisabled(disabled),

            new ButtonBuilder()
                .setCustomId(
                    `${APPLICATION_INTERVIEW_ID}:${userId}`
                )
                .setLabel("Interview")
                .setEmoji("🎤")
                .setStyle(
                    ButtonStyle.Primary
                )
                .setDisabled(disabled)
        );
}

/*
 * ============================================================
 * APPLICATION BUTTON DETECTION
 * ============================================================
 */

export function isApplicationButton(
    interaction
) {
    if (!interaction.isButton()) {
        return false;
    }

    return (
        interaction.customId ===
            APPLICATION_BUTTON_ID ||
        interaction.customId.startsWith(
            `${APPLICATION_ACCEPT_ID}:`
        ) ||
        interaction.customId.startsWith(
            `${APPLICATION_DENY_ID}:`
        ) ||
        interaction.customId.startsWith(
            `${APPLICATION_INTERVIEW_ID}:`
        )
    );
}

/*
 * ============================================================
 * HANDLE APPLICATION BUTTONS
 * ============================================================
 */

export async function handleApplicationButton(
    interaction
) {
    const [
        action,
        userId
    ] =
        interaction.customId.split(":");

    /*
     * Start button
     */

    if (
        action ===
        APPLICATION_BUTTON_ID
    ) {
        await startApplication(
            interaction
        );

        return;
    }

    /*
     * Make sure this is a review action
     */

    if (
        action !==
            APPLICATION_ACCEPT_ID &&
        action !==
            APPLICATION_DENY_ID &&
        action !==
            APPLICATION_INTERVIEW_ID
    ) {
        return;
    }

    /*
     * Reviewer permission
     */

    if (
        config.applications
            .reviewerRoleId &&
        !interaction.member.roles.cache.has(
            config.applications
                .reviewerRoleId
        )
    ) {
        await interaction.reply({
            embeds: [
                errorEmbed(
                    "Permission Denied",
                    "You don't have permission to review staff applications."
                )
            ],
            ephemeral: true
        });

        return;
    }

    /*
     * Find applicant
     */

    const applicant =
        await interaction.client.users
            .fetch(userId)
            .catch(() => null);

    if (!applicant) {
        await interaction.reply({
            embeds: [
                errorEmbed(
                    "User Not Found",
                    "I couldn't find the applicant."
                )
            ],
            ephemeral: true
        });

        return;
    }

    /*
     * ACCEPT
     */

    if (
        action ===
        APPLICATION_ACCEPT_ID
    ) {
        await handleAccept(
            interaction,
            applicant
        );

        return;
    }

    /*
     * DENY
     */

    if (
        action ===
        APPLICATION_DENY_ID
    ) {
        await handleDeny(
            interaction,
            applicant
        );

        return;
    }

    /*
     * INTERVIEW
     */

    if (
        action ===
        APPLICATION_INTERVIEW_ID
    ) {
        await handleInterview(
            interaction,
            applicant
        );
    }
}

/*
 * ============================================================
 * ACCEPT
 * ============================================================
 */

async function handleAccept(
    interaction,
    applicant
) {
    let roleAdded = false;

    /*
     * Give staff role if configured
     */

    if (
        config.applications
            .staffRoleId
    ) {
        const member =
            await interaction.guild
                .members
                .fetch(applicant.id)
                .catch(() => null);

        if (member) {
            try {
                await member.roles.add(
                    config.applications
                        .staffRoleId,
                    "Staff application accepted"
                );

                roleAdded = true;

            } catch (error) {
                console.error(
                    "[APPLICATION] Failed to add staff role:",
                    error
                );
            }
        }
    }

    /*
     * DM applicant
     */

    await applicant.send({
        embeds: [
            new EmbedBuilder()
                .setColor(
                    config.embeds
                        .successColor
                )
                .setTitle(
                    "Staff Application Accepted"
                )
                .setDescription(
                    [
                        `Congratulations ${applicant}!`,
                        "",
                        "Your staff application has been accepted.",
                        "",
                        roleAdded
                            ? "You have also been given the staff role."
                            : "A member of the staff team will provide your next steps."
                    ].join("\n")
                )
                .setTimestamp()
        ]
    }).catch(() => {});

    /*
     * Update application message
     */

    await markApplicationReviewed(
        interaction,
        "Accepted",
        interaction.user,
        config.embeds.successColor
    );

    await interaction.reply({
        embeds: [
            successEmbed(
                "Application Accepted",
                `${applicant.tag}'s application has been accepted.`
            )
        ],
        ephemeral: true
    });
}

/*
 * ============================================================
 * DENY
 * ============================================================
 */

async function handleDeny(
    interaction,
    applicant
) {
    await applicant.send({
        embeds: [
            new EmbedBuilder()
                .setColor(
                    config.embeds
                        .errorColor
                )
                .setTitle(
                    "Staff Application Update"
                )
                .setDescription(
                    [
                        `Hello ${applicant},`,
                        "",
                        "Thank you for taking the time to apply for the staff team.",
                        "",
                        "Unfortunately, your application was not accepted at this time.",
                        "",
                        "You may apply again in the future."
                    ].join("\n")
                )
                .setTimestamp()
        ]
    }).catch(() => {});

    await markApplicationReviewed(
        interaction,
        "Denied",
        interaction.user,
        config.embeds.errorColor
    );

    await interaction.reply({
        embeds: [
            successEmbed(
                "Application Denied",
                `${applicant.tag}'s application has been denied.`
            )
        ],
        ephemeral: true
    });
}

/*
 * ============================================================
 * INTERVIEW
 * ============================================================
 */

async function handleInterview(
    interaction,
    applicant
) {
    await applicant.send({
        embeds: [
            new EmbedBuilder()
                .setColor(
                    config.applications
                        .panelColor
                )
                .setTitle(
                    "Staff Interview"
                )
                .setDescription(
                    [
                        `Hello ${applicant}!`,
                        "",
                        "The staff team has reviewed your application and would like to speak with you in an interview.",
                        "",
                        "A staff member will contact you with the next steps."
                    ].join("\n")
                )
                .setTimestamp()
        ]
    }).catch(() => {});

    await markApplicationReviewed(
        interaction,
        "Interview Requested",
        interaction.user,
        config.applications
            .panelColor
    );

    await interaction.reply({
        embeds: [
            successEmbed(
                "Interview Requested",
                `${applicant.tag} has been notified that the staff team would like an interview.`
            )
        ],
        ephemeral: true
    });
}

/*
 * ============================================================
 * MARK APPLICATION AS REVIEWED
 * ============================================================
 */

async function markApplicationReviewed(
    interaction,
    decision,
    reviewer,
    color
) {
    const message =
        interaction.message;

    if (!message) {
        return;
    }

    const embeds =
        message.embeds.map(
            embed => EmbedBuilder.from(embed)
        );

    for (const embed of embeds) {
        embed.setColor(color);
    }

    const lastEmbed =
        embeds[embeds.length - 1];

    if (lastEmbed) {
        lastEmbed.addFields({
            name: "Application Status",

            value:
                `**${decision}**\n` +
                `Reviewed by **${reviewer}**`,

            inline: false
        });

        lastEmbed.setFooter({
            text:
                `User ID: ${message.embeds[0]?.footer?.text?.replace("User ID: ", "") || "Unknown"}`
        });

        lastEmbed.setTimestamp()
    }

    /*
     * Disable the review buttons.
     */
    const disabledRow =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "application_reviewed_accept"
                    )
                    .setLabel("Accept")
                    .setEmoji("✅")
                    .setStyle(
                        ButtonStyle.Success
                    )
                    .setDisabled(true),

                new ButtonBuilder()
                    .setCustomId(
                        "application_reviewed_deny"
                    )
                    .setLabel("Deny")
                    .setEmoji("❌")
                    .setStyle(
                        ButtonStyle.Danger
                    )
                    .setDisabled(true),

                new ButtonBuilder()
                    .setCustomId(
                        "application_reviewed_interview"
                    )
                    .setLabel("Interview")
                    .setEmoji("🎤")
                    .setStyle(
                        ButtonStyle.Primary
                    )
                    .setDisabled(true)
            );

    await message.edit({
        embeds,
        components: [
            disabledRow
        ]
    });
}