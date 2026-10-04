import {
    EmbedBuilder
} from "discord.js";

import emailjs from "@emailjs/nodejs";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

import config from "../config.js";

import {
    createEmailSupportCase,
    deleteEmailSupportCase,
    getEmailSupportCaseByMessageId,
    setEmailSupportCaseMessage
} from "./database.js";

let polling = false;

function getMissingConfiguration(names) {
    return names.filter(name => !process.env[name]);
}

function assertInboxConfiguration() {
    const missing =
        getMissingConfiguration([
            "GMAIL_APP_PASSWORD"
        ]);

    if (!config.emailSupport.mailboxEmail) {
        missing.push("emailSupport.mailboxEmail in src/config.js");
    }

    if (!config.emailSupport.channelId) {
        missing.push("emailSupport.channelId in src/config.js");
    }

    if (missing.length) {
        throw new Error(
            `Email inbox support is missing configuration: ${missing.join(", ")}`
        );
    }
}

function assertEmailJsConfiguration() {
    const missing =
        getMissingConfiguration([
            "EMAILJS_SERVICE_ID",
            "EMAILJS_TEMPLATE_ID",
            "EMAILJS_PUBLIC_KEY",
            "EMAILJS_PRIVATE_KEY"
        ]);

    if (missing.length) {
        throw new Error(
            `EmailJS is missing configuration: ${missing.join(", ")}`
        );
    }
}

function createImapClient() {
    return new ImapFlow({
        host: "imap.gmail.com",
        port: 993,
        secure: true,
        logger: false,
        auth: {
            user: config.emailSupport.mailboxEmail,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });
}

function getSenderAddress(parsed) {
    const address =
        parsed.from?.value?.[0]?.address?.trim();

    if (!address || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) {
        throw new Error(
            `Cannot process email with invalid sender address: ${address || "(missing From header)"}`
        );
    }

    return address;
}

function isAutomatedEmail(parsed, from) {
    const localPart =
        from.split("@")[0].toLowerCase();

    if (
        /^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|notifications?)$/.test(localPart) ||
        /^noreply[-_.]|[-_.]noreply$/.test(localPart)
    ) {
        return true;
    }

    const headers =
        parsed.headers;
    const autoSubmitted =
        String(headers.get("auto-submitted") || "").toLowerCase();
    const precedence =
        String(headers.get("precedence") || "").toLowerCase();

    return (
        (autoSubmitted && autoSubmitted !== "no") ||
        ["bulk", "list", "junk", "auto_reply"].includes(precedence) ||
        headers.has("list-id") ||
        headers.has("list-unsubscribe")
    );
}

function createEmailEmbed(id, from, subject, body) {
    const description =
        body.length > 3900
            ? `${body.slice(0, 3890)}\n[Message truncated]`
            : body;

    return new EmbedBuilder()
        .setColor(config.embeds.color)
        .setTitle(`Support email #${id}`)
        .addFields(
            {
                name: "From",
                value: from.slice(0, 1024)
            },
            {
                name: "Subject",
                value: (subject || "(No subject)").slice(0, 1024)
            }
        )
        .setDescription(description || "(Empty email)")
        .setTimestamp();
}

async function markMessageRead(client, uid) {
    await client.messageFlagsAdd(
        uid,
        ["\\Seen"],
        { uid: true }
    );
}

async function processIncomingMessage(
    discordClient,
    imapClient,
    uid,
    source,
    uidValidity
) {
    const parsed =
        await simpleParser(source);
    const messageId =
        parsed.messageId ||
        `${uidValidity}:${uid}`;
    const existing =
        getEmailSupportCaseByMessageId(messageId);

    if (existing) {
        await markMessageRead(imapClient, uid);
        return;
    }

    const from =
        getSenderAddress(parsed);

    if (
        from.toLowerCase() ===
        config.emailSupport.mailboxEmail.toLowerCase()
    ) {
        await markMessageRead(imapClient, uid);
        return;
    }

    if (isAutomatedEmail(parsed, from)) {
        await markMessageRead(imapClient, uid);
        console.log(
            `[EMAIL SUPPORT] Skipped automated email from ${from}`
        );
        return;
    }

    const subject =
        parsed.subject?.trim() || "(No subject)";
    const body =
        parsed.text?.trim() ||
        "(This email did not contain a readable text message.)";
    const caseId =
        createEmailSupportCase(
            messageId,
            from,
            subject,
            body
        );

    try {
        const channel =
            await discordClient.channels.fetch(
                config.emailSupport.channelId
            );

        if (
            !channel?.isTextBased() ||
            typeof channel.send !== "function"
        ) {
            throw new Error(
                "Configured email support channel is missing or cannot receive messages."
            );
        }

        const discordMessage =
            await channel.send({
                embeds: [
                    createEmailEmbed(
                        caseId,
                        from,
                        subject,
                        body
                    )
                ],
                allowedMentions: {
                    parse: []
                }
            });

        setEmailSupportCaseMessage(
            caseId,
            channel.id,
            discordMessage.id
        );
    } catch (error) {
        deleteEmailSupportCase(caseId);
        throw error;
    }

    await markMessageRead(imapClient, uid);

    console.log(
        `[EMAIL SUPPORT] Received email as case #${caseId} from ${from}`
    );
}

