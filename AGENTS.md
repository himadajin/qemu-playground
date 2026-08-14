# AGENTS.md

ブラウザから C またはアセンブリのプログラムを入力し、ターゲットアーキテクチャ(まず RV64 / AArch64)を選んで
ボタンを押すだけでコンパイルと QEMU user-mode 実行を行い、
stdout、stderr、終了コード、コンパイル結果、必要に応じて生成アセンブリを確認できる Web playground を開発する。

## Single Source of Truth

このプロジェクトでは `docs/` ディレクトリを single source of truth とする。

- 設計・仕様・計画に関する疑問は、まず `docs/` を参照して解決する。
- 設計や仕様を変更したときは、コードより先に(少なくとも同時に)該当ドキュメントを更新する。
- コードとドキュメントが食い違う場合、ドキュメントを正とし、どちらが誤りかを確認して修正する。

## Document Structure

```
docs/
├── user/            # ユーザー向けドキュメント(インストール・設定・使い方)
└── internal/        # 開発者向けドキュメント
    ├── specs/       # 確定した仕様(挙動・設定スキーマなど)
    └── contracts/   # コンポーネント間の境界仕様(Web↔API の /run プロトコルなど)
```

- 実装計画・作業管理は GitHub Issues で行う。docs/ には現在の状態だけを置く。
- ドキュメントは常に「最新の姿」だけを書く。
  経緯・履歴・レビュー記録の類は残さない(履歴は git が持つ)。

## コミットメッセージ

コミットメッセージは　Conventional Commits に従うこと。簡潔な英語で書くこと。
例: `docs: add prototype plan`

## Lint / Format

コミット前に `npm run lint` と `npm run format:check` を通すこと。
自動修正は `npm run lint:fix` / `npm run format` で行う。
