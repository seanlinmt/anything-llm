/**
 * Example structure for a "Structure Aware" document container.
 * This object models the hierarchy and metadata found in the provided document images.
 */

const DocumentStructure = {
  // Container Level Metadata
  id: "22025_DMN056",
  type: "document",
  metadata: {
    title: "22025_DMN056",
    subtitle: "Container BC20009Í",
    source_filename: "22025_DMN056.pdf",
    page_count: 2, // Inferred from images
    // [NEW] Global tags for the entire document
    flags: ["confidential", "report"],
  },
  // Content Hierarchy
  content: [
    {
      type: "page",
      page_number: 1,
      elements: [
        {
          type: "heading",
          level: 1,
          text: "22025_DMN056",
          // [NEW] Traceability and Context
          chunk_id: "22025_DMN056_p1_h1",
          breadcrumbs: ["22025_DMN056"],
          token_estimate: 5,
          embedding_text: "22025_DMN056", // Text prioritized for embedding
        },
        {
          type: "heading",
          level: 2,
          text: "Container BC20009Í",
          chunk_id: "22025_DMN056_p1_h2_1",
          breadcrumbs: ["22025_DMN056", "Container BC20009Í"],
          token_estimate: 8,
          embedding_text: "22025_DMN056 > Container BC20009Í",
        },
      ],
    },
    {
      type: "page",
      page_number: 2,
      elements: [
        {
          type: "section",
          role: "header_metadata",
          // Structured Key-Value pairs found at the top of the page
          attributes: {
            To: "Dutch Embassy",
            Re: "Kivu updates",
            Status: "Confidential",
            Rank: 4,
            "Date release": "December 2025",
          },
          // [NEW] RAG enhancements
          chunk_id: "22025_DMN056_p2_s1",
          breadcrumbs: ["22025_DMN056", "Page 2 Header"],
          token_estimate: 45,
          embedding_text: "22025_DMN056 > Page 2 Header: Dutch Embassy. Kivu updates. Confidential. Rank 4. Date release: December 2025.",
          flags: ["metadata", "high_importance"],
          semantic_type: "key_value_store",
          bbox: [50, 50, 500, 200], // [x, y, w, h]
          relationships: {
            prev_chunk: "22025_DMN056_p1_h2_1",
            next_chunk: "22025_DMN056_p2_p1",
            parent_chunk: "22025_DMN056_p2",
          },
          entities: [
            { name: "Dutch Embassy", label: "ORG" },
            { name: "December 2025", label: "DATE" },
          ],
        },
        {
          type: "paragraph",
          text: "Source codes kept out of this report.",
          chunk_id: "22025_DMN056_p2_p1",
          breadcrumbs: ["22025_DMN056", "Page 2"],
          token_estimate: 10,
          embedding_text: "22025_DMN056 > Page 2: Source codes kept out of this report.",
          semantic_type: "narrative_text",
          bbox: [50, 260, 500, 50],
          relationships: {
            prev_chunk: "22025_DMN056_p2_s1",
            next_chunk: "22025_DMN056_p2_l1_i1",
            parent_chunk: "22025_DMN056_p2",
          },
        },
        {
          type: "list",
          list_type: "numbered_sections",
          items: [
            {
              code: "DMN056.1",
              type: "list_item",
              text: "paragraph text",
              chunk_id: "22025_DMN056_p2_l1_i1",
              breadcrumbs: ["22025_DMN056", "DMN056.1"],
              token_estimate: 5,
              embedding_text: "22025_DMN056 > DMN056.1: DMN056.1 first paragraph text",
              semantic_type: "list_item",
              bbox: [70, 320, 480, 40],
              relationships: {
                prev_chunk: "22025_DMN056_p2_p1",
                next_chunk: "22025_DMN056_p2_l1_i2",
                parent_chunk: "22025_DMN056_p2_l1",
              },
              entities: [{ name: "DMN056.1", label: "CODE" }],
            },
            {
              code: "DMN056.1",
              type: "list_item",
              text: "paragraph text",
              chunk_id: "22025_DMN056_p2_l1_i2",
              breadcrumbs: ["22025_DMN056", "DMN056.1"],
              token_estimate: 5,
              embedding_text: "22025_DMN056 > DMN056.1: DMN056.1 second paragraph text",
            },
            {
              code: "DMN056.2",
              type: "list_item",
              text: "paragraph text",
              chunk_id: "22025_DMN056_p2_l1_i3",
              breadcrumbs: ["22025_DMN056", "DMN056.2"],
              token_estimate: 5,
              embedding_text: "22025_DMN056 > DMN056.2: DMN056.2 first paragraph text",
            },
          ],
        },
      ],
    },
  ],
};

module.exports = { DocumentStructure };
