/**
 * Lagos Konnect - West Region Community Chat
 * ============================================================
 * Extends SharedChatPage with:
 *  • Voice note recording (MediaRecorder)
 *  • West-region profile URL prefix (/west/u/)
 */
import SharedChatPage from '../app/SharedChat.js?v=20260806b';

export default class WestChatPage extends SharedChatPage {
  get _hasVoiceNotes() { return true; }
  _profileUrl(username) { return `/west/u/${encodeURIComponent(username)}`; }
}
