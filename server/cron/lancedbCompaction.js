const { LanceDb } = require("../utils/vectorDbProviders/lance");

function start() {
    if (process.env.VECTOR_DB !== "lancedb") return;
    console.log("[LanceDB] Compaction service started.");

    // Run compaction every 60 minutes
    setInterval(async () => {
        try {
            await LanceDb.compact();
        } catch (e) {
            console.error("[LanceDB] Compaction failed:", e);
        }
    }, 60 * 60 * 1000);
}

module.exports = { start };
