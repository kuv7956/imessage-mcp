#!/usr/bin/env -S deno run --allow-read --allow-env --allow-sys --allow-run --allow-ffi

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  getChats,
  getHandles,
  getMessagesFromChat,
  getRecentMessages,
  openContactsDatabases,
  openMessagesDatabase,
  searchContactsByName,
  searchMessages,
} from "@wyattjoh/imessage";
import deno from "../deno.json" with { type: "json" };

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
  firstName: z
    .string()
    .min(1)
    .describe(
      "First name to search for (e.g., 'John'). Returns phone numbers that can be used as the 'handle' parameter in 'search_messages'.",
    ),
  lastName: z
    .string()
    .optional()
    .describe(
      "Last name to search for (e.g., 'Smith'). Optional - if omitted, searches across all fields.",
    ),
  limit: z
    .number()
    .min(1)
    .max(200)
    .default(50)
    .describe("Maximum number of contacts to return (1-200, default: 50)"),
  offset: z
    .number()
    .min(0)
    .default(0)
    .describe("Number of contacts to skip for pagination (default: 0)"),
});

const LookupContactByHandleSchema = z.object({
  handle: z
    .string()
    .min(1)
    .describe(
      "Phone number (e.g., '+15551234567') or email address to lookup contact name for.",
    ),
});

const lookupContactByHandle = (contactsDatabases: any[], handle: string) => {
  for (const db of contactsDatabases) {
    const phoneQuery = db.prepare(`
      SELECT DISTINCT 
        r.ZFIRSTNAME as firstName,
        r.ZLASTNAME as lastName,
        r.ZORGANIZATION as organization,
        (CASE 
          WHEN r.ZFIRSTNAME IS NOT NULL AND r.ZLASTNAME IS NOT NULL 
          THEN r.ZFIRSTNAME || ' ' || r.ZLASTNAME
          WHEN r.ZFIRSTNAME IS NOT NULL 
          THEN r.ZFIRSTNAME
          WHEN r.ZLASTNAME IS NOT NULL 
          THEN r.ZLASTNAME
          WHEN r.ZORGANIZATION IS NOT NULL 
          THEN r.ZORGANIZATION
          ELSE 'Unknown Contact'
        END) as displayName
      FROM ZABCDRECORD r
      JOIN ZABCDPHONENUMBER p ON r.Z_PK = p.ZOWNER
      WHERE p.ZFULLNUMBER = ?
      LIMIT 1
    `);
    
    let result = phoneQuery.get(handle);
    phoneQuery.finalize();
    
    if (!result && handle.includes('@')) {
      const emailQuery = db.prepare(`
        SELECT DISTINCT 
          r.ZFIRSTNAME as firstName,
          r.ZLASTNAME as lastName,
          r.ZORGANIZATION as organization,
          (CASE 
            WHEN r.ZFIRSTNAME IS NOT NULL AND r.ZLASTNAME IS NOT NULL 
            THEN r.ZFIRSTNAME || ' ' || r.ZLASTNAME
            WHEN r.ZFIRSTNAME IS NOT NULL 
            THEN r.ZFIRSTNAME
            WHEN r.ZLASTNAME IS NOT NULL 
            THEN r.ZLASTNAME
            WHEN r.ZORGANIZATION IS NOT NULL 
            THEN r.ZORGANIZATION
            ELSE 'Unknown Contact'
          END) as displayName
        FROM ZABCDRECORD r
        JOIN ZABCDEMAILADDRESS e ON r.Z_PK = e.ZOWNER
        WHERE e.ZADDRESS = ?
        LIMIT 1
      `);
      
      result = emailQuery.get(handle);
      emailQuery.finalize();
    }
    
    if (result) {
      return {
        data: [{
          handle: handle,
          firstName: result.firstName || null,
          lastName: result.lastName || null,
          organization: result.organization || null,
          displayName: result.displayName,
          found: true
        }],
        pagination: {
          total: 1,
          limit: 1,
          offset: 0,
          hasMore: false,
          page: 1,
          totalPages: 1
        }
      };
    }
  }
  
  return {
    data: [{
      handle: handle,
      firstName: null,
      lastName: null,
      organization: null,
      displayName: null,
      found: false
    }],
    pagination: {
      total: 0,
      limit: 1,
      offset: 0,
      hasMore: false,
      page: 1,
      totalPages: 0
    }
  };
};

