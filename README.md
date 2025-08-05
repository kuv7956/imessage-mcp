# iMessage MCP Server

A Model Context Protocol (MCP) server for reading iMessage data from macOS. This server provides tools to search and retrieve messages, chats, and contacts from the local iMessage database.

## Features

- Search messages by text content, contact, or date range
- Get recent messages
- List all chats/conversations
- Get all contacts/handles
- Retrieve messages from specific chats
- Search macOS Contacts by name with iMessage handle ID correlation

## Prerequisites

- macOS (iMessage is only available on macOS)
- Deno runtime
- Read access to `~/Library/Messages/chat.db`
- Read access to `~/Library/Application Support/AddressBook/` (for contacts search)

## Installation

### Option 1: Using JSR (Recommended)

You can run the MCP server directly from JSR without cloning the repository:

```bash
# Run directly from JSR
deno run --allow-read --allow-env --allow-sys --allow-ffi jsr:@wyattjoh/imessage-mcp

# Or install globally
deno install --global --allow-read --allow-env --allow-sys --allow-ffi -n imessage-mcp jsr:@wyattjoh/imessage-mcp
```

For Claude Desktop app integration, add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "imessage": {
      "command": "deno",
      "args": [
        "run",
        "--allow-read",
        "--allow-env",
        "--allow-sys",
        "--allow-ffi",
        "jsr:@wyattjoh/imessage-mcp"
      ]
    }
  }
}
```

### Option 2: From Source

1. Clone this repository
2. Install dependencies:
   ```bash
   deno cache src/index.ts
   ```
3. Run the server:
   ```bash
   deno run --allow-read --allow-env --allow-sys --allow-ffi src/index.ts
   # Or use the task:
   deno task start
   ```

### Available Tools

1. **search_messages** - Search messages with filters
   - `query` (optional): Text to search for
   - `handle` (optional): Phone number or email to filter by
   - `startDate` (optional): ISO datetime string for start date
   - `endDate` (optional): ISO datetime string for end date
   - `limit` (optional): Maximum results (1-200, default: 100)
   - `offset` (optional): Pagination offset (default: 0)

2. **get_recent_messages** - Get the most recent messages
   - `limit` (optional): Number of messages (1-100, default: 20)
   - `offset` (optional): Pagination offset (default: 0)

3. **get_chats** - List all conversations
   - `limit` (optional): Number of chats (1-200, default: 50)
   - `offset` (optional): Pagination offset (default: 0)

4. **get_handles** - Get all contacts/handles
   - `limit` (optional): Number of handles (1-200, default: 100)
   - `offset` (optional): Pagination offset (default: 0)

5. **get_messages_from_chat** - Get messages from a specific chat
   - `chatGuid` (required): The chat GUID
   - `limit` (optional): Number of messages (1-200, default: 50)
   - `offset` (optional): Pagination offset (default: 0)

6. **search_contacts** - Search macOS Contacts by name and get phone numbers
   - `firstName` (required): First name to search for (e.g., 'John')
   - `lastName` (optional): Last name to search for (e.g., 'Smith'). If omitted, searches across all name fields
   - `limit` (optional): Maximum results (1-200, default: 50)
   - `offset` (optional): Pagination offset (default: 0)
   - Returns contact info with phone numbers and email addresses that can be used as handle parameters
   - Searches directly in the macOS AddressBook database for better performance and reliability

### Pagination Examples

All tools now support pagination using `limit` and `offset` parameters and return pagination metadata:

```javascript
// Get first 20 recent messages
get_recent_messages({ limit: 20, offset: 0 });

// Get next 20 recent messages (page 2)
get_recent_messages({ limit: 20, offset: 20 });

// Get first 10 chats
get_chats({ limit: 10, offset: 0 });

// Get messages 51-100 from a specific chat
get_messages_from_chat({
  chatGuid: "iMessage;-;+15551234",
  limit: 50,
  offset: 50,
});

// Search with pagination
search_messages({
  query: "meeting",
  limit: 100,
  offset: 200,
});

// Search contacts with pagination
search_contacts({
  firstName: "John",
  lastName: "Smith",
  limit: 50,
  offset: 0,
});
```

#### Response Format with Pagination Metadata

All paginated tools now return responses in this format:

```json
{
  "data": [
    // Array of results (messages, chats, handles, etc.)
  ],
  "pagination": {
    "total": 1250, // Total number of results available
    "limit": 100, // Current page size
    "offset": 200, // Current offset
    "hasMore": true, // Whether there are more results to fetch
    "page": 3, // Current page number (1-indexed)
    "totalPages": 13 // Total number of pages
  }
}
```

This metadata helps you:

- Know the total number of results without fetching all of them
- Determine if there are more pages to fetch (`hasMore`)
- Calculate which page you're on and how many pages exist
- Build proper pagination UI components

## Security Notes

- This server runs with read-only access to the iMessage database
- No messages can be sent or modified
- The server only accesses local data

## Development

```bash
# Run in watch mode
deno task dev

# Format code
deno task fmt

# Lint code
deno task lint

# Type check
deno task check

# Build standalone binary
deno task build
```

## License

MIT
