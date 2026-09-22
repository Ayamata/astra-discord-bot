export default {
    bot: {
        status: "",
        activityType: "WATCHING",
        prefix: "+"
    },

    moderation: {
        moderatorRoleId: "",
        logChannelId: "",
        dmUsers: true,
        maxWarnings: 5,
        autoTimeoutAfterWarnings: true,
        autoTimeoutDuration: 60 * 60 * 1000,
        deleteCommandMessages: false
    },

    tickets: {
        enabled: true,
        supportRoleId: "",
        categoryId: "",
        logChannelId: "",
        transcriptChannelId: "",
        maximumOpenTickets: 1,
        nameFormat: "ticket-{username}",
        closeAfterHours: 48,
        allowUserClose: true,
        deleteAfterClose: false,
        ticketColor: 0x5865F2
    },

    embeds: {
        color: 0x5865F2,
        errorColor: 0xED4245,
        successColor: 0x57F287,
        warningColor: 0xFEE75C
    }
};