# Duel Craft

自分でカードを作って friends と対戦できる、ブラウザで動くオリジナルカードゲームです。
スマートフォン(横画面)・タブレット・PCに対応しています。

---

## 目次

1. [必要なもの](#1-必要なもの)
2. [セットアップ(ローカルで動かす)](#2-セットアップローカルで動かす)
3. [オンライン対戦の設定(Firebase)](#3-オンライン対戦の設定firebase)
4. [GitHubで公開する](#4-githubで公開する)
5. [効果の追加方法](#5-効果の追加方法)
6. [プロジェクト構成](#6-プロジェクト構成)

---

## 1. 必要なもの

- **Node.js 20 以上** … https://nodejs.org/ からLTS版をインストール
- **GitHubアカウント** … 公開する場合のみ
- **Googleアカウント** … オンライン対戦を使う場合のみ(Firebase用)

> オンライン対戦を使わないのであれば、Firebaseの設定は不要です。
> カード作成・デッキ構築・NPC対戦だけなら、手順2だけで遊べます。

---

## 2. セットアップ(ローカルで動かす)

```bash
# 依存パッケージをインストール
npm install

# 開発サーバーを起動
npm run dev
```

表示された URL(通常 `http://localhost:5173`)をブラウザで開いてください。

### その他のコマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバーを起動 |
| `npm run build` | 公開用にビルド(型チェックも実行される) |
| `npm run preview` | ビルド結果を確認 |
| `npm run typecheck` | 型チェックのみ実行 |

---

## 3. オンライン対戦の設定(Firebase)

オンライン対戦を使う場合のみ必要です。**無料枠の範囲で足ります。**

### 3-1. Firebaseプロジェクトを作る

1. https://console.firebase.google.com/ を開き、Googleアカウントでログイン
2. 「プロジェクトを作成」→ 好きな名前を入力(例: `duel-craft`)
   → Googleアナリティクスは「無効」で構いません → 作成

### 3-2. データベースを用意する

1. 左メニュー「構築」→「Firestore Database」→「データベースを作成」
2. ロケーションは `asia-northeast1`(東京)を選ぶと、日本からの通信が速くなります
3. 「本番環境モードで開始」を選択(次の手順でルールを設定します)
4. 作成後、「ルール」タブを開き、以下に置き換えて「公開」

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read, write: if true;
    }
  }
}
```

> **このルールについて**
> これは「誰でも読み書きできる」設定です。友人内で遊ぶ分には問題になりにくいですが、
> 公開URLが不特定多数に知られた場合、第三者が対戦データを書き換えられる可能性があります。
> 気になる場合は、後からログイン機能を追加して制限できます。

### 3-3. 接続情報を取得する

1. 「プロジェクトの概要」横の歯車 →「プロジェクトの設定」
2. 下へスクロールし「マイアプリ」→ `</>`(ウェブ)アイコンをクリック
3. 適当なニックネームを入力して「アプリを登録」
4. 表示される `firebaseConfig` の中身をメモ

### 3-4. 設定ファイルを作る

```bash
cp .env.example .env.local
```

`.env.local` を開き、3-3でメモした値を記入します。

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=duel-craft-xxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=duel-craft-xxxx
VITE_FIREBASE_STORAGE_BUCKET=duel-craft-xxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

`.env.local` は `.gitignore` に含まれているため、**GitHubには上がりません。**

設定後、`npm run dev` を再起動すると反映されます。

---

## 4. GitHubで公開する

### 4-1. リポジトリにアップロードする

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/(ユーザー名)/duel-craft.git
git push -u origin main
```

> **リポジトリ名を `duel-craft` 以外にする場合**
> `vite.config.ts` の `REPO_NAME` を、実際のリポジトリ名に変更してください。
> ここが合っていないと、公開後に画面が真っ白になります。

### 4-2. GitHub Pages を有効にする

1. GitHubのリポジトリページ →「Settings」→ 左メニュー「Pages」
2. 「Source」を **「GitHub Actions」** に変更

### 4-3. Firebaseの設定を登録する(オンライン対戦を使う場合)

1. 「Settings」→「Secrets and variables」→「Actions」
2. 「New repository secret」から、以下6つを1つずつ登録

| 名前 | 値 |
|---|---|
| `VITE_FIREBASE_API_KEY` | `.env.local` と同じ値 |
| `VITE_FIREBASE_AUTH_DOMAIN` | 〃 |
| `VITE_FIREBASE_PROJECT_ID` | 〃 |
| `VITE_FIREBASE_STORAGE_BUCKET` | 〃 |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | 〃 |
| `VITE_FIREBASE_APP_ID` | 〃 |

### 4-4. 公開される

`main` ブランチに push すると自動でビルドが走り、数分後に以下のURLで公開されます。

```
https://(ユーザー名).github.io/duel-craft/
```

進捗は「Actions」タブで確認できます。

**以降は、コードを変更して push するだけで自動的に更新されます。**

### 4-5. スマートフォンでアプリのように使う

公開URLをスマホのブラウザで開き、「ホーム画面に追加」を行うと、
アイコンから起動できるようになります。

---

## 5. 効果の追加方法

新しいカード効果を追加する手順です。**ゲーム進行の処理には一切手を入れません。**

### 例: 「相手の手札を1枚見てから捨てさせる」効果を追加する

**① 効果の識別子を追加**

`src/types/card.ts` の `EffectType` に追加します。

```ts
export type EffectType =
  | 'draw'
  | 'discard'
  // ...
  | 'revealAndDiscard';  // ← 追加
```

**② 処理を書く**

`src/game/effects/handlers/` に処理を追加します。

```ts
export const revealAndDiscardHandler: EffectHandler = (ctx) => {
  const { player } = resolveTargetPlayer(ctx);
  // ここに処理を書く
  ctx.log(`${player.name} の手札を公開して捨てさせた。`);
};
```

**③ 登録表に1行足す**

`src/game/effects/effectRegistry.ts` に追加します。

```ts
export const effectRegistry: Record<EffectType, EffectHandler> = {
  draw: drawHandler,
  // ...
  revealAndDiscard: revealAndDiscardHandler,  // ← 追加
};

export const EFFECT_LABEL: Record<EffectType, string> = {
  // ...
  revealAndDiscard: '手札を見てから捨てさせる',  // ← 表示名も追加
};

export const EFFECT_TYPES: EffectType[] = [
  // ...
  'revealAndDiscard',  // ← 一覧にも追加
];
```

以上で完了です。カード作成画面の選択肢に自動的に現れ、対戦中も動作します。

### 発動タイミングについて

効果は以下のタイミングで発動できます。

| 識別子 | タイミング |
|---|---|
| `onSummon` | 出た時 / 使った時 |
| `onAttack` | 攻撃する時 |
| `onBlock` | ブロックした時 |
| `onTurnStart` | ターン開始時 |
| `onTurnEnd` | ターン終了時 |
| `onDestroy` | 破壊された時 |
| `onShieldBreak` | シールドをブレイクした時 |
| `onManaPlaced` | マナゾーンに置かれた時 |
| `onDiscard` | 手札から捨てられた時 |
| `static` | 常在(常に有効) |

---

## 6. プロジェクト構成

```
duel-craft/
├── .github/workflows/
│   └── deploy.yml          … push時に自動で公開する設定
├── src/
│   ├── types/              … 型定義
│   │   ├── card.ts             カード・効果・キーワード能力
│   │   ├── game.ts             ゲーム状態・フェーズ
│   │   └── ui.ts               UI状態(通信では送らない)
│   ├── game/
│   │   ├── engine/         … ルール処理
│   │   │   ├── phaseSystem.ts       フェーズ進行
│   │   │   ├── manaSystem.ts        マナ支払い(多色対応)
│   │   │   ├── combatSystem.ts      戦闘・ブレイク数
│   │   │   ├── evolutionSystem.ts   進化・革命チェンジ・侵略
│   │   │   ├── interactionRules.ts  操作の可否判定
│   │   │   └── zoneVisibility.ts    どのゾーンを見てよいか
│   │   ├── effects/        … 効果の実装
│   │   │   ├── effectRegistry.ts    ★効果の登録表
│   │   │   ├── effectContext.ts     対象の解決
│   │   │   └── handlers/            効果ごとの処理
│   │   └── events/         … イベント駆動の仕組み
│   │       ├── eventBus.ts          イベント発行と解決
│   │       └── eventTypes.ts        9種のイベント定義
│   ├── cards/              … カード関連
│   ├── network/            … 通信・保存
│   │   ├── firebase.ts          Firebase初期化
│   │   ├── roomService.ts       ルーム作成・参加・同期
│   │   ├── useRoom.ts           React用フック
│   │   └── localStore.ts        端末内保存
│   ├── components/         … UI部品
│   ├── screens/            … 画面
│   └── ui/                 … デザイン定義
└── ...
```

### 設計上の方針

- **GameState と UIState を分離**
  通信で同期するのは対戦状態(`GameState`)のみ。選択中のカードやドラッグ位置は
  各自の端末だけの情報なので送らない。相手の操作が自分の画面に干渉しない。

- **効果はイベント駆動**
  進行処理は「イベントを発行する」だけで、どのカードがどう反応するかを知らない。
  効果を追加しても進行処理を変更する必要がない。

- **ルール判定は engine に集約**
  「この操作をしてよいか」の判定を1か所にまとめ、UIとルールで食い違わないようにしている。

---

## ライセンスと権利について

このプロジェクトは、既存のカードゲームの画像・イラスト・ロゴ・音源といった
著作物を一切含んでいません。背景はすべてCSSで描画したオリジナル、
効果音はWeb Audio APIによる自動生成です。

カードに画像を設定する機能がありますが、利用者が用意した画像は
その利用者の端末に保存されます。権利を持つ画像のみをご使用ください。
