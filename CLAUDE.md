# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install/cache dependencies
deno cache src/index.ts

# Run the MCP server
deno task start
# Or directly: deno run --allow-all src/index.ts

# Development (with file watching)
deno task dev

# Code quality
deno task fmt     # Format code
deno task lint    # Lint code
deno task check   # Type check all TypeScript files

# Build standalone binary
deno task build   # Creates executable at ./imessage-mcp

# Run tests
deno task test
```

## Architecture Overview

This is a Model Context Protocol (MCP) server that provides read-only access to the macOS iMessage database. The codebase follows functional programming principles with no classes. It's implemented in a functional programming style.

### Core Components

1. **MCP Server Layer** (`src/index.ts`)
   - Creates MCP server instance using `@modelcontextprotocol/sdk`
   - Defines 5 tools with Zod schemas for validation
   - Uses StdioServerTransport for communication
   - Lazy database initialization pattern

2. **Database Layer** (`src/database.ts`)
   - Pure functions for all database operations
   - Direct SQLite access to `~/Library/Messages/chat.db`
   - Handles Apple's timestamp format (Core Data epoch: seconds since 2001-01-01)
   - All queries are read-only with parameterized SQL

3. **Type System** (`src/types.ts`)
   - Interfaces matching iMessage database schema
   - `MessageWithHandle` extends `Message` with denormalized handle data
   - All nullable fields use `T | undefined` pattern

### Key Technical Details

- **Timestamp Conversion**: Apple stores timestamps as nanoseconds since 2001-01-01. Conversion formula: `date/1000000000 + 978307200`
- **Database Path**: Hard-coded to `~/Library/Messages/chat.db` (macOS only)
- **Functional Patterns**: All database functions are pure, taking `Database` as first parameter
- **Error Handling**: Try-catch blocks in MCP tool handlers return error messages as text content

### MCP Tools

1. `search_messages` - Full-text search with date/contact filters
2. `get_recent_messages` - Latest messages across all chats
3. `get_chats` - List conversations ordered by last activity
4. `get_handles` - All contacts/phone numbers
5. `get_messages_from_chat` - Messages from specific chat GUID

## iMessage Database Schema Notes

- `message` table: Core message data
- `handle` table: Contact information (phone/email)
- `chat` table: Conversation metadata
- `chat_message_join` table: Links messages to chats
- Boolean fields stored as integers (0/1)
- GUIDs are unique identifiers for messages and chats

## Repository Management

- Always use `deno task fmt`, `deno task lint`, and `deno task check` after modifying or creating code to ensure that it's correct.
- When making changes to the available tools, ensure you always update the README.md with the relevant changes.
