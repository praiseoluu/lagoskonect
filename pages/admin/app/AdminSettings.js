/**
 * KTG Connect Admin — Platform Settings
 * Route: /admin/settings
 * Guards: requireAdmin
 */

import { AdminLayout }           from '../../../components/layout/BaseLayout.js';
import { Tabs, Toggle }          from '../../../components/base/UI.js';
import { showToast, setPageLoading } from '../../../core/store.js';
import { api }                   from '../../../api/client.js';
import { savePrefs, loadPrefs }  from '../../../utils/storage.js';

const PLATFORM_CONFIGS = [
  {
    key:    'maintenanceMode',
    apiKey: 'maintenanceMode',
    label:  'Maintenance Mode',
    desc:   'Take the platform offline. Citizens will see a maintenance message.',
    danger: true,
    defaultOn: false,
  },
  {
    key:    'allowRegistrations',
    apiKey: 'allowRegistrations',
    label:  'Allow New Registrations',
    desc:   'When off, new citizens cannot create accounts.',
  },
  {
    key:    'chatEnabled',
    apiKey: 'chatEnabled',
    label:  'Enable Community Chat',
    desc:   'Allow citizens to send messages in the community chat.',
  },
  {
    key:    'reelsEnabled',
    apiKey: 'reelsEnabled',
    label:  'Enable Reels',
    desc:   'Show the Reels section to citizens. Disabling hides the feed and blocks uploads.',
  },
  {
    key:    'advertsEnabled',
    apiKey: 'advertsEnabled',
    label:  'Show Adverts to Citizens',
    desc:   'Display active ad campaigns in the citizen app.',
  },
];

const NOTIF_CONFIGS = [
  {
    key:     'notif_flagged',
    label:   'Flagged Content Alerts',
    desc:    'Get notified when a reel is reported by citizens.',
    default: true,
  },
  {
    key:     'notif_new_users',
    label:   'New Citizen Registrations',
    desc:    'Alert when a new citizen creates an account.',
    default: false,
  },
  {
    key:     'notif_system',
    label:   'System-wide Alerts',
    desc:    'Notifications for security breaches or system downtime.',
    default: true,
  },
  {
    key:        'notif_weekly',
    label:      'Weekly Analytics Summary',
    desc:       'Receive a weekly engagement report by email.',
    default:    false,
    comingSoon: true,
  },
  {
    key:        'notif_email_flagged',
    label:      'Email: Flagged Content',
    desc:       'Send an email when content is flagged. Requires Resend API key.',
    default:    false,
    comingSoon: true,
  },
];

const TABS = [
  { key: 'platform',      label: 'Platform Config'   },
  { key: 'notifications', label: 'Notifications'      },
];

export default class AdminSettingsPage extends AdminLayout {
  static styles = '/pages/admin/app/AdminSettings.css';

  constructor(props) {
    super({
      title: 'Platform Settings',
      breadcrumbs: [
        { label: 'Dashboard', path: '/admin' },
        { label: 'Settings' },
      ],
      ...props,
    });
    this.state      = { activeTab: 'platform' };
    this._settings  = {};
    this._prefs     = loadPrefs();
  }

  getContent() {
    return '<div id="admin-settings-inner" class="admin-settings-page"></div>';
  }

  async onContentReady() {
    setPageLoading(true);
    const res = await api.platformSettings.get();
    if (res.data) this._settings = res.data;
    setPageLoading(false);
    this._render();
  }

  _render() {
    const inner = document.getElementById('admin-settings-inner');
    if (!inner) return;

    inner.innerHTML =
        '<div class="as-page-header">' +
        '<h1 class="as-page-header__title">Platform Settings</h1>' +
        '<p class="as-page-header__sub">Control platform features and notification preferences.</p>' +
        '</div>' +
        '<div id="settings-tabs-mount"></div>' +
        '<div id="settings-content"></div>';

    const tabs = this.addChild(new Tabs({
      tabs:      TABS,
      activeKey: this.state.activeTab,
      onChange:  (key) => {
        this.state.activeTab = key;
        // Remove all non-Tab children so toggles don't accumulate
        this._children = this._children.filter(c => c instanceof Tabs);
        this._renderTabContent();
      },
    }));
    tabs.mount(inner.querySelector('#settings-tabs-mount'));

    this._renderTabContent();
  }

