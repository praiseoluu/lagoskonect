/**
 * Lagos East Connect - East Region Community Chat
 * ============================================================
 * Extends SharedChatPage with the East-region profile URL prefix.
 */
import SharedChatPage from '../app/SharedChat.js?v=20260806a';

export default class EastChatPage extends SharedChatPage {
  _profileUrl(username) { return `/east/u/${encodeURIComponent(username)}`; }
}