const createServer = () => {
  const server = new McpServer({
    name: "imessage",
    version: deno.version,
    capabilities: {
      resources: {},
      tools: {},
    },
  });

  const messagesDatabase = openMessagesDatabase();
  const contactsDatabases = openContactsDatabases();

  server.tool(
    "search_messages",
    "Search iMessage messages with various filters. Handle parameter accepts phone numbers ('+15551234'), email addresses, or contact names - the format depends on your system configuration. Use 'lookup_contact_by_handle' to identify unknown handles or 'search_contacts' to find handles by name. CRITICAL: Results are paginated - for summaries, analysis, or complete conversation history, you MUST paginate through ALL results by checking 'hasMore' field and using 'offset' parameter until hasMore=false. Partial data will lead to incomplete analysis.",
    SearchMessagesSchema.shape,
    (args) => {
      try {
        const options = {
          query: args.query,
          handle: args.handle,
          startDate: args.startDate ? new Date(args.startDate) : undefined,
          endDate: args.endDate ? new Date(args.endDate) : undefined,
          limit: args.limit,
          offset: args.offset,
        };

        const result = searchMessages(messagesDatabase, options);

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
        const result = getRecentMessages(
          messagesDatabase,
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
        const result = getChats(messagesDatabase, args.limit, args.offset);

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
        const result = getHandles(messagesDatabase, args.limit, args.offset);

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
        const result = getMessagesFromChat(
          messagesDatabase,
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
    "Search for contacts by first name and optional last name. Use this FIRST when searching for messages from a specific person - it returns the phone number that can be used as the 'handle' parameter in 'search_messages'. Example: search for firstName='John' lastName='Smith' to get his phone number, then use that phone number in search_messages. If lastName is omitted, searches across all fields. CRITICAL: Results are paginated - for complete contact search results, check 'hasMore' field and use 'offset' parameter until hasMore=false.",
    SearchContactsSchema.shape,
    (args) => {
      try {
        const result = searchContactsByName(
          contactsDatabases,
          args.firstName,
          args.lastName,
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
              text: `Error searching contacts: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    },
  );

  server.tool(
    "lookup_contact_by_handle",
    "Lookup contact name and details by phone number or email address. This is the reverse of 'search_contacts' - instead of searching by name to get phone numbers, this searches by phone number/email to get the contact name. Useful for identifying who sent messages when you have their handle but not their name.",
    LookupContactByHandleSchema.shape,
    (args) => {
      try {
        const result = lookupContactByHandle(contactsDatabases, args.handle);

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
              text: `Error looking up contact: ${
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
    const messagesDatabase = openMessagesDatabase();

    // Perform a simple query to ensure actual database access
    const handles = getHandles(messagesDatabase);
    console.error(
      `Database access successful. Found ${handles.data.length} handles.`,
    );

    // Close the initial connection as it will be reopened lazily when needed
    messagesDatabase.close();
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
    const contactsDatabases = openContactsDatabases();
    const testContacts = searchContactsByName(
      contactsDatabases,
      "test",
      undefined,
    );
    const testHandlePhone = lookupContactByHandle(contactsDatabases, "test");
    const testHandleEmail = lookupContactByHandle(contactsDatabases, "test");
    console.error(
      `Search test returned ${testContacts.data.length} results.`,
      `Reverse phone search test returned ${testHandlePhone.data.length} results.`,
      `Reverse email search test returned ${testHandleEmail.data.length} results.`,
      `A succesful test finds exactly one empty object for each test.`
    );
    // Close test databases
    for (const db of contactsDatabases) {
      db.close();
    }
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