export async function pollEmailInbox(discordClient) {
    assertInboxConfiguration();

    if (polling) {
        return;
    }

    polling = true;

    const imapClient =
        createImapClient();

    try {
        await imapClient.connect();

        const lock =
            await imapClient.getMailboxLock("INBOX");

        try {
            const uids =
                await imapClient.search(
                    { seen: false },
                    { uid: true }
                );

            if (!uids || !uids.length) {
                return;
            }

            const uidValidity =
                imapClient.mailbox.uidValidity;

            for (const uid of uids.slice(0, 50)) {
                try {
                    const message =
                        await imapClient.fetchOne(
                            String(uid),
                            {
                                source: true
                            },
                            {
                                uid: true
                            }
                        );

                    if (!message?.source) {
                        throw new Error(
                            `IMAP returned no source for message UID ${uid}.`
                        );
                    }

                    await processIncomingMessage(
                        discordClient,
                        imapClient,
                        uid,
                        message.source,
                        uidValidity
                    );
                } catch (error) {
                    console.error(
                        `[EMAIL SUPPORT] Failed to process inbox message UID ${uid}; it will be retried:`,
                        error
                    );
                }
            }
        } finally {
            lock.release();
        }
    } finally {
        if (!imapClient.isClosed) {
            await imapClient.logout().catch(error => {
                console.error(
                    "[EMAIL SUPPORT] Failed to close the IMAP connection:",
                    error
                );
            });
        }

        polling = false;
    }
}

export function startEmailSupportPolling(client) {
    if (!config.emailSupport.enabled) {
        console.log(
            "[EMAIL SUPPORT] Inbox polling is disabled in src/config.js."
        );
        return;
    }

    try {
        assertInboxConfiguration();
    } catch (error) {
        console.error(
            `[EMAIL SUPPORT] Inbox polling is not configured: ${error.message}`
        );
        return;
    }

    const poll = () => {
        pollEmailInbox(client).catch(error => {
            console.error(
                "[EMAIL SUPPORT] Inbox poll failed:",
                error
            );
        });
    };

    poll();

    setInterval(
        poll,
        config.emailSupport.pollInterval
    );

    console.log(
        `[EMAIL SUPPORT] Polling ${config.emailSupport.mailboxEmail} every ${config.emailSupport.pollInterval / 1000} seconds.`
    );
}

export async function sendSupportEmail({
    toEmail,
    subject,
    message,
    caseId
}) {
    assertEmailJsConfiguration();

    const result =
        await emailjs.send(
            process.env.EMAILJS_SERVICE_ID,
            process.env.EMAILJS_TEMPLATE_ID,
            {
                to_email: toEmail,
                subject,
                message,
                case_id: String(caseId),
                reply_to: config.emailSupport.mailboxEmail
            },
            {
                publicKey: process.env.EMAILJS_PUBLIC_KEY,
                privateKey: process.env.EMAILJS_PRIVATE_KEY
            }
        );

    if (result.status < 200 || result.status >= 300) {
        throw new Error(
            `EmailJS returned status ${result.status}: ${result.text}`
        );
    }

    return result;
}

export async function testEmailSupport() {
    assertInboxConfiguration();

    const imapClient =
        createImapClient();

    try {
        await imapClient.connect();
    } finally {
        if (!imapClient.isClosed) {
            await imapClient.logout();
        }
    }

    await sendSupportEmail({
        toEmail: config.emailSupport.mailboxEmail,
        subject: "Astra Client support integration test",
        message:
            "This is a test email from the Astra Client Discord support bot.",
        caseId: "test"
    });
}
