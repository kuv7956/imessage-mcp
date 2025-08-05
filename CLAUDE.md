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

This is a Model Context Protocol (MCP) server that provides read-only access to the macOS iMessage database. The codebase follows functional programming principles with no classes.

### Core Components

1. **MCP Server Layer** (`src/index.ts`)
   - Creates MCP server instance using `@modelcontextprotocol/sdk`
   - Defines 6 tools with Zod schemas for validation
   - Uses StdioServerTransport for communication
   - Lazy database initialization pattern

2. **Messages Database Layer** (`src/messages.ts`)
   - Pure functions for all database operations
   - Direct SQLite access to `~/Library/Messages/chat.db`
   - Handles Apple's timestamp format (Core Data epoch: nanoseconds since 2001-01-01)
   - All queries are read-only with parameterized SQL
   - Implements pagination with metadata for all queries

3. **Contacts Integration** (`src/contacts.ts`)
   - Direct SQLite access to `~/Library/Application Support/AddressBook/Sources/*/AddressBook-v22.abcddb`
   - Searches multiple AddressBook databases for comprehensive results
   - Phone number normalization (adds +1 prefix for 10-digit US numbers)
   - Returns both phone numbers and email addresses as potential iMessage handles

4. **Type System** (`src/types.ts`)
   - Interfaces matching iMessage database schema
   - `MessageWithHandle` extends `Message` with denormalized handle data
   - All nullable fields use `T | undefined` pattern
   - `PaginatedResult<T>` wrapper for all paginated responses

### Key Technical Details

- **Timestamp Conversion**: Apple stores timestamps as nanoseconds since 2001-01-01. Conversion formula: `date/1000000000 + 978307200`
- **Database Paths**:
  - Messages: `~/Library/Messages/chat.db`
  - Contacts: `~/Library/Application Support/AddressBook/Sources/*/AddressBook-v22.abcddb`
- **Functional Patterns**: All database functions are pure, taking `Database` as first parameter
- **Error Handling**: Try-catch blocks in MCP tool handlers return error messages as text content
- **Pagination**: All tools support limit/offset pagination and return hasMore flag for complete data retrieval

### MCP Tools

1. `search_messages` - Full-text search with date/contact filters
2. `get_recent_messages` - Latest messages across all chats
3. `get_chats` - List conversations ordered by last activity
4. `get_handles` - All contacts/phone numbers
5. `get_messages_from_chat` - Messages from specific chat GUID
6. `search_contacts` - Search macOS Contacts by name, returns phone/email handles

### Important Pagination Note

All tools return paginated results. When performing analysis or summaries, ALWAYS check the `hasMore` field in the pagination metadata and continue fetching until `hasMore` is false to ensure complete data.

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
