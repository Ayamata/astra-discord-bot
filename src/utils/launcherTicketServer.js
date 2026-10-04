import http from "node:http";

import { handleLauncherSupportApi } from "./tickets.js";

const HOST = String(process.env.ASTRA_TICKET_API_HOST || "127.0.0.1").trim() || "127.0.0.1";
const PORT = Number(process.env.ASTRA_TICKET_API_PORT || 47843);

function json(response, status, body) {
    const text = JSON.stringify(body);
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(text)
    });
    response.end(text);
}

async function readBody(request) {
    const chunks = [];
    for await (const chunk of request) {
        chunks.push(chunk);
        const size = chunks.reduce((sum, item) => sum + item.length, 0);
        if (size > 8 * 1024 * 1024) {
            throw new Error("too-large");
        }
    }
    return Buffer.concat(chunks).toString("utf8");
}

export function startLauncherTicketServer(client) {
    const server = http.createServer((request, response) => {
        void onRequest(request, response, client);
    });

    server.on("error", (error) => {
        console.error("[TICKETS] Support API failed:", error);
    });

    server.listen(PORT, HOST, () => {
        console.log(`[TICKETS] Contact Support API on http://${HOST}:${PORT}/v1/support-ticket`);
    });

    return server;
}

async function onRequest(request, response, client) {
    const url = new URL(request.url || "/", `http://${HOST}:${PORT}`);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
        response.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        });
        response.end();
        return;
    }

    if (request.method === "GET" && (path === "/" || path === "/health")) {
        json(response, 200, {
            ok: true,
            service: "astra-support-ticket-api",
            bot: client.user?.tag || null,
            endpoint: "POST /v1/support-ticket"
        });
        return;
    }

    if (request.method !== "POST" || path !== "/v1/support-ticket") {
        json(response, 404, { ok: false, error: "not found" });
        return;
    }

    let body;
    try {
        body = JSON.parse(await readBody(request));
    } catch (error) {
        json(
            response,
            error instanceof Error && error.message === "too-large" ? 413 : 400,
            { ok: false, error: "invalid json" }
        );
        return;
    }

    try {
        const result = await handleLauncherSupportApi(client, body);
        json(response, result.ok ? 200 : result.status || 400, result);
    } catch (error) {
        console.error("[TICKETS] Support API error:", error);
        json(response, 500, { ok: false, error: "Could not create a support ticket." });
    }
}
