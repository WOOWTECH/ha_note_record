import {
  LitElement,
  html,
  css,
  unsafeCSS,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

import { marked } from "https://esm.sh/marked@9.1.6";
import DOMPurify from "https://esm.sh/dompurify@3.0.6";

// Inlined shared styles for HA panel compatibility
const sharedStylesLit = `
  /* TOP BAR */
  .top-bar {
    display: flex;
    align-items: center;
    height: 56px;
    padding: 0 16px;
    background: var(--primary-color);
    color: white;
    position: sticky;
    top: 0;
    z-index: 100;
    gap: 12px;
    margin: -16px -16px 16px -16px;
  }
  .top-bar-sidebar-btn {
    width: 40px;
    height: 40px;
    border: none;
    background: transparent;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background 0.2s;
    flex-shrink: 0;
  }
  .top-bar-sidebar-btn:hover { background: rgba(255, 255, 255, 0.1); }
  .top-bar-sidebar-btn svg { width: 24px; height: 24px; }
  .top-bar-title {
    flex: 1;
    font-size: 20px;
    font-weight: 500;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .top-bar-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
  .top-bar-action-btn {
    width: 40px;
    height: 40px;
    border: none;
    background: transparent;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background 0.2s;
  }
  .top-bar-action-btn:hover { background: rgba(255, 255, 255, 0.1); }
  .top-bar-action-btn svg { width: 24px; height: 24px; }

  /* SEARCH ROW */
  .search-row {
    display: flex;
    align-items: center;
    height: 48px;
    padding: 0 16px;
    background: var(--primary-background-color);
    border-bottom: 1px solid var(--divider-color);
    margin: 0 -16px 16px -16px;
    gap: 8px;
  }
  .search-row-input-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    background: var(--card-background-color);
    border: 1px solid var(--divider-color);
    border-radius: 8px;
    padding: 0 12px;
    height: 36px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .search-row-input-wrapper:focus-within {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(var(--rgb-primary-color, 3, 169, 244), 0.2);
  }
  .search-row-icon {
    width: 20px;
    height: 20px;
    color: var(--secondary-text-color);
    flex-shrink: 0;
    margin-right: 8px;
  }
  .search-row-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 14px;
    color: var(--primary-text-color);
    outline: none;
    height: 100%;
  }
  .search-row-input::placeholder { color: var(--secondary-text-color); }
`;

// Translation helper
const commonTranslations = {
  en: { menu: 'Menu', search: 'Search...', add: 'Add', more_actions: 'More actions' },
  'zh-Hant': { menu: '選單', search: '搜尋...', add: '新增', more_actions: '更多操作' },
  'zh-Hans': { menu: '菜单', search: '搜索...', add: '添加', more_actions: '更多操作' },
};
function getCommonTranslation(key, lang = 'en') {
  const langKey = lang?.startsWith('zh-TW') || lang?.startsWith('zh-HK') ? 'zh-Hant' :
                  lang?.startsWith('zh') ? 'zh-Hans' : 'en';
  return commonTranslations[langKey]?.[key] || commonTranslations['en'][key] || key;
}

class HaNoteRecordPanel extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      narrow: { type: Boolean },
      panel: { type: Object },
      _categories: { type: Array },
      _notes: { type: Array },
      _activeTab: { type: String },
      _loading: { type: Boolean },
      _dialogOpen: { type: Boolean },
      _dialogMode: { type: String },
      _editingNote: { type: Object },
      _categoryDialogOpen: { type: Boolean },
      _categoryDialogMode: { type: String },
      _editingCategory: { type: Object },
      _searchQuery: { type: String },
    };
  }

  static get styles() {
    return css`
      ${unsafeCSS(sharedStylesLit)}

      :host {
        display: block;
        padding: 16px;
        background: var(--primary-background-color);
        min-height: 100vh;
        box-sizing: border-box;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      }

      .header h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 400;
        color: var(--primary-text-color);
      }

      .tabs-container {
        display: flex;
        align-items: center;
        border-bottom: 1px solid var(--divider-color);
        margin-bottom: 16px;
        overflow-x: auto;
      }

      .category-tabs {
        display: flex;
        gap: 4px;
        flex: 1;
      }

      .category-tab {
        padding: 12px 16px;
        cursor: pointer;
        border: none;
        background: none;
        color: var(--secondary-text-color);
        font-size: 14px;
        font-weight: 500;
        border-bottom: 2px solid transparent;
        transition: all 0.2s ease;
        white-space: nowrap;
      }

      .category-tab:hover {
        color: var(--primary-text-color);
        background: var(--secondary-background-color);
      }

      .category-tab.active {
        color: var(--primary-color);
        border-bottom-color: var(--primary-color);
      }

      .add-tab-btn {
        padding: 8px 12px;
        cursor: pointer;
        border: none;
        background: none;
        color: var(--primary-color);
        font-size: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        margin-left: 8px;
      }

      .add-tab-btn:hover {
        background: var(--secondary-background-color);
      }

      .tab-actions {
        display: flex;
        gap: 4px;
        margin-left: 8px;
      }

      .tab-action-btn {
        padding: 4px 8px;
        cursor: pointer;
        border: none;
        background: none;
        color: var(--secondary-text-color);
        font-size: 12px;
        border-radius: 4px;
      }

      .tab-action-btn:hover {
        background: var(--secondary-background-color);
        color: var(--error-color);
      }

      .content {
        padding: 16px 0;
      }

      .notes-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 16px;
      }

      .note-card {
        background: var(--card-background-color);
        border-radius: 8px;
        padding: 16px;
        cursor: pointer;
        box-shadow: var(--ha-card-box-shadow, 0 2px 4px rgba(0,0,0,0.1));
        transition: all 0.2s ease;
        position: relative;
        border-left: 4px solid transparent;
      }

      .note-card:hover {
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        transform: translateY(-2px);
      }

      .note-card.pinned {
        border-left-color: var(--primary-color);
      }

      .note-card-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .note-card-title {
        font-size: 16px;
        font-weight: 500;
        color: var(--primary-text-color);
        flex: 1;
        margin: 0;
      }

      .pin-icon {
        color: var(--primary-color);
        font-size: 16px;
      }

      .note-card-content {
        color: var(--secondary-text-color);
        font-size: 14px;
        line-height: 1.5;
        max-height: 100px;
        overflow: hidden;
        position: relative;
      }

      .note-card-content::after {
        content: "";
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 40px;
        background: linear-gradient(transparent, var(--card-background-color));
      }

      .note-card-content :first-child {
        margin-top: 0;
      }

      .note-card-footer {
        margin-top: 12px;
        font-size: 12px;
        color: var(--secondary-text-color);
      }

      .empty-state {
        text-align: center;
        padding: 48px 16px;
        color: var(--secondary-text-color);
      }

      .empty-state ha-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }

      .loading {
        display: flex;
        justify-content: center;
        padding: 48px;
      }

      /* Dialog styles */
      .dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .dialog {
        background: var(--card-background-color);
        border-radius: 12px;
        width: 90%;
        max-width: 600px;
        max-height: 90vh;
        overflow: auto;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      }

      .dialog-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid var(--divider-color);
      }

      .dialog-header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 500;
        color: var(--primary-text-color);
      }

      .dialog-close {
        cursor: pointer;
        border: none;
        background: none;
        color: var(--secondary-text-color);
        font-size: 24px;
        padding: 4px;
        line-height: 1;
      }

      .dialog-close:hover {
        color: var(--primary-text-color);
      }

      .dialog-content {
        padding: 20px;
      }

      .form-group {
        margin-bottom: 16px;
      }

      .form-group label {
        display: block;
        margin-bottom: 8px;
        font-size: 14px;
        font-weight: 500;
        color: var(--primary-text-color);
      }

      .form-group input,
      .form-group textarea {
        width: 100%;
        padding: 12px;
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        font-size: 14px;
        background: var(--primary-background-color);
        color: var(--primary-text-color);
        box-sizing: border-box;
      }

      .form-group input:focus,
      .form-group textarea:focus {
        outline: none;
        border-color: var(--primary-color);
      }

      .form-group textarea {
        min-height: 150px;
        resize: vertical;
        font-family: "Noto Sans Mono", "Noto Sans SC", "Microsoft YaHei", "PingFang SC", monospace;
      }

      .form-group-checkbox {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .form-group-checkbox input {
        width: auto;
      }

      .preview-section {
        margin-top: 16px;
        padding: 16px;
        background: var(--secondary-background-color);
        border-radius: 8px;
      }

      .preview-section h3 {
        margin: 0 0 12px 0;
        font-size: 14px;
        font-weight: 500;
        color: var(--secondary-text-color);
      }

      .preview-content {
        color: var(--primary-text-color);
        font-size: 14px;
        line-height: 1.6;
      }

      .preview-content h1,
      .preview-content h2,
      .preview-content h3 {
        margin-top: 16px;
        margin-bottom: 8px;
      }

      .preview-content h1:first-child,
      .preview-content h2:first-child,
      .preview-content h3:first-child {
        margin-top: 0;
      }

      .preview-content ul,
      .preview-content ol {
        padding-left: 20px;
      }

      .preview-content code {
        background: var(--primary-background-color);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: "Noto Sans Mono", "Noto Sans SC", "Microsoft YaHei", "PingFang SC", Consolas, monospace;
      }

      .preview-content pre {
        background: var(--primary-background-color);
        padding: 12px;
        border-radius: 8px;
        overflow-x: auto;
      }

      .preview-content pre code {
        background: none;
        padding: 0;
      }

      .dialog-footer {
        display: flex;
        justify-content: space-between;
        padding: 16px 20px;
        border-top: 1px solid var(--divider-color);
      }

      .dialog-footer-left {
        display: flex;
        gap: 8px;
      }

      .dialog-footer-right {
        display: flex;
        gap: 8px;
      }

      .btn {
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-primary {
        background: var(--primary-color);
        color: white;
      }

      .btn-primary:hover {
        opacity: 0.9;
      }

      .btn-secondary {
        background: var(--secondary-background-color);
        color: var(--primary-text-color);
      }

      .btn-secondary:hover {
        background: var(--divider-color);
      }

      .btn-danger {
        background: var(--error-color);
        color: white;
      }

      .btn-danger:hover {
        opacity: 0.9;
      }

      @media (max-width: 600px) {
        :host {
          padding: 8px;
        }

        .notes-grid {
          grid-template-columns: 1fr;
        }

        .dialog {
          width: 95%;
          max-height: 95vh;
        }
      }
    `;
  }

  constructor() {
    super();
    this._categories = [];
    this._notes = [];
    this._activeTab = null;
    this._loading = true;
    this._dialogOpen = false;
    this._dialogMode = "create";
    this._editingNote = null;
    this._categoryDialogOpen = false;
    this._categoryDialogMode = "create";
    this._editingCategory = null;
    this._searchQuery = "";
  }

  _toggleSidebar() {
    this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }));
  }

  _onSearchInput(e) {
    this._searchQuery = e.target.value;
  }

  firstUpdated() {
    this._loadData();
  }

  async _loadData() {
    this._loading = true;
    try {
      const result = await this.hass.callWS({
        type: "ha_note_record/get_data",
      });
      this._categories = result.categories || [];
      this._notes = result.notes || [];

      if (!this._activeTab && this._categories.length > 0) {
        this._activeTab = this._categories[0].id;
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    }
    this._loading = false;
  }

  _getNotesForCategory(categoryId) {
    let notes = this._notes.filter((n) => n.category_id === categoryId);

    // Apply search filter
    if (this._searchQuery && this._searchQuery.trim()) {
      const query = this._searchQuery.toLowerCase().trim();
      notes = notes.filter((n) => {
        const title = (n.title || "").toLowerCase();
        const content = (n.content || "").toLowerCase();
        return title.includes(query) || content.includes(query);
      });
    }

    // Sort: pinned first, then by updated_at desc
    return notes.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
  }

  _renderMarkdown(content) {
    if (!content) return "";
    try {
      const rawHtml = marked.parse(content);
      return DOMPurify.sanitize(rawHtml);
    } catch (e) {
      return DOMPurify.sanitize(content);
    }
  }

  _formatDate(dateStr) {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  }

  _localize(key) {
    // Try to get translation from HA
    const translation = this.hass?.localize?.(`component.ha_note_record.panel.${key}`);
    if (translation) return translation;

    // Fallback translations
    const fallbacks = {
      title: this.hass?.language === "zh-Hant" ? "筆記本" : "Note Record",
      add_note: this.hass?.language === "zh-Hant" ? "新增筆記" : "Add Note",
      edit_note: this.hass?.language === "zh-Hant" ? "編輯筆記" : "Edit Note",
      create_note: this.hass?.language === "zh-Hant" ? "建立筆記" : "Create Note",
      note_title: this.hass?.language === "zh-Hant" ? "標題" : "Title",
      content: this.hass?.language === "zh-Hant" ? "內容 (Markdown)" : "Content (Markdown)",
      save: this.hass?.language === "zh-Hant" ? "儲存" : "Save",
      cancel: this.hass?.language === "zh-Hant" ? "取消" : "Cancel",
      delete: this.hass?.language === "zh-Hant" ? "刪除" : "Delete",
      create: this.hass?.language === "zh-Hant" ? "建立" : "Create",
      updated: this.hass?.language === "zh-Hant" ? "更新時間" : "Updated",
      preview: this.hass?.language === "zh-Hant" ? "預覽" : "Preview",
      pin_note: this.hass?.language === "zh-Hant" ? "置頂此筆記" : "Pin this note",
      note_title_placeholder: this.hass?.language === "zh-Hant" ? "筆記標題" : "Note title",
      note_content_placeholder: this.hass?.language === "zh-Hant" ? "使用 Markdown 撰寫筆記..." : "Write your note in Markdown...",
      add_category: this.hass?.language === "zh-Hant" ? "新增類別" : "Add Category",
      create_category: this.hass?.language === "zh-Hant" ? "建立類別" : "Create Category",
      delete_category: this.hass?.language === "zh-Hant" ? "刪除類別" : "Delete Category",
      category_name: this.hass?.language === "zh-Hant" ? "類別名稱" : "Category Name",
      category_placeholder: this.hass?.language === "zh-Hant" ? "例如：密碼、筆記、待辦" : "e.g., Passwords, Notes, Todo",
      no_categories: this.hass?.language === "zh-Hant" ? "尚無類別，請先建立一個！" : "No categories yet. Create one to get started!",
      no_notes: this.hass?.language === "zh-Hant" ? "此類別尚無筆記。" : "No notes in this category yet.",
      error: this.hass?.language === "zh-Hant" ? "錯誤" : "Error",
      delete_category_confirm: this.hass?.language === "zh-Hant" ? "刪除類別" : "Delete category",
      cannot_delete_category: this.hass?.language === "zh-Hant" ? "無法刪除類別。請先刪除此類別中的所有筆記。" : "Cannot delete category. Delete all notes first.",
    };
    return fallbacks[key] || key;
  }

  _showNotification(message, type = "info") {
    // Use Home Assistant's notification system
    this.hass.callService("persistent_notification", "create", {
      message: message,
      title: type === "error" ? this._localize("error") : this._localize("title"),
      notification_id: `ha_note_record_${Date.now()}`,
    });
  }

  _showError(message) {
    this._showNotification(message, "error");
  }

  _truncateContent(content, maxLength = 150) {
    if (!content) return "";
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  }

  // Tab actions
  _selectTab(categoryId) {
    this._activeTab = categoryId;
  }

  _openCategoryDialog(mode = "create", category = null) {
    this._categoryDialogMode = mode;
    this._editingCategory = category;
    this._categoryDialogOpen = true;
  }

  _closeCategoryDialog() {
    this._categoryDialogOpen = false;
    this._editingCategory = null;
  }

  async _saveCategory(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.querySelector("#category-name").value.trim();

    if (!name) return;

    try {
      const result = await this.hass.callWS({
        type: "ha_note_record/create_category",
        name: name,
      });
      this._categories = [...this._categories, result];
      this._activeTab = result.id;
      this._closeCategoryDialog();
    } catch (error) {
      console.error("Failed to create category:", error);
      this._showError(error.message || "Failed to create category");
    }
  }

  async _deleteCategory(categoryId) {
    const category = this._categories.find((c) => c.id === categoryId);
    if (!category) return;

    const notesInCategory = this._notes.filter((n) => n.category_id === categoryId);
    if (notesInCategory.length > 0) {
      this._showError(`Cannot delete category "${category.name}". Delete all ${notesInCategory.length} notes first.`);
      return;
    }

    if (!confirm(`Delete category "${category.name}"?`)) return;

    try {
      await this.hass.callWS({
        type: "ha_note_record/delete_category",
        category_id: categoryId,
      });
      this._categories = this._categories.filter((c) => c.id !== categoryId);
      if (this._activeTab === categoryId) {
        this._activeTab = this._categories.length > 0 ? this._categories[0].id : null;
      }
    } catch (error) {
      console.error("Failed to delete category:", error);
      this._showError(error.message || "Failed to delete category");
    }
  }

  // Note actions
  _openNoteDialog(mode = "create", note = null) {
    this._dialogMode = mode;
    this._editingNote = note
      ? { ...note }
      : { title: "", content: "", pinned: false, category_id: this._activeTab };
    this._dialogOpen = true;
  }

  _closeNoteDialog() {
    this._dialogOpen = false;
    this._editingNote = null;
  }

  _updateNoteField(field, value) {
    this._editingNote = { ...this._editingNote, [field]: value };
  }

  async _saveNote(e) {
    e.preventDefault();

    if (!this._editingNote.title.trim()) {
      this._showError("Title is required");
      return;
    }

    try {
      if (this._dialogMode === "create") {
        const result = await this.hass.callWS({
          type: "ha_note_record/create_note",
          category_id: this._editingNote.category_id,
          title: this._editingNote.title,
          content: this._editingNote.content,
          pinned: this._editingNote.pinned,
        });
        this._notes = [...this._notes, result];
      } else {
        const result = await this.hass.callWS({
          type: "ha_note_record/update_note",
          note_id: this._editingNote.id,
          title: this._editingNote.title,
          content: this._editingNote.content,
          pinned: this._editingNote.pinned,
        });
        this._notes = this._notes.map((n) =>
          n.id === result.id ? result : n
        );
      }
      this._closeNoteDialog();
    } catch (error) {
      console.error("Failed to save note:", error);
      this._showError(error.message || "Failed to save note");
    }
  }

  async _deleteNote() {
    if (!this._editingNote || !this._editingNote.id) return;
    if (!confirm(`Delete note "${this._editingNote.title}"?`)) return;

    try {
      await this.hass.callWS({
        type: "ha_note_record/delete_note",
        note_id: this._editingNote.id,
      });
      this._notes = this._notes.filter((n) => n.id !== this._editingNote.id);
      this._closeNoteDialog();
    } catch (error) {
      console.error("Failed to delete note:", error);
      this._showError(error.message || "Failed to delete note");
    }
  }

  render() {
    if (this._loading) {
      return html`
        <div class="loading">
          <ha-circular-progress active></ha-circular-progress>
        </div>
      `;
    }

    const activeCategory = this._categories.find((c) => c.id === this._activeTab);
    const notes = this._activeTab ? this._getNotesForCategory(this._activeTab) : [];

    return html`
      <!-- Top Bar -->
      <div class="top-bar">
        <button class="top-bar-sidebar-btn" @click=${this._toggleSidebar} title="${getCommonTranslation('menu', this.hass?.language)}">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z"/></svg>
        </button>
        <h1 class="top-bar-title">${this._localize("title")}</h1>
        <div class="top-bar-actions">
          <button class="top-bar-action-btn" @click=${() => this._openNoteDialog("create")} title="${this._localize("add_note")}">
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/></svg>
          </button>
          <button class="top-bar-action-btn" @click=${() => this._openCategoryDialog("create")} title="${this._localize("add_category")}">
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/></svg>
          </button>
        </div>
      </div>

      <!-- Search Row -->
      <div class="search-row">
        <div class="search-row-input-wrapper">
          <svg class="search-row-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/></svg>
          <input
            class="search-row-input"
            type="text"
            placeholder="${getCommonTranslation('search', this.hass?.language)}"
            .value=${this._searchQuery}
            @input=${this._onSearchInput}
          />
        </div>
      </div>

      <div class="tabs-container">
        <div class="category-tabs">
          ${this._categories.map(
            (category) => html`
              <button
                class="category-tab ${category.id === this._activeTab ? "active" : ""}"
                @click=${() => this._selectTab(category.id)}
              >
                ${category.name}
              </button>
            `
          )}
        </div>
        <button
          class="add-tab-btn"
          @click=${() => this._openCategoryDialog("create")}
          title="${this._localize("add_category")}"
        >
          +
        </button>
        ${activeCategory
          ? html`
              <div class="tab-actions">
                <button
                  class="tab-action-btn"
                  @click=${() => this._deleteCategory(this._activeTab)}
                  title="${this._localize("delete_category")}"
                >
                  <svg viewBox="0 0 24 24" style="width:16px;height:16px"><path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>
                </button>
              </div>
            `
          : ""}
      </div>

      <div class="content">
        ${this._categories.length === 0
          ? html`
              <div class="empty-state">
                <ha-icon icon="mdi:folder-plus-outline"></ha-icon>
                <p>${this._localize("no_categories")}</p>
                <button
                  class="btn btn-primary"
                  @click=${() => this._openCategoryDialog("create")}
                >
                  ${this._localize("create_category")}
                </button>
              </div>
            `
          : this._activeTab
          ? html`
              ${notes.length === 0
                ? html`
                    <div class="empty-state">
                      <ha-icon icon="mdi:note-plus-outline"></ha-icon>
                      <p>${this._localize("no_notes")}</p>
                    </div>
                  `
                : html`
                    <div class="notes-grid">
                      ${notes.map(
                        (note) => html`
                          <div
                            class="note-card ${note.pinned ? "pinned" : ""}"
                            @click=${() => this._openNoteDialog("edit", note)}
                          >
                            <div class="note-card-header">
                              <h3 class="note-card-title">${note.title}</h3>
                              ${note.pinned
                                ? html`<span class="pin-icon">📌</span>`
                                : ""}
                            </div>
                            <div
                              class="note-card-content"
                              .innerHTML=${this._renderMarkdown(
                                this._truncateContent(note.content)
                              )}
                            ></div>
                            <div class="note-card-footer">
                              ${this._localize("updated")}: ${this._formatDate(note.updated_at)}
                            </div>
                          </div>
                        `
                      )}
                    </div>
                  `}
            `
          : ""}
      </div>

      ${this._dialogOpen ? this._renderNoteDialog() : ""}
      ${this._categoryDialogOpen ? this._renderCategoryDialog() : ""}
    `;
  }

  _renderNoteDialog() {
    const isEdit = this._dialogMode === "edit";
    return html`
      <div class="dialog-overlay" @click=${this._closeNoteDialog}>
        <div class="dialog" @click=${(e) => e.stopPropagation()}>
          <div class="dialog-header">
            <h2>${isEdit ? this._localize("edit_note") : this._localize("create_note")}</h2>
            <button class="dialog-close" @click=${this._closeNoteDialog}>
              ×
            </button>
          </div>
          <form @submit=${this._saveNote}>
            <div class="dialog-content">
              <div class="form-group">
                <label for="note-title">${this._localize("note_title")}</label>
                <input
                  type="text"
                  id="note-title"
                  .value=${this._editingNote?.title || ""}
                  @input=${(e) => this._updateNoteField("title", e.target.value)}
                  placeholder="${this._localize("note_title_placeholder")}"
                  required
                />
              </div>
              <div class="form-group">
                <label for="note-content">${this._localize("content")}</label>
                <textarea
                  id="note-content"
                  .value=${this._editingNote?.content || ""}
                  @input=${(e) =>
                    this._updateNoteField("content", e.target.value)}
                  placeholder="${this._localize("note_content_placeholder")}"
                ></textarea>
              </div>
              <div class="form-group form-group-checkbox">
                <input
                  type="checkbox"
                  id="note-pinned"
                  .checked=${this._editingNote?.pinned || false}
                  @change=${(e) =>
                    this._updateNoteField("pinned", e.target.checked)}
                />
                <label for="note-pinned">${this._localize("pin_note")}</label>
              </div>
              ${this._editingNote?.content
                ? html`
                    <div class="preview-section">
                      <h3>${this._localize("preview")}</h3>
                      <div
                        class="preview-content"
                        .innerHTML=${this._renderMarkdown(
                          this._editingNote.content
                        )}
                      ></div>
                    </div>
                  `
                : ""}
            </div>
            <div class="dialog-footer">
              <div class="dialog-footer-left">
                ${isEdit
                  ? html`
                      <button
                        type="button"
                        class="btn btn-danger"
                        @click=${this._deleteNote}
                      >
                        ${this._localize("delete")}
                      </button>
                    `
                  : ""}
              </div>
              <div class="dialog-footer-right">
                <button
                  type="button"
                  class="btn btn-secondary"
                  @click=${this._closeNoteDialog}
                >
                  ${this._localize("cancel")}
                </button>
                <button type="submit" class="btn btn-primary">${this._localize("save")}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  _renderCategoryDialog() {
    return html`
      <div class="dialog-overlay" @click=${this._closeCategoryDialog}>
        <div class="dialog" @click=${(e) => e.stopPropagation()}>
          <div class="dialog-header">
            <h2>${this._localize("create_category")}</h2>
            <button class="dialog-close" @click=${this._closeCategoryDialog}>
              ×
            </button>
          </div>
          <form @submit=${this._saveCategory}>
            <div class="dialog-content">
              <div class="form-group">
                <label for="category-name">${this._localize("category_name")}</label>
                <input
                  type="text"
                  id="category-name"
                  placeholder="${this._localize("category_placeholder")}"
                  required
                />
              </div>
            </div>
            <div class="dialog-footer">
              <div class="dialog-footer-left"></div>
              <div class="dialog-footer-right">
                <button
                  type="button"
                  class="btn btn-secondary"
                  @click=${this._closeCategoryDialog}
                >
                  ${this._localize("cancel")}
                </button>
                <button type="submit" class="btn btn-primary">${this._localize("create")}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  }
}

customElements.define("ha-note-record-panel", HaNoteRecordPanel);
