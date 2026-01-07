# AnythingLLM - Agent Context & Developer Guide

> [!NOTE]
> This document is designed to provide high-level context for AI Agents (like Gemini) and Developers working on the AnythingLLM codebase. It outlines the architecture, conventions, and key locations for common tasks.

## 1. Project Overview

**AnythingLLM** is a full-stack application that turns private documents, resources, or content into context that any LLM can reference during chatting. It supports generic chat, RAG (Retrieval Augmented Generation), and AI Agents.

- **Core Concept**: "Workspaces". A workspace is a containerized thread with specific documents and context that does not leak into other workspaces.
- **Deployment**: Runs as a Desktop App (Electron-like wrapper) or Docker container. Supports multi-user management in Docker mode.

## 2. Technical Architecture

The project is a Monorepo containing three main services:

### A. Frontend (`/frontend`)

- **Stack**: React (Vite), JavaScript (ESM).
- **Styling**: Vanilla CSS (`index.css`), potentially Tailwind (check specific components), standard CSS classes.
- **State Management**: React Context (`AuthContext`, `ThemeContext`, `PWAContext`).
- **Routing**: React Router (inferred from `pages` directory).
- **API Layer**: API calls are encapsulated in `frontend/src/models/`. **Do not make raw fetch calls in components; use/create a model function.**

### B. Server (`/server`)

- **Stack**: Node.js (Express), Prisma ORM.
- **Database**: SQLite (default via `anythingllm.db`), compatible with others via Prisma.
- **AI orchestration**: Heavy usage of `LangChain`, `OpenAI` SDK, and custom provider logic.
- **Key Directories**:
  - `endpoints/`: HTTP route handlers.
  - `utils/AiProviders/`: Integrations for LLMs (OpenAI, Anthropic, Ollama, etc.).
  - `utils/vectorDbProviders/`: Connectors for Vector DBs (LanceDB, Pinecone, Milvus, etc.).
  - `utils/EmbeddingEngines/`: Logic for embedding text.
  - `utils/agents/`: Logic for AI Agents and Tools.

### C. Collector (`/collector`)

- **Stack**: Node.js (Express).
- **Purpose**: Dedicated service for parsing and processing documents (PDF, TXT, DOCX, etc.) to offload heavy processing from the main server.

## 3. Development Workflow

### Setup

Run this once to install dependencies and set up environment variables:

```bash
yarn setup
```

_This command copies `.env.example` files to their respective `.env` destinations and runs Prisma migrations._

### Running Locally

To start all services (Frontend, Server, Collector) concurrently:

```bash
yarn dev:all
```

- **Frontend**: `http://localhost:3000`
- **Server**: `http://localhost:3001`
- **Collector**: `http://localhost:8888`

### Linting

```bash
yarn lint
```

## 4. Key Conventions & Rules

- **File Paths**: Always use **ABSOLUTE PATHS** when navigating or referencing files in tool calls.
  - Root: `/home/sean/projects/anything-llm/`
- **Frontend Models**: When adding a new API endpoint, add the corresponding request method in `frontend/src/models/[system|workspace|user].js`.
- **Environment Variables**:
  - `frontend/.env`: Frontend config.
  - `server/.env.development`: Server config (local).
  - `collector/.env`: Collector config.
- **Vector Database**: The default local vector DB is **LanceDB**.
- **Prisma**: After changing `server/prisma/schema.prisma`, always run `yarn prisma:setup` (or `npx prisma generate` + `migrate`) to update the client.

## 5. Common Tasks map

| Task                     | Relevant Directory/File                                                          |
| :----------------------- | :------------------------------------------------------------------------------- |
| **Add new LLM Provider** | `server/utils/AiProviders/` + `frontend/src/pages/General/LLMPreference/`        |
| **Add new Vector DB**    | `server/utils/vectorDbProviders/` + `frontend/src/pages/General/VectorDatabase/` |
| **Modify Chat Logic**    | `server/endpoints/chat.js` (or similar) + `server/utils/chats/`                  |
| **Change UI Theme**      | `frontend/src/index.css` + `frontend/src/ThemeContext.jsx`                       |
| **Agent Tools**          | `server/utils/agents/`                                                           |

## 6. Testing

- **Command**: `yarn test` (runs Jest).
- **Location**: Tests are generally co-located or in `__tests__` directories (verify specific locations as needed).
