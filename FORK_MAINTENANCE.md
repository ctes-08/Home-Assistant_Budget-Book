# Budget Book fork 維護與 HA 安裝

此 fork 以 [Im-Tim-mI/Home-Assistant_Budget-Book v1.2.3](https://github.com/Im-Tim-mI/Home-Assistant_Budget-Book/releases/tag/v1.2.3) 為基礎，保留原作者 MIT 授權與版權聲明。正式版本由 ctes-08 的 repository 發布；不自動合併或安裝上游更新。

## Fork v1.2.4

- 固定支出保留設定的日期；僅在該月沒有該日期時，改用當月最後一天。每月 31 日因此會在 10 月 31 日、4 月 30 日、平年 2 月 28 日與閏年 2 月 29 日到期。
- 前端到期顯示與後端到期判斷採同一規則。提醒不會提前改寫實際入帳日期。
- HA 金額統計使用 HA 設定的本地日期，並在本地午夜刷新，即使沒有新增交易也能跨月。
- 新增 `budget_book.get_book`，必須提供 `book_id`；回傳該帳簿的 `book` 與 `metrics`，不切換目前帳簿。
- 圖表使用隨整合附帶的 Chart.js，不需要從外部 CDN 載入程式。
- 已存在但格式不合法的儲存檔會讓整合停止載入，避免默默以空帳簿覆蓋原資料。

## HA 安裝

建議只安裝 HACS integration。HACS 的 custom repository 使用：

```text
https://github.com/ctes-08/Home-Assistant_Budget-Book
```

類型選 Integration，安裝此 fork 的 release。手動安裝時，將 release ZIP 中的 `budget_book` 資料夾放到 `/config/custom_components/budget_book`。

首次安裝前先備份設定，將下列 glob 加入**既有** Recorder 的 `exclude.entity_globs`，不要新增第二個 `recorder:` 區塊：

```yaml
recorder:
  exclude:
    entity_globs:
      - sensor.budget_book_*
```

這會排除 HA 的帳目與金額歷史紀錄。整合的即時狀態仍然可用，原始帳簿仍存於 HA `.storage`，也仍包含於 HA 設定備份；此設定不是加密或帳簿權限隔離。

執行 HA 設定檢查，確認通過後再重啟 HA Core。重啟後到「設定 → 裝置與服務 → 新增整合」，搜尋 Budget Book。首次正式安裝不要載入範例資料；範例資料功能會取代現有帳簿資料。

## 指定帳簿串接

LINE 輸入、修改、刪除與查詢都應由可信的使用者對應資料決定 `book_id`，不要依賴 HA 面板目前選中的帳簿，也不要接受聊天訊息指定任意帳簿。查詢可使用有回傳資料的 HA action：

```yaml
action: budget_book.get_book
data:
  book_id: "已綁定的帳簿 ID"
response_variable: budget_result
```

本版本只準備 HA 端，尚未包含 LINE 指令、家人綁定、訊息去重或修改／刪除按鈕。既有 HA 面板仍共用目前選中的帳簿；家人日常入口預計由 LINE 提供。

## 更新與驗證

保留 `origin` 指向此 fork、`upstream` 指向原作者。手動抓取上游後先比較差異；任何共用行為先改 `shared/core/`，再執行 `scripts/sync_shared_core.py`。新增相依套件僅用於本地測試，不放進 HA。

離線測試使用 `python -m unittest discover -s tests -p 'test_*.py'`；integration boundary tests 需要 `voluptuous`。另外檢查 Python 語法、JavaScript 語法、JSON／YAML 與三種語系鍵值一致性。這些測試不替代實際 HA 載入、服務回傳與面板驗證。

更新前先備份，安裝測試過的 fork release，經確認後重啟並檢查實際版本。HA API token、LINE user ID、真實帳目與私人 HA 設定不得提交到此公開 repository。
