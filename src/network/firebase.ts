/**
 * Firebase の初期化。
 *
 * 設定値は環境変数から読み込む(.env.local に記述)。
 * リポジトリに鍵を直接書かないため、GitHubで公開しても問題ない。
 *
 * Firestore を選んだ理由:
 *   このゲームで必要なのは「ルームの状態を読み書きし、変化を受け取る」だけで、
 *   リレーショナルDBもSQLも不要。Firestoreの onSnapshot を使えば
 *   ポーリングを書かずにリアルタイム同期ができる。
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * Firebase の設定が済んでいるか。
 *
 * 未設定でもアプリ自体は起動できるようにしてある。
 * カード作成・デッキ構築・NPC対戦は通信を使わないため、
 * Firebaseを設定しなくても遊べる。オンライン対戦だけが使えない状態になる。
 */
export const isFirebaseConfigured = Boolean(
  config.apiKey && config.projectId && config.appId
);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(config);
  db = getFirestore(app);
}

/**
 * Firestore を取得する。
 * 未設定の場合は、原因が分かるメッセージとともに例外を投げる。
 */
export function getDb(): Firestore {
  if (!db) {
    throw new Error(
      'Firebaseが設定されていません。.env.local に接続情報を記入してください(READMEの手順②を参照)。'
    );
  }
  return db;
}
