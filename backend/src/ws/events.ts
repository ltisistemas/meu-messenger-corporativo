export const WS_EVENTS = {
  // Connection / Session
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  AUTHENTICATED: 'authenticated',
  ERROR: 'error',

  // Presence
  PRESENCE_ONLINE: 'presence:online',
  PRESENCE_OFFLINE: 'presence:offline',
  PRESENCE_QUERY: 'presence:query',
  PRESENCE_STATUS: 'presence:status',

  // Messaging
  MESSAGE_SEND: 'message:send',
  MESSAGE_NEW: 'message:new',
  MESSAGE_RECEIPT: 'message:receipt',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',

  // Files & Relay (Free Plan)
  FILE_RELAY_INIT: 'file:relay:init',
  FILE_RELAY_INCOMING: 'file:relay:incoming',
  FILE_RELAY_CHUNK: 'file:relay:chunk',
  FILE_RELAY_ACK: 'file:relay:ack',
  FILE_RELAY_COMPLETE: 'file:relay:complete',
  FILE_RELAY_ERROR: 'file:relay:error',
  FILE_RELAY_CANCEL: 'file:relay:cancel',

  // Group / System
  CONVERSATION_JOIN: 'conversation:join',
  CONVERSATION_LEAVE: 'conversation:leave',
  CONVERSATION_ARCHIVED: 'conversation:archived',
  CONVERSATION_DELETED: 'conversation:deleted',

  // Polls (Pro / Enterprise - T-26)
  POLL_NEW: 'poll:new',
  POLL_UPDATED: 'poll:updated',
  POLL_CLOSED: 'poll:closed',
} as const;

export type WsEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

export interface SocketUserPayload {
  userId: string;
  accountId: string;
  role: string;
  email: string;
}
