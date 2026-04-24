# Todo App

自分用に作ったシンプルなTo-Doアプリ。プロジェクト別のタスク管理と「今日やること」を一画面で扱えます。

## 機能

### Todayタブ
- 今日のタスク（プロジェクトから「今日」マークしたもの）を一覧表示
- **Daily**：毎日繰り返すルーティンタスク（手動リセット）
- **Memo**：自動保存される簡易メモ帳
- 未完了タスク数のバッジ通知（アプリアイコン＋タブ）

### Projectsタブ
- プロジェクト単位でタスクを管理
- カテゴリで複数プロジェクトをグルーピング
- カラータグ（16色）
- アーカイブ機能
- 並び替え（プロジェクト・カテゴリ単位）

### タスク機能
- プロジェクト間の移動
- リネーム
- 並び替え
- 「今日」マークでTodayタブに表示
- 完了の表示/非表示切り替え

## 技術スタック

- **React Native** + **Expo SDK 54**
- **TypeScript**
- **Expo Router**（ファイルベースルーティング）
- **AsyncStorage**（ローカル保存、サーバー不要）
- **expo-notifications**（バッジ用）
- **EAS Build / EAS Update**（APK配布・OTAアップデート）

## ローカルで動かす

```bash
git clone https://github.com/okuq-dotcom/todo-app-vibe-code-.git
cd todo-app-vibe-code-
npm install
npx expo start
```

QRコードをExpo Goアプリ（Android/iOS）でスキャンすれば動きます。

## ビルド

Android APKを作成：

```bash
npx eas build --platform android --profile preview
```

OTAアップデート（JSの変更のみ）：

```bash
npx eas update --branch preview --message "変更内容"
```

## ライセンス

個人プロジェクト
