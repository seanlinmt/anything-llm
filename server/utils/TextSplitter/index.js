/**
 * @typedef {object} DocumentMetadata
 * @property {string} id - eg; "123e4567-e89b-12d3-a456-426614174000"
 * @property {string} url - eg; "file://example.com/index.html"
 * @property {string} title - eg; "example.com/index.html"
 * @property {string} docAuthor - eg; "no author found"
 * @property {string} description - eg; "No description found."
 * @property {string} docSource - eg; "URL link uploaded by the user."
 * @property {string} chunkSource - eg; link://https://example.com
 * @property {string} published - ISO 8601 date string
 * @property {number} wordCount - Number of words in the document
 * @property {string} pageContent - The raw text content of the document
 * @property {number} token_count_estimate - Number of tokens in the document
 */

function isNullOrNaN(value) {
  if (value === null) return true;
  return isNaN(value);
}

class TextSplitter {
  #splitter;

  /**
   * Creates a new TextSplitter instance.
   * @param {Object} config
   * @param {string} [config.chunkPrefix = ""] - Prefix to be added to the start of each chunk.
   * @param {number} [config.chunkSize = 1000] - The size of each chunk.
   * @param {number} [config.chunkOverlap = 20] - The overlap between chunks.
   * @param {Object} [config.chunkHeaderMeta = null] - Metadata to be added to the start of each chunk - will come after the prefix.
   */
  constructor(config = {}) {
    this.config = config;
    this.#splitter = this.#setSplitter(config);
  }

  log(text, ...args) {
    console.log(`\x1b[35m[TextSplitter]\x1b[0m ${text}`, ...args);
  }

  /**
   *  Does a quick check to determine the text chunk length limit.
   * Embedder models have hard-set limits that cannot be exceeded, just like an LLM context
   * so here we want to allow override of the default 1000, but up to the models maximum, which is
   * sometimes user defined.
   */
  static determineMaxChunkSize(preferred = null, embedderLimit = 1000) {
    const prefValue = isNullOrNaN(preferred)
      ? Number(embedderLimit)
      : Number(preferred);
    const limit = Number(embedderLimit);
    if (prefValue > limit)
      console.log(
        `\x1b[43m[WARN]\x1b[0m Text splitter chunk length of ${prefValue} exceeds embedder model max of ${embedderLimit}. Will use ${embedderLimit}.`
      );
    return prefValue > limit ? limit : prefValue;
  }

  /**
   *  Creates a string of metadata to be prepended to each chunk.
   * @param {DocumentMetadata} metadata - Metadata to be prepended to each chunk.
   * @returns {{[key: ('title' | 'published' | 'source')]: string}} Object of metadata that will be prepended to each chunk.
   */
  static buildHeaderMeta(metadata = {}) {
    if (!metadata || Object.keys(metadata).length === 0) return null;
    const PLUCK_MAP = {
      title: {
        as: "sourceDocument",
        pluck: (metadata) => {
          return metadata?.title || null;
        },
      },
      published: {
        as: "published",
        pluck: (metadata) => {
          return metadata?.published || null;
        },
      },
      chunkSource: {
        as: "source",
        pluck: (metadata) => {
          const validPrefixes = ["link://", "youtube://"];
          // If the chunkSource is a link or youtube link, we can add the URL
          // as its source in the metadata so the LLM can use it for context.
          // eg prompt: Where did you get this information? -> answer: "from https://example.com"
          if (
            !metadata?.chunkSource || // Exists
            !metadata?.chunkSource.length || // Is not empty
            typeof metadata.chunkSource !== "string" || // Is a string
            !validPrefixes.some(
              (prefix) => metadata.chunkSource.startsWith(prefix) // Has a valid prefix we respect
            )
          )
            return null;

          // We know a prefix is present, so we can split on it and return the rest.
          // If nothing is found, return null and it will not be added to the metadata.
          let source = null;
          for (const prefix of validPrefixes) {
            source = metadata.chunkSource.split(prefix)?.[1] || null;
            if (source) break;
          }

          return source;
        },
      },
    };

    const pluckedData = {};
    Object.entries(PLUCK_MAP).forEach(([key, value]) => {
      if (!(key in metadata)) return; // Skip if the metadata key is not present.
      const pluckedValue = value.pluck(metadata);
      if (!pluckedValue) return; // Skip if the plucked value is null/empty.
      pluckedData[value.as] = pluckedValue;
    });

    return pluckedData;
  }

