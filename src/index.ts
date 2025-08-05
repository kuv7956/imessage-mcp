#!/usr/bin/env -S deno run --allow-read --allow-env --allow-sys --allow-run --allow-ffi

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  getChats,
  getHandles,
  getMessagesFromChat,
  getRecentMessages,
  openDatabase,
  searchMessages,
} from "./database.ts";
import { searchContactsByName } from "./contacts.ts";
import type { Database } from "@db/sqlite";
import deno from "../deno.json" with { type: "json" };

/**
 * Common Usage Workflows:
 *
 * 1. Find messages from a specific person:
 *    - search_contacts({ name: "John Smith" }) → get phone number
 *    - search_messages({ handle: "+15551234" }) → get messages
 *
 * 2. Get recent activity:
 *    - get_recent_messages({ limit: 20, offset: 0 }) → latest messages across all chats
 *
 * 3. Browse conversations:
 *    - get_chats({ limit: 10, offset: 0 }) → get chat GUIDs
 *    - get_messages_from_chat({ chatGuid: "...", limit: 50, offset: 0 }) → get specific chat messages
 *
 * 4. Search with time range:
 *    - search_messages({
 *        query: "meeting",
 *        startDate: "2025-08-04T00:00:00.000Z",
 *        endDate: "2025-08-05T00:00:00.000Z"
 *      })
 *
 * PAGINATION BEST PRACTICES:
 * All tools return paginated results with this structure:
 * {
 *   "data": [...],
 *   "pagination": {
 *     "total": 176,
 *     "limit": 100,
 *     "offset": 0,
 *     "hasMore": true,
 *     "page": 1,
 *     "totalPages": 2
 *   }
 * }
 *
 * CRITICAL: For analysis, summaries, or complete data needs:
 * 1. ALWAYS check the "hasMore" field in the response
 * 2. If hasMore is true, you MUST make additional requests with offset incremented by limit
 * 3. Continue until hasMore is false to ensure complete data
 * 4. Partial data will lead to incomplete/misleading analysis
 *
 * Example: To get ALL messages from last 24 hours (not just first 100):
 * - First call: search_messages({ startDate: "...", limit: 100, offset: 0 })
 * - If hasMore: true, second call: search_messages({ startDate: "...", limit: 100, offset: 100 })
 * - Continue until hasMore: false (this ensures you get all 176 messages, not just 100)
 */

const SearchMessagesSchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Full-text search query to find in message content"),
  handle: z
    .string()
    .optional()
    .describe(
      "Phone number (e.g., '+15551234') or email address to filter messages from specific contact. Get this from 'search_contacts' tool.",
    ),
  startDate: z
    .string()
    .datetime()
    .optional()
    .describe(
      "ISO datetime string (e.g., '2025-08-04T07:37:39.000Z') - only return messages after this date",
    ),
  endDate: z
    .string()
    .datetime()
    .optional()
    .describe("ISO datetime string - only return messages before this date"),
  limit: z
    .number()
    .min(1)
    .max(200)
    .default(100)
    .describe("Maximum number of messages to return (1-200, default: 100)"),
  offset: z
    .number()
    .min(0)
    .default(0)
    .describe("Number of messages to skip for pagination (default: 0)"),
});

const GetRecentMessagesSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(100)
    .default(20)
    .describe(
      "Maximum number of recent messages to return (1-100, default: 20)",
    ),
  offset: z
    .number()
    .min(0)
    .default(0)
    .describe("Number of messages to skip for pagination (default: 0)"),
});

const GetChatsSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(200)
    .default(50)
    .describe("Maximum number of chats to return (1-200, default: 50)"),
  offset: z
    .number()
    .min(0)
    .default(0)
    .describe("Number of chats to skip for pagination (default: 0)"),
});

const GetMessagesFromChatSchema = z.object({
  chatGuid: z
    .string()
    .describe("Chat GUID identifier (obtained from 'get_chats' tool)"),
  limit: z
    .number()
    .min(1)
    .max(200)
    .default(50)
    .describe(
      "Maximum number of messages to return from this chat (1-200, default: 50)",
    ),
  offset: z
    .number()
    .min(0)
    .default(0)
    .describe("Number of messages to skip for pagination (default: 0)"),
});

const GetHandlesSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(200)
    .default(100)
    .describe("Maximum number of handles to return (1-200, default: 100)"),
  offset: z
    .number()
    .min(0)
    .default(0)
    .describe("Number of handles to skip for pagination (default: 0)"),
});

const SearchContactsSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe(
      "Contact name to search for (e.g., 'John Smith'). Returns phone numbers that can be used as the 'handle' parameter in 'search_messages'.",
    ),
});