  _renderTabContent() {
    const content = document.getElementById('settings-content');
    if (!content) return;
    content.innerHTML = '';

    if (this.state.activeTab === 'platform')      this._renderPlatform(content);
    if (this.state.activeTab === 'notifications') this._renderNotifications(content);
  }

  // ── Platform Config ───────────────────────────────────────────────────────

  _renderPlatform(container) {
    const s = this._settings;

    const getValue = (cfg) => {
      if (cfg.key === 'maintenanceMode')   return s.maintenanceMode   === '1';
      if (cfg.key === 'allowRegistrations') return s.allowRegistrations !== '0';
      if (cfg.key === 'chatEnabled')        return s.chatEnabled        !== '0';
      if (cfg.key === 'reelsEnabled')       return s.reelsEnabled       !== '0';
      if (cfg.key === 'advertsEnabled')     return s.advertsEnabled     !== '0';
      return false;
    };

    container.innerHTML =
        '<div class="settings-section">' +
        '<div class="settings-section__header">' +
        '<p class="settings-section__title">Platform Configuration</p>' +
        '</div>' +
        PLATFORM_CONFIGS.map(c =>
            '<div class="settings-row' + (c.danger ? ' settings-row--danger' : '') + '">' +
            '<div class="settings-row__label-group">' +
            '<span class="settings-row__label">' + this.esc(c.label) + '</span>' +
            '<span class="settings-row__desc">'  + this.esc(c.desc)  + '</span>' +
            '</div>' +
            '<div id="cfg-' + c.key + '"></div>' +
            '</div>'
        ).join('') +
        '</div>';

    PLATFORM_CONFIGS.forEach(cfg => {
      const toggle = this.addChild(new Toggle({
        checked:  getValue(cfg),
        onChange: async (val) => {
          const res = await api.platformSettings.update({ [cfg.apiKey]: val });
          if (res.error) {
            showToast('error', 'Failed to save setting.');
            this._children = this._children.filter(c => c instanceof Tabs);
            this._renderTabContent();
            return;
          }
          this._settings = res.data;
          showToast('success', cfg.label + ' ' + (val ? 'enabled.' : 'disabled.'));
        },
      }));
      toggle.mount(container.querySelector('#cfg-' + cfg.key));
    });
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  _renderNotifications(container) {
    container.innerHTML =
        '<div class="settings-section">' +
        '<div class="settings-section__header">' +
        '<p class="settings-section__title">Notification Preferences</p>' +
        '</div>' +
        NOTIF_CONFIGS.map(c =>
            '<div class="settings-row">' +
            '<div class="settings-row__label-group">' +
            '<span class="settings-row__label">' + this.esc(c.label) + '</span>' +
            '<span class="settings-row__desc">'  + this.esc(c.desc)  + '</span>' +
            '</div>' +
            (c.comingSoon
                    ? '<span class="settings-coming-soon">Coming soon</span>'
                    : '<div id="notif-' + c.key + '"></div>'
            ) +
            '</div>'
        ).join('') +
        '</div>';

    NOTIF_CONFIGS.filter(c => !c.comingSoon).forEach(cfg => {
      const toggle = this.addChild(new Toggle({
        checked:  this._prefs[cfg.key] !== undefined ? this._prefs[cfg.key] : cfg.default,
        onChange: (val) => {
          savePrefs({ [cfg.key]: val });
          showToast('success', cfg.label + ' ' + (val ? 'enabled.' : 'disabled.'));
        },
      }));
      toggle.mount(container.querySelector('#notif-' + cfg.key));
    });
  }
}