/**
 * Represents a single iMessage/SMS message from the Messages database.
 */
export interface Message {
  guid: string;
  text: string | undefined;
  handle_id: number;
  service: string;
  date: number;
  date_read: number | undefined;
  date_delivered: number | undefined;
  is_from_me: number;
  is_read: number;
  is_sent: number;
  is_delivered: number;
  cache_has_attachments: number;
  reply_to_guid: string | undefined;
}

/**
 * Represents a contact handle (phone number or email address) from the Messages database.
 */
export interface Handle {
  ROWID: number;
  id: string;
  country: string | undefined;
  service: string;
  uncanonicalized_id: string | undefined;
}

/**
 * Represents a conversation/chat thread from the Messages database.
 */
export interface Chat {
  ROWID: number;
  guid: string;
  style: number;
  state: number;
  account_id: string | undefined;
  chat_identifier: string | undefined;
  service_name: string | undefined;
  room_name: string | undefined;
  display_name: string | undefined;
  last_read_message_timestamp: number | undefined;
}

/**
 * Represents the join table relationship between chats and messages.
 */
export interface ChatMessage {
  chat_id: number;
  message_id: number;
  message_date: number;
}

/**
 * Extends Message with denormalized handle information for convenience.
 */
export interface MessageWithHandle extends Message {
  handle_id_string: string;
  handle_country: string | undefined;
  handle_service: string;
}

/**
 * Options for searching and filtering messages.
 */
export interface SearchOptions {
  query?: string | undefined;
  handle?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

/**
 * Metadata about pagination state for result sets.
 */
export interface PaginationMetadata {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  page: number;
  totalPages: number;
}

/**
 * Generic wrapper for paginated results with metadata.
 * @template T The type of items in the result set
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMetadata;
}

/**
 * Represents contact information from the macOS AddressBook.
 */
export interface ContactInfo {
  name: string;
  phone: string;
}