const createServer = () => {
  const server = new McpServer({
    name: "imessage",
    version: deno.version,
    capabilities: {
      resources: {},
      tools: {},
    },
  });

  let db: Database | undefined;

  const ensureDatabase = (): Database => {
    if (!db) {
      db = openDatabase();
    }
    return db;
  };

  server.tool(
    "search_messages",
    "Search iMessage messages with various filters. Use 'search_contacts' first to get handle IDs for specific contacts. Handle parameter accepts phone numbers like '+15551234' or email addresses, NOT contact names. CRITICAL: Results are paginated - for summaries, analysis, or complete conversation history, you MUST paginate through ALL results by checking 'hasMore' field and using 'offset' parameter until hasMore=false. Partial data will lead to incomplete analysis.",
    SearchMessagesSchema.shape,
    (args) => {
      try {
        const database = ensureDatabase();
        const options = {
          query: args.query,
          handle: args.handle,
          startDate: args.startDate ? new Date(args.startDate) : undefined,
          endDate: args.endDate ? new Date(args.endDate) : undefined,
          limit: args.limit,
          offset: args.offset,
        };

        const result = searchMessages(database, options);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching messages: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    },
  );

  server.tool(
    "get_recent_messages",
    "Get the most recent iMessages across all conversations, ordered by date (newest first). CRITICAL: Results are paginated - for comprehensive analysis or complete recent activity overview, you MUST paginate through ALL results by checking 'hasMore' field and using 'offset' parameter until hasMore=false.",
    GetRecentMessagesSchema.shape,
    (args) => {
      try {
        const database = ensureDatabase();
        const result = getRecentMessages(database, args.limit, args.offset);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting recent messages: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    },
  );

  server.tool(
    "get_chats",
    "Get list of iMessage chats/conversations ordered by most recent activity. Returns chat GUIDs that can be used with 'get_messages_from_chat'. CRITICAL: Results are paginated - for complete chat listing or comprehensive conversation overview, you MUST paginate through ALL results by checking 'hasMore' field and using 'offset' parameter until hasMore=false.",
    GetChatsSchema.shape,
    (args) => {
      try {
        const database = ensureDatabase();
        const result = getChats(database, args.limit, args.offset);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting chats: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    },
  );

  server.tool(
    "get_handles",
    "Get list of all contacts/handles (phone numbers, email addresses) that have sent or received iMessages. Returns handle IDs that can be used with 'search_messages'. CRITICAL: Results are paginated - for complete contact listing or comprehensive handle overview, you MUST paginate through ALL results by checking 'hasMore' field and using 'offset' parameter until hasMore=false.",
    GetHandlesSchema.shape,
    (args) => {
      try {
        const database = ensureDatabase();
        const result = getHandles(database, args.limit, args.offset);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting handles: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    },
  );

  server.tool(
    "get_messages_from_chat",
    "Get messages from a specific chat/conversation using the chat GUID (obtained from 'get_chats'). Returns messages ordered by date (newest first). CRITICAL: Results are paginated - for complete chat history, conversation analysis, or summaries, you MUST paginate through ALL results by checking 'hasMore' field and using 'offset' parameter until hasMore=false. Partial data will lead to incomplete analysis.",
    GetMessagesFromChatSchema.shape,
    (args) => {
      try {
        const database = ensureDatabase();
        const result = getMessagesFromChat(
          database,
          args.chatGuid,
          args.limit,
          args.offset,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting messages from chat: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    },
  );

  server.tool(
    "search_contacts",
    "Search for contacts by name and retrieve their phone numbers. Use this FIRST when searching for messages from a specific person - it returns the phone number that can be used as the 'handle' parameter in 'search_messages'. Example: search for 'John Smith' to get his phone number, then use that phone number in search_messages.",
    SearchContactsSchema.shape,
    async (args) => {
      try {
        const contacts = await searchContactsByName(args.name);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(contacts, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching contacts: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    },
  );

  return server;
};

const main = async () => {
  const transport = new StdioServerTransport();
  const server = createServer();

  // Attempt to access the database on startup to trigger security prompt
  try {
    console.error("Attempting to access iMessage database...");
    const db = openDatabase();

    // Perform a simple query to ensure actual database access
    const testQuery = db.prepare(
      "SELECT COUNT(*) as count FROM message LIMIT 1",
    );
    const result = testQuery.get() as { count: number };
    console.error(
      `Database access successful. Found ${result.count} messages.`,
    );

    // Test handle table access for contacts functionality
    const handleQuery = db.prepare(
      "SELECT COUNT(*) as count FROM handle LIMIT 1",
    );
    const handleResult = handleQuery.get() as { count: number };
    console.error(
      `Handle table access successful. Found ${handleResult.count} handles.`,
    );

    // Close the initial connection as it will be reopened lazily when needed
    db.close();
  } catch (error) {
    console.error(
      "Database access failed:",
      error instanceof Error ? error.message : String(error),
    );
    console.error(
      "Please grant access to the iMessage database when prompted.",
    );
  }

  // Test contacts functionality on startup
  try {
    console.error("Testing contacts database integration...");
    const testContacts = await searchContactsByName("test");
    console.error(
      `Contacts integration successful. Search test returned ${testContacts.length} results.`,
    );
  } catch (error) {
    console.error(
      "Contacts integration test failed:",
      error instanceof Error ? error.message : String(error),
    );
    console.error(
      "Contacts search may not work properly. Check macOS Contacts access permissions.",
    );
  }

  await server.connect(transport);
  console.error("iMessage MCP Server running on stdio");
};

main().catch((error) => {
  console.error("Fatal error in main():", error);
  Deno.exit(1);
});
