/**
 * Lagos Konect — Table Component
 * ============================================================
 * Full-featured data table covering every common admin list view.
 *
 * Features:
 *   • Sortable column headers with tri-state icons
 *     (default → ascending → descending)
 *   • Built-in smart pagination with ellipsis compression
 *   • Per-row action buttons with danger variant support
 *   • Clickable row support (optional)
 *   • Shimmer skeleton loading state (5-row placeholder)
 *   • Empty state with configurable title and message
 *   • Horizontal scroll on narrow viewports
 *   • Full ARIA wiring (aria-sort, aria-current, aria-label)
 *
 * Usage:
 *   const table = new Table({
 *     columns: [
 *       { key: 'name',   label: 'Name',   sortable: true },
 *       { key: 'status', label: 'Status',
 *         render: (val) => Badge.html(val, Badge.variantFor(val)) },
 *       { key: 'phone',  label: 'Phone' },
 *     ],
 *     data:       rows,
 *     pagination: { page: 1, perPage: 20, total: 84, totalPages: 5 },
 *     onSort:       (key, dir)  => reload(key, dir),
 *     onPageChange: (page)      => reload(page),
 *     rowActions: [
 *       { icon: EYE_SVG,   label: 'View',   onClick: (row) => view(row)   },
 *       { icon: EDIT_SVG,  label: 'Edit',   onClick: (row) => edit(row)   },
 *       { icon: TRASH_SVG, label: 'Delete', variant: 'danger',
 *         onClick: (row) => remove(row) },
 *     ],
 *   });
 *   table.mount(container);
 *
 *   // Live updates
 *   table.setData(newRows, newPagination);
 *   table.setLoading(true);
 *
 * @module  Table
 * @version 2.0.0
 */

import { Component } from '../../core/component.js?v=20260806e';

/* ── Shared SVG icon constants ──────────────────────────────────────────── */

const ICON = Object.freeze({
  sortDefault: `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="M12 5v14M5 12l7-7 7 7"/>
    </svg>`,

  sortAsc: `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="M12 19V5M5 12l7-7 7 7"/>
    </svg>`,

  sortDesc: `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="M12 5v14M5 12l7 7 7-7"/>
    </svg>`,

  chevronLeft: `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <polyline points="15 18 9 12 15 6"/>
    </svg>`,

  chevronRight: `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <polyline points="9 18 15 12 9 6"/>
    </svg>`,

  emptyState: `
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.5"
         stroke-linecap="round" stroke-linejoin="round"
         opacity="0.3" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>`,
});

/* ── Skeleton row count ─────────────────────────────────────────────────── */

const SKELETON_ROWS = 5;

/* ══════════════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════════════ */

export class Table extends Component {
  static styles = '/components/base/Table.css?v=20260806e';

