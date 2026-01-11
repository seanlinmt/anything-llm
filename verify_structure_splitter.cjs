const { TextSplitter } = require('./server/utils/TextSplitter');
const fs = require('fs');

async function verify() {
    const structureExample = {
        type: "document",
        docId: "doc-123",
        content: [
            {
                type: "page",
                page_number: 1,
                elements: [
                    {
                        type: "heading",
                        level: 1,
                        text: "Main Title",
                        embedding_text: "Main Title > Context",
                        chunk_id: "chk-1",
                        breadcrumbs: ["Main Title"],
                        token_estimate: 10,
                        bbox: [10, 10, 100, 20],
                        semantic_type: "heading",
                        entities: [{ name: "Main Title", label: "TITLE" }],
                        metadata: { existing: "meta" }
                    },
                    {
                        type: "paragraph",
                        text: "This is a paragraph about something important.",
                        chunk_id: "chk-2",
                        breadcrumbs: ["Main Title"],
                        token_estimate: 50
                    }
                ]
            }
        ]
    };

    const splitter = new TextSplitter({
        splitByAlgorithm: 'structure',
        chunkSize: 1000,
        chunkOverlap: 0,
        returnObjects: true
    });

    const chunks = await splitter.splitText(JSON.stringify(structureExample));

    console.log("Chunk count:", chunks.length);
    chunks.forEach((chunk, i) => {
        console.log(`\n--- Chunk ${i} ---`);
        console.log("Content:", chunk.pageContent);
        console.log("Metadata:", JSON.stringify(chunk.metadata, null, 2));

        if (chunk.metadata.chunk_id) {
            console.log("✅ Metadata preserved for", chunk.metadata.chunk_id);
        } else {
            console.log("❌ Metadata MISSING");
        }
    });

    if (chunks[0].metadata.bbox && chunks[0].metadata.entities) {
        console.log("\n✅ Rich metadata (bbox, entities) found!");
    } else {
        console.log("\n❌ Rich metadata missing!");
    }
}

verify().catch(console.error);
