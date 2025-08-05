// Export all public APIs from the imessage package
export {
  convertAppleTimestamp,
  decodeAttributedBody,
  getChats,
  getHandles,
  getMessagesFromChat,
  getRecentMessages,
  openMessagesDatabase,
  searchMessages,
} from "./src/messages.ts";

export { openContactsDatabases, searchContactsByName } from "./src/contacts.ts";

export type {
  Chat,
  ContactInfo,
  Handle,
  Message,
  MessageWithHandle,
  PaginatedResult,
  SearchOptions,
} from "./src/types.ts";