  constructor(props = {}) {
    super({
      columns:      [],     // Array<{ key, label, sortable?, render?, width?, align? }>
      data:         [],     // Array of row objects
      loading:      false,
      emptyTitle:   'No data found',
      emptyMessage: 'There is nothing to display here yet.',
      pagination:   null,   // null | { page, perPage, total, totalPages }
      rowActions:   [],     // Array<{ icon, label, variant?, onClick }>
      onSort:       null,   // (key: string, dir: 'asc'|'desc') => void
      onPageChange: null,   // (page: number) => void
      onRowClick:   null,   // (row: object) => void
      sortKey:      null,
      sortDir:      'asc',
      ...props,
    });

    this._state = {
      sortKey: props.sortKey ?? null,
      sortDir: props.sortDir ?? 'asc',
    };
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render() {
    const {
      columns, data, loading,
      emptyTitle, emptyMessage,
      pagination, rowActions, onRowClick,
    } = this.props;
    const { sortKey, sortDir } = this._state;

    const hasActions = rowActions?.length > 0;
    const hasData    = data?.length > 0;
    const colSpan    = columns.length + (hasActions ? 1 : 0);

    return `
      <div class="adm-table-wrapper">
        <div class="adm-table-scroll">
          <table class="adm-table" role="grid">

            <thead class="adm-table__head">
              <tr>
                ${columns.map((col) => this._renderTh(col, sortKey, sortDir)).join('')}
                ${hasActions
                  ? `<th class="adm-table__th adm-table__th--actions" scope="col">
                       Actions
                     </th>`
                  : ''}
              </tr>
            </thead>

            <tbody class="adm-table__body">
              ${loading
                ? this._renderSkeleton(colSpan)
                : !hasData
                  ? this._renderEmpty(colSpan, emptyTitle, emptyMessage)
                  : data.map((row, i) =>
                      this._renderRow(row, i, columns, rowActions, Boolean(onRowClick))
                    ).join('')}
            </tbody>

          </table>
        </div>

        ${pagination ? this._renderPagination(pagination) : ''}
      </div>
    `;
  }

  /* ── Private render helpers ───────────────────────────────────────────── */

  /**
   * Renders a single `<th>` cell with sort affordances.
   *
   * @param {object} col
   * @param {string|null} sortKey  Currently active sort key
   * @param {string}      sortDir  'asc' | 'desc'
   * @returns {string}
   */
  _renderTh(col, sortKey, sortDir) {
    const isActive = sortKey === col.key;

    const sortIcon = !col.sortable
      ? ''
      : isActive
        ? (sortDir === 'asc' ? ICON.sortAsc : ICON.sortDesc)
        : ICON.sortDefault;

    const ariaSort = !col.sortable
      ? ''
      : isActive
        ? (sortDir === 'asc' ? 'ascending' : 'descending')
        : 'none';

    const thClasses = [
      'adm-table__th',
      col.sortable ? 'adm-table__th--sortable' : '',
      isActive     ? 'adm-table__th--active'   : '',
    ].filter(Boolean).join(' ');

    return `
      <th
        class="${thClasses}"
        scope="col"
        ${col.width    ? `style="width:${col.width}"` : ''}
        ${col.sortable ? `data-sort-key="${this.esc(col.key)}"` : ''}
        ${ariaSort     ? `aria-sort="${ariaSort}"` : ''}
      >
        <span class="adm-table__th-inner">
          <span>${this.esc(col.label)}</span>
          ${col.sortable
            ? `<span class="adm-table__sort-icon">${sortIcon}</span>`
            : ''}
        </span>
      </th>
    `;
  }

  /**
   * Renders a single data `<tr>`.
   *
   * @param {object}   row
   * @param {number}   index
   * @param {object[]} columns
   * @param {object[]} rowActions
   * @param {boolean}  clickable
   * @returns {string}
   */
  _renderRow(row, index, columns, rowActions, clickable) {
    const rowId = row.id ?? index;

    const cells = columns.map((col) => {
      const value   = row[col.key];
      const content = col.render
        ? col.render(value, row)
        : this.esc(String(value ?? '—'));

      return `
        <td
          class="adm-table__td"
          ${col.align ? `style="text-align:${col.align}"` : ''}
        >${content}</td>
      `;
    }).join('');

    const actionCell = rowActions?.length ? `
      <td class="adm-table__td adm-table__td--actions">
        <div class="adm-table__actions">
          ${rowActions.map((action) => `
            <button
              class="adm-table__action-btn${action.variant === 'danger' ? ' adm-table__action-btn--danger' : ''}"
              type="button"
              title="${this.esc(action.label)}"
              aria-label="${this.esc(action.label)}"
              data-action="${this.esc(action.label)}"
              data-row-id="${rowId}"
            >${action.icon}</button>
          `).join('')}
        </div>
      </td>` : '';

    const rowClasses = [
      'adm-table__row',
      clickable ? 'adm-table__row--clickable' : '',
    ].filter(Boolean).join(' ');

    return `
      <tr class="${rowClasses}" data-row-id="${rowId}">
        ${cells}
        ${actionCell}
      </tr>
    `;
  }

  /**
   * Renders `SKELETON_ROWS` placeholder rows with shimmer cells.
   * @param {number} colCount
   * @returns {string}
   */
  _renderSkeleton(colCount) {
    return Array.from({ length: SKELETON_ROWS }, () => `
      <tr class="adm-table__row">
        ${Array.from({ length: colCount }, () => `
          <td class="adm-table__td">
            <div class="adm-table__skeleton"></div>
          </td>`).join('')}
      </tr>`).join('');
  }

  /**
   * Renders the empty-state row spanning all columns.
   *
   * @param {number} colCount
   * @param {string} title
   * @param {string} message
   * @returns {string}
   */
  _renderEmpty(colCount, title, message) {
    return `
      <tr>
        <td colspan="${colCount}" class="adm-table__empty-cell">
          <div class="adm-table__empty">
            <div class="adm-table__empty-icon">${ICON.emptyState}</div>
            <p class="adm-table__empty-title">${this.esc(title)}</p>
            <p class="adm-table__empty-msg">${this.esc(message)}</p>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Renders the pagination bar.
   *
   * @param {{ page: number, perPage: number, total: number, totalPages: number }} pagination
   * @returns {string}
   */
  _renderPagination({ page, perPage, total, totalPages }) {
    const start       = total === 0 ? 0 : (page - 1) * perPage + 1;
    const end         = Math.min(page * perPage, total);
    const pageNumbers = this._getPageNumbers(page, totalPages);

    const pageButtons = pageNumbers.map((p) =>
      p === '...'
        ? `<span class="adm-table__page-ellipsis" aria-hidden="true">…</span>`
        : `<button
             class="adm-table__page-btn${p === page ? ' adm-table__page-btn--active' : ''}"
             type="button"
             data-page="${p}"
             aria-label="Page ${p}"
             aria-current="${p === page ? 'page' : 'false'}"
           >${p}</button>`
    ).join('');

    return `
      <div class="adm-table__pagination">
        <span class="adm-table__pagination-info">
          ${total === 0 ? 'No results' : `${start}–${end} of ${total}`}
        </span>
        <div class="adm-table__pagination-controls">
          <button
            class="adm-table__page-btn adm-table__page-btn--nav"
            type="button"
            data-page="${page - 1}"
            ${page <= 1 ? 'disabled' : ''}
            aria-label="Previous page"
          >${ICON.chevronLeft}</button>

          ${pageButtons}

          <button
            class="adm-table__page-btn adm-table__page-btn--nav"
            type="button"
            data-page="${page + 1}"
            ${page >= totalPages ? 'disabled' : ''}
            aria-label="Next page"
          >${ICON.chevronRight}</button>
        </div>
      </div>
    `;
  }

  /**
   * Computes the visible page number sequence with ellipsis compression.
   * Always shows the first and last page; collapses middle runs with '…'.
   *
   * @param {number} current
   * @param {number} total
   * @returns {Array<number|string>}
   */
  _getPageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4)          return [1, 2, 3, 4, 5, '...', total];
    if (current >= total - 3)  return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', current - 1, current, current + 1, '...', total];
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  afterMount() {
    /* ── Sortable column headers ──────────────────────────────────────── */
    this.delegate('[data-sort-key]', 'click', (_, th) => {
      const key = th.dataset.sortKey;
      if (!key) return;
      const newDir = this._state.sortKey === key && this._state.sortDir === 'asc'
        ? 'desc'
        : 'asc';
      this._state = { sortKey: key, sortDir: newDir };
      this.setState({});
      this.props.onSort?.(key, newDir);
    });

    /* ── Pagination buttons ───────────────────────────────────────────── */
    this.delegate('[data-page]', 'click', (_, btn) => {
      if (btn.disabled) return;
      const page = parseInt(btn.dataset.page, 10);
      if (!Number.isNaN(page)) this.props.onPageChange?.(page);
    });

    /* ── Row action buttons ───────────────────────────────────────────── */
    this.delegate('[data-action]', 'click', (e, btn) => {
      e.stopPropagation();
      const action = this.props.rowActions?.find((a) => a.label === btn.dataset.action);
      const rowId  = btn.dataset.rowId;
      const row    = this.props.data?.find((r, i) => String(r.id ?? i) === rowId);
      if (action && row) action.onClick(row);
    });

    /* ── Clickable rows ───────────────────────────────────────────────── */
    if (typeof this.props.onRowClick === 'function') {
      this.delegate('.adm-table__row--clickable', 'click', (_, tr) => {
        const rowId  = tr.dataset.rowId;
        const rowData = this.props.data?.find(
          (r, i) => String(r.id ?? i) === rowId
        );
        if (rowData) this.props.onRowClick(rowData);
      });
    }
  }

  /* ── Public API ───────────────────────────────────────────────────────── */

  /**
   * Replaces table data and optionally updates pagination,
   * then triggers a full re-render.
   *
   * @param {object[]} data
   * @param {object}   [pagination]
   */
  setData(data, pagination) {
    this.props.data = data;
    if (pagination) this.props.pagination = pagination;
    this._rerender();
  }

  /**
   * Toggles the skeleton loading state.
   * @param {boolean} loading
   */
  setLoading(loading) {
    this.props.loading = Boolean(loading);
    this._rerender();
  }
}