  /**
   * Apply the chunk prefix to the text if it is present.
   * @param {string} text - The text to apply the prefix to.
   * @returns {string} The text with the embedder model prefix applied.
   */
  #applyPrefix(text = "") {
    if (!this.config.chunkPrefix) return text;
    return `${this.config.chunkPrefix}${text}`;
  }

  /**
   * Creates a string of metadata to be prepended to each chunk.
   * Will additionally prepend a prefix to the text if it was provided (requirement for some embedders).
   * @returns {string} The text with the embedder model prefix applied.
   */
  stringifyHeader() {
    let content = "";
    if (!this.config.chunkHeaderMeta) return this.#applyPrefix(content);
    Object.entries(this.config.chunkHeaderMeta).map(([key, value]) => {
      if (!key || !value) return;
      content += `${key}: ${value}\n`;
    });

    if (!content) return this.#applyPrefix(content);
    return this.#applyPrefix(
      `<document_metadata>\n${content}</document_metadata>\n\n`
    );
  }

  /**
   * Sets the splitter to use a defined config passes to other subclasses.
   * @param {Object} config
   * @param {string} [config.chunkPrefix = ""] - Prefix to be added to the start of each chunk.
   * @param {number} [config.chunkSize = 1000] - The size of each chunk.
   * @param {number} [config.chunkOverlap = 20] - The overlap between chunks.
   */
  #setSplitter(config = {}) {
    // if (!config?.splitByFilename) {// TODO do something when specific extension is present? }


    if (config?.splitByAlgorithm === "semantic") {
      return new SemanticSplitter({
        chunkSize: isNaN(config?.chunkSize) ? 1_000 : Number(config?.chunkSize),
        chunkOverlap: isNaN(config?.chunkOverlap)
          ? 20
          : Number(config?.chunkOverlap),
        chunkHeader: this.stringifyHeader(),
        embedderApi: config?.embedderApi,
      });
    }

    if (config?.splitByAlgorithm === "structure") {
      return new StructureSplitter({
        chunkSize: isNaN(config?.chunkSize) ? 1_000 : Number(config?.chunkSize),
        chunkOverlap: isNaN(config?.chunkOverlap)
          ? 20
          : Number(config?.chunkOverlap),
        chunkHeader: this.stringifyHeader(),
      });
    }

    return new RecursiveSplitter({
      chunkSize: isNaN(config?.chunkSize) ? 1_000 : Number(config?.chunkSize),
      chunkOverlap: isNaN(config?.chunkOverlap)
        ? 20
        : Number(config?.chunkOverlap),
      chunkHeader: this.stringifyHeader(),
    });
  }

  async splitText(documentText) {
    return this.#splitter._splitText(documentText);
  }
}

// Wrapper for Langchain RecursiveCharacterTextSplitter class.
class RecursiveSplitter {
  constructor({ chunkSize, chunkOverlap, chunkHeader = null }) {
    const {
      RecursiveCharacterTextSplitter,
    } = require("@langchain/textsplitters");
    this.log(`Will split with`, {
      chunkSize,
      chunkOverlap,
      chunkHeader: chunkHeader ? `${chunkHeader?.slice(0, 50)}...` : null,
    });
    this.chunkHeader = chunkHeader;
    this.engine = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    });
  }

  log(text, ...args) {
    console.log(`\x1b[35m[RecursiveSplitter]\x1b[0m ${text}`, ...args);
  }

  async _splitText(documentText) {
    if (!this.chunkHeader) return this.engine.splitText(documentText);
    const strings = await this.engine.splitText(documentText);
    const documents = await this.engine.createDocuments(strings, [], {
      chunkHeader: this.chunkHeader,
    });
    return documents
      .filter((doc) => !!doc.pageContent)
      .map((doc) => doc.pageContent);
  }
}



class SemanticSplitter {
  constructor({
    chunkSize,
    chunkOverlap,
    chunkHeader = null,
    embedderApi = null,
  }) {
    // Semantic splitter requires an embedderApi to be passed in.
    if (!embedderApi) {
      throw new Error(
        "SemanticSplitter requires an embedderApi to be passed in."
      );
    }
    this.log(`Will split with`, {
      chunkSize,
      chunkOverlap,
      chunkHeader: chunkHeader ? `${chunkHeader?.slice(0, 50)}...` : null,
    });
    this.chunkHeader = chunkHeader;
    this.chunkSize = chunkSize;
    this.embedderApi = embedderApi;
  }

  log(text, ...args) {
    console.log(`\x1b[35m[SemanticSplitter]\x1b[0m ${text}`, ...args);
  }

