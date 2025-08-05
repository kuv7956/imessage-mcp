# @wyattjoh/imessage

A Deno library for read-only access to the macOS iMessage database. This package provides a clean API for searching messages, retrieving conversations, and accessing contact information from iMessage.

## Installation

```bash
deno add @wyattjoh/imessage
```

## Usage

```typescript
import {
  getRecentMessages,
  openMessagesDatabase,
  searchContactsByName,
  searchMessages,
} from "@wyattjoh/imessage";

// Open the iMessage database
const db = await openMessagesDatabase();

// Search for messages
const results = await searchMessages(db, {
  query: "hello",
  limit: 10,
});

// Get recent messages
const recent = await getRecentMessages(db, 20);

// Search contacts
const contacts = await searchContactsByName("John Smith");

// Always close the database when done
db.close();
```

## Features

- **Message Search**: Full-text search with date and contact filters
- **Recent Messages**: Retrieve the latest messages across all conversations
- **Chat Management**: List and retrieve messages from specific chats
- **Contact Integration**: Search macOS Contacts and retrieve phone/email handles
- **Type-Safe**: Full TypeScript support with comprehensive type definitions
- **Pagination**: Built-in pagination support for all queries

## API Reference

### Database

```typescript
openMessagesDatabase(): Promise<Database>
```

Opens a connection to the iMessage database.

### Messages

```typescript
searchMessages(db: Database, options: SearchOptions): Promise<PaginatedResult<MessageWithHandle>>
getRecentMessages(db: Database, limit?: number, offset?: number): Promise<PaginatedResult<MessageWithHandle>>
getMessagesFromChat(db: Database, chatGuid: string, limit?: number, offset?: number): Promise<PaginatedResult<MessageWithHandle>>
```

### Chats

```typescript
getChats(db: Database, limit?: number, offset?: number): Promise<PaginatedResult<Chat>>
```

### Handles

```typescript
getHandles(db: Database, limit?: number, offset?: number): Promise<PaginatedResult<Handle>>
```

### Contacts

```typescript
searchContactsByName(name: string): Promise<PaginatedResult<ContactInfo>>
```

## Requirements

- macOS (uses system iMessage and Contacts databases)
- Deno with appropriate permissions:
  - `--allow-read`: Access to database files
  - `--allow-env`: Environment variables
  - `--allow-ffi`: SQLite native bindings

## License

MIT
