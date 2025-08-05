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

export interface Handle {
  ROWID: number;
  id: string;
  country: string | undefined;
  service: string;
  uncanonicalized_id: string | undefined;
}

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

export interface ChatMessage {
  chat_id: number;
  message_id: number;
  message_date: number;
}

export interface MessageWithHandle extends Message {
  handle_id_string: string;
  handle_country: string | undefined;
  handle_service: string;
}

export interface SearchOptions {
  query?: string | undefined;
  handle?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface PaginationMetadata {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  page: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMetadata;
}

export interface ContactInfo {
  name: string;
  phone: string;
}
