import { Database } from "@db/sqlite";
import type {
  Chat,
  Handle,
  MessageWithHandle,
  PaginatedResult,
  SearchOptions,
} from "./types.ts";
import { homedir } from "node:os";
import { join } from "node:path";

const getImessageDbPath = (): string => {
  return join(homedir(), "Library", "Messages", "chat.db");
};

export const openDatabase = (): Database => {
  const dbPath = getImessageDbPath();
  return new Database(dbPath, { readonly: true });
};

const createPaginationMetadata = (
  total: number,
  limit: number,
  offset: number,
) => {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const hasMore = offset + limit < total;

  return {
    total,
    limit,
    offset,
    hasMore,
    page,
    totalPages,
  };
};

export const searchMessages = (
  db: Database,
  options: SearchOptions = {},
): PaginatedResult<MessageWithHandle> => {
  const { query, handle, startDate, endDate, limit = 100, offset = 0 } =
    options;

  let whereClause = "WHERE 1=1";
  const params: (string | number)[] = [];

  if (query) {
    whereClause += " AND m.text LIKE ?";
    params.push(`%${query}%`);
  }

  if (handle) {
    whereClause += " AND h.id = ?";
    params.push(handle);
  }

  if (startDate) {
    const appleTimestamp = (startDate.getTime() / 1000) - 978307200;
    whereClause += " AND m.date >= ?";
    params.push(appleTimestamp * 1000000000);
  }

  if (endDate) {
    const appleTimestamp = (endDate.getTime() / 1000) - 978307200;
    whereClause += " AND m.date <= ?";
    params.push(appleTimestamp * 1000000000);
  }

  // Count total results
  const countSql = `
    SELECT COUNT(*) as total
    FROM message m
    LEFT JOIN handle h ON m.handle_id = h.ROWID
    ${whereClause}
  `;
  const countStmt = db.prepare(countSql);
  const { total } = countStmt.get(...params) as { total: number };

  // Get paginated data
  const dataSql = `
    SELECT 
      m.guid,
      m.text,
      m.handle_id,
      m.service,
      m.date/1000000000 + 978307200 as date,
      m.date_read/1000000000 + 978307200 as date_read,
      m.date_delivered/1000000000 + 978307200 as date_delivered,
      m.is_from_me,
      m.is_read,
      m.is_sent,
      m.is_delivered,
      m.cache_has_attachments,
      m.thread_originator_guid as reply_to_guid,
      h.id as handle_id_string,
      h.country as handle_country,
      h.service as handle_service
    FROM message m
    LEFT JOIN handle h ON m.handle_id = h.ROWID
    ${whereClause}
    ORDER BY m.date DESC LIMIT ? OFFSET ?
  `;

  const dataStmt = db.prepare(dataSql);
  const data = dataStmt.all(...params, limit, offset) as MessageWithHandle[];

  return {
    data,
    pagination: createPaginationMetadata(total, limit, offset),
  };
};

export const getRecentMessages = (
  db: Database,
  limit = 20,
  offset = 0,
): PaginatedResult<MessageWithHandle> => {
  return searchMessages(db, { limit, offset });
};

export const getChats = (
  db: Database,
  limit = 50,
  offset = 0,
): PaginatedResult<Chat> => {
  // Count total chats
  const countSql = "SELECT COUNT(*) as total FROM chat";
  const countStmt = db.prepare(countSql);
  const { total } = countStmt.get() as { total: number };

  // Get paginated data
  const dataSql = `
    SELECT 
      c.ROWID,
      c.guid,
      c.style,
      c.state,
      c.account_id,
      c.chat_identifier,
      c.service_name,
      c.room_name,
      c.display_name,
      c.last_read_message_timestamp
    FROM chat c
    ORDER BY c.last_read_message_timestamp DESC
    LIMIT ? OFFSET ?
  `;

  const dataStmt = db.prepare(dataSql);
  const data = dataStmt.all(limit, offset) as Chat[];

  return {
    data,
    pagination: createPaginationMetadata(total, limit, offset),
  };
};

export const getHandles = (
  db: Database,
  limit = 100,
  offset = 0,
): PaginatedResult<Handle> => {
  // Count total handles
  const countSql = "SELECT COUNT(*) as total FROM handle";
  const countStmt = db.prepare(countSql);
  const { total } = countStmt.get() as { total: number };

  // Get paginated data
  const dataSql = `
    SELECT 
      ROWID,
      id,
      country,
      service,
      uncanonicalized_id
    FROM handle
    ORDER BY id
    LIMIT ? OFFSET ?
  `;

  const dataStmt = db.prepare(dataSql);
  const data = dataStmt.all(limit, offset) as Handle[];

  return {
    data,
    pagination: createPaginationMetadata(total, limit, offset),
  };
};

export const getMessagesFromChat = (
  db: Database,
  chatGuid: string,
  limit = 50,
  offset = 0,
): PaginatedResult<MessageWithHandle> => {
  // Count total messages in chat
  const countSql = `
    SELECT COUNT(*) as total
    FROM message m
    JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
    JOIN chat c ON cmj.chat_id = c.ROWID
    WHERE c.guid = ?
  `;
  const countStmt = db.prepare(countSql);
  const { total } = countStmt.get(chatGuid) as { total: number };

  // Get paginated data
  const dataSql = `
    SELECT 
      m.guid,
      m.text,
      m.handle_id,
      m.service,
      m.date/1000000000 + 978307200 as date,
      m.date_read/1000000000 + 978307200 as date_read,
      m.date_delivered/1000000000 + 978307200 as date_delivered,
      m.is_from_me,
      m.is_read,
      m.is_sent,
      m.is_delivered,
      m.cache_has_attachments,
      m.thread_originator_guid as reply_to_guid,
      h.id as handle_id_string,
      h.country as handle_country,
      h.service as handle_service
    FROM message m
    LEFT JOIN handle h ON m.handle_id = h.ROWID
    JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
    JOIN chat c ON cmj.chat_id = c.ROWID
    WHERE c.guid = ?
    ORDER BY m.date DESC
    LIMIT ? OFFSET ?
  `;

  const dataStmt = db.prepare(dataSql);
  const data = dataStmt.all(chatGuid, limit, offset) as MessageWithHandle[];

  return {
    data,
    pagination: createPaginationMetadata(total, limit, offset),
  };
};
