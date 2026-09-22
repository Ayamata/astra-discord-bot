export default {
    bot: {
        status: "In Development",
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
        supportRoleId: "1551911590536937523",
        categoryId: "1551980883488145438",
        logChannelId: "https://discord.com/api/webhooks/1551975698535546931/a4MtBO7uomL46udO1hdo84I-NKRQEDT-XqbDKH2M19DajVy3YfUSVUB_UMQejXuwKZ1d",
        transcriptChannelId: "",
        maximumOpenTickets: 2,
        nameFormat: "ticket-{username}",
        closeAfterHours: 48,
        allowUserClose: false,
        deleteAfterClose: false,
        ticketColor: 0x5865F2
    },

    applications: {
        enabled: true,
        channelId: "1551983074361741443",
        panelColor: 0x00AEFF,
        applicationColor: 0x00FF7F,
        questionTimeout: 5 * 60 * 1000,
        command: "applicationmessage",
        questions: [
            "What is your timezone?",
            "How active are you on this server? (hours per day / week)",
            "Why do you want to join the staff team?",
            "What would you do if two people are arguing in chat?",
            "Do you have any previous staff experience? If yes, where?",
            "How would you handle a user who keeps breaking rules after multiple warnings?",
            "What do you think is the most important quality of a staff member?",
            "How long have you been in this server and how did you find it?"
        ]
    },

    embeds: {
        color: 0x5865F2,
        errorColor: 0xED4245,
        successColor: 0x57F287,
        warningColor: 0xFEE75C
    }
};