/**
 * LagKonnect — Admin Management API
 */
import { _fetch } from './_fetch.js?v=20260806a';

export const adminTeam = {

  // ── Self ──────────────────────────────────────────────────────────────
  async getMe()            { return await _fetch('GET',   '/admin/me'); },
  async updateMe(data)     { return await _fetch('PATCH', '/admin/me', data); },
  async changePassword(data) { return await _fetch('PATCH', '/admin/me/password', data); },

  // ── Team (super_admin only) ───────────────────────────────────────────
  async list(opts = {}) {
    const params = new URLSearchParams();
    if (opts.page)    params.set('page',    opts.page);
    if (opts.perPage) params.set('perPage', opts.perPage);
    if (opts.search)  params.set('search',  opts.search);
    const qs = params.toString() ? `?${params}` : '';
    return await _fetch('GET', '/admin/team' + qs);
  },
  async getById(id)        { return await _fetch('GET',    '/admin/team/' + id); },
  async create(data)       { return await _fetch('POST',   '/admin/team', data); },
  async update(id, data)   { return await _fetch('PATCH',  '/admin/team/' + id, data); },
  async updateRole(id, role)   { return await _fetch('PATCH', '/admin/team/' + id + '/role',   { role }); },
  async updateStatus(id, status) { return await _fetch('PATCH', '/admin/team/' + id + '/status', { status }); },
  async remove(id)         { return await _fetch('DELETE', '/admin/team/' + id); },
};
