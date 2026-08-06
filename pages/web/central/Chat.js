/**
 * KTG Connect - Central Region Community Chat
 * ============================================================
 * Extends SharedChatPage with the Central region profile URL prefix.
 */
import SharedChatPage from '../app/SharedChat.js?v=20260806c';

export default class CentralChatPage extends SharedChatPage {
  _profileUrl(username) { return `/central/u/${encodeURIComponent(username)}`; }
}
