# Ha Note Record

一個 Home Assistant 自訂整合，用於管理分類筆記，支援 Markdown、置頂功能及自訂側邊欄面板。

[English](README.md)

## 功能特色

- **分類筆記** - 將筆記組織到自訂分類中
- **Markdown 支援** - 以 Markdown 格式撰寫筆記
- **置頂筆記** - 將重要筆記置頂顯示
- **自訂側邊欄面板** - 專屬面板，支援深色/淺色模式
- **WebSocket API** - 為前端面板提供即時 CRUD 操作

## 畫面截圖

### 面板總覽
![面板總覽](screenshots/panel-overview.png)

### 筆記編輯與 Markdown 預覽
![編輯對話框](screenshots/edit-dialog.png)

## 安裝方式

### HACS（手動新增儲存庫）

1. 在 Home Assistant 中開啟 HACS
2. 點選右上角的三點選單
3. 選擇**自訂儲存庫**
4. 新增此儲存庫網址，並選擇 **Integration** 作為類別
5. 點選**下載**
6. 重新啟動 Home Assistant

### 手動安裝

1. 將 `custom_components/ha_note_record` 資料夾複製到 Home Assistant 的 `config/custom_components/` 目錄
2. 重新啟動 Home Assistant

## 設定方式

1. 前往**設定** > **裝置與服務**
2. 點選**新增整合**
3. 搜尋 **Note Record**
4. 依照設定精靈完成安裝

安裝完成後，可透過以下方式管理筆記與分類：
- **選項設定** - 在整合的設定頁面新增/刪除分類與筆記
- **側邊欄面板** - 使用專屬面板獲得更豐富的筆記管理體驗

## 系統需求

- Home Assistant **2025.12.0** 或更新版本