  // Calculate cosine similarity between two vectors
  cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  async _splitText(documentText) {
    // 1. Split text into sentences (naively)
    // TODO: Use a better sentence splitter if available
    const sentences = documentText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [
      documentText,
    ];

    if (sentences.length === 0) return [];

    // 2. Embed all sentences
    // We batch this to respect the embedder's limits if possible, but for simplicity here we assume the embedder handles batching or we do it one by one.
    // Ideally, the embedderApi.embedChunks should support array of strings.
    const sentenceEmbeddings = await this.embedderApi.embedChunks(sentences);

    if (sentenceEmbeddings.length !== sentences.length) {
      console.error(
        "[SemanticSplitter] Mismatch between sentences and embeddings count."
      );
      // Fallback to returning the whole text as one chunk or improved error handling
      return [documentText];
    }

    // 3. Calculate similarity between adjacent sentences and group them
    const chunks = [];
    let currentChunk = sentences[0];
    let currentChunkSize = sentences[0].length;

    // We can use a dynamic threshold or a fixed one. For now, let's use a percentile-based approach or a fixed high threshold.
    // Let's implement a simple accumulation until similarity drops drastically or size limit is reached.
    // However, exact semantic chunking logic can vary.
    // A common simple approach:
    // Iterate through sentences, if sim(s_i, s_{i+1}) is high, merge. Else, split.
    // ALSO, we must respect chunkSize (hard limit).

    const SIMILARITY_THRESHOLD = 0.6; // This is arbitrary and highly dependent on the embedding model.

    for (let i = 1; i < sentences.length; i++) {
      const prevEmb = sentenceEmbeddings[i - 1];
      const currEmb = sentenceEmbeddings[i];
      const similarity = this.cosineSimilarity(prevEmb, currEmb);

      const nextSentence = sentences[i];

      // Logic:
      // If similarity is high AND adding it doesn't exceed chunk size -> Merge
      // If similarity is low -> Split
      // If adding exceeds chunk size -> Split

      if (
        similarity >= SIMILARITY_THRESHOLD &&
        currentChunkSize + nextSentence.length <= this.chunkSize
      ) {
        currentChunk += " " + nextSentence;
        currentChunkSize += 1 + nextSentence.length;
      } else {
        chunks.push(currentChunk);
        currentChunk = nextSentence;
        currentChunkSize = nextSentence.length;
      }
    }

    // Push the last chunk
    if (currentChunk) {
      chunks.push(currentChunk);
    }

    // 4. Verification and Header Application
    // Apply headers to all chunks
    const finalChunks = chunks.map((chunk) => {
      if (this.chunkHeader) {
        return `${this.chunkHeader}${chunk}`;
      }
      return chunk;
    });

    return finalChunks;
  }
}

class StructureSplitter {
  constructor({ chunkSize, chunkOverlap, chunkHeader = null }) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
    this.chunkHeader = chunkHeader;
    // We instantiate the recursive splitter as a fallback/sub-splitter
    this.subSplitter = new RecursiveSplitter({
      chunkSize,
      chunkOverlap,
      chunkHeader,
    });
  }

  log(text, ...args) {
    console.log(`\x1b[35m[StructureSplitter]\x1b[0m ${text}`, ...args);
  }

  async _splitText(documentText) {
    // 1. Split text into lines
    const lines = documentText.split("\n");
    const chunks = [];
    let currentChunk = [];
    let currentHeaders = {}; // Map of level -> header text

    // Helper to format metadata into string
    const getContextString = () => {
      const parts = Object.values(currentHeaders);
      if (parts.length === 0) return "";
      return parts.join(" > ") + "\n";
    };

    const processCurrentChunk = async () => {
      if (currentChunk.length === 0) return;
      const text = currentChunk.join("\n").trim();
      if (!text) return;

      const context = getContextString();
      // If the text + context is small enough, keep it
      // Otherwise split it recursively
      // We prepend context to the text for splitting to ensure it's considered in size
      const fullText = context ? `${context}\n${text}` : text;

      if (fullText.length <= this.chunkSize) {
        chunks.push(
          this.chunkHeader ? `${this.chunkHeader}${fullText}` : fullText
        );
      } else {
        // If it's too big, use recursive splitter on the *content*
        // but verify if we should prepend context to each sub-chunk
        const subChunks = await this.subSplitter._splitText(text);
        subChunks.forEach((subChunk) => {
          if (context) {
            chunks.push(`${context}\n${subChunk}`);
          } else {
            chunks.push(subChunk);
          }
        });
      }
      currentChunk = [];
    };

    for (const line of lines) {
      // Check for headers
      const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
      if (headerMatch) {
        // Found a header
        // 1. Process pending chunk
        await processCurrentChunk();

        // 2. Update headers map
        const level = headerMatch[1].length;
        const text = headerMatch[2].trim();

        // Clear deeper levels
        Object.keys(currentHeaders).forEach((k) => {
          if (Number(k) >= level) delete currentHeaders[k];
        });
        currentHeaders[level] = text;

        // The header itself is part of the structure, we usually don't include it as raw text content if it's in metadata
        // but often it's good to keep it in the text flow too.
        // Let's add it to the current chunk so it appears at the start of the section.
        currentChunk.push(line);
      } else {
        currentChunk.push(line);
      }
    }

    // Process remainder
    await processCurrentChunk();

    return chunks;
  }
}

module.exports.TextSplitter = TextSplitter;

module.exports.SemanticSplitter = SemanticSplitter;
module.exports.StructureSplitter = StructureSplitter;
