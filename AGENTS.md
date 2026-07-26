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
    ├── plans/       # 実装計画。連番ディレクトリ(001-prototype/ など)ごとに計画を置く
    ├── specs/       # 確定した仕様(挙動・設定スキーマなど)
    └── contracts/   # コンポーネント間の境界仕様(Web↔API の /run プロトコルなど)
```

- `plans/` は作業単位のドキュメントを配置する。必要に応じて内容をspecs, contracts に昇格させる。
  `specs/` / `contracts/` の文書は内容が確定した時点で随時作成してよい(作業完了を待たない)。
  作業完了時に、plans に残った確定内容を昇格させる。
- ドキュメントは常に「最新の姿」だけを書く。
  経緯・履歴・レビュー記録の類は残さない(履歴は git が持つ)。
- 現在進行中の計画: `docs/internal/plans/001-prototype/`

## コミットメッセージ

コミットメッセージは　Conventional Commits に従うこと。簡潔な英語で書くこと。
例: `docs: add prototype plan`
