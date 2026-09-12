/**
 * アプリの入口。
 *
 * 現時点では UI(画面)の実装が未着手のため、
 * 「環境が正しく動いているか」を確認するための暫定画面を表示している。
 *
 * 工程が進むにつれ、ここから BattleScreen や CardEditorScreen へ
 * 画面を切り替える形に置き換わる。
 */

import { useEffect, useState } from 'react';
import { isFirebaseConfigured } from './network/firebase';
import { loadCards, loadDecks, estimateUsage } from './network/localStore';
import { EFFECT_TYPES, EFFECT_LABEL } from './game/effects/effectRegistry';
import { EVENT_TYPES, EVENT_LABEL } from './game/events/eventTypes';
import { formatBytes } from './cards/imageProcessor';

export default function App() {
  const [cardCount, setCardCount] = useState(0);
  const [deckCount, setDeckCount] = useState(0);
  const [usage, setUsage] = useState(0);

  useEffect(() => {
    setCardCount(loadCards().length);
    setDeckCount(loadDecks().length);
    setUsage(estimateUsage());
  }, []);

  return (
    <div className="h-full overflow-auto bg-[#0B1020] text-[#F4F7FB] p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="border-b border-white/10 pb-4">
          <h1 className="text-2xl font-bold">Duel Craft</h1>
          <p className="text-sm text-white/50 mt-1">
            セットアップ確認用の画面です。この画面が見えていれば、ビルドと起動は成功しています。
          </p>
        </header>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="font-bold mb-3">動作状況</h2>
          <dl className="space-y-2 text-sm">
            <Row
              label="オンライン対戦"
              value={
                isFirebaseConfigured
                  ? '利用できます'
                  : '未設定(カード作成・NPC対戦のみ利用できます)'
              }
              ok={isFirebaseConfigured}
            />
            <Row label="保存されたカード" value={`${cardCount} 枚`} ok />
            <Row label="保存されたデッキ" value={`${deckCount} 個`} ok />
            <Row label="保存容量の使用量" value={formatBytes(usage)} ok />
          </dl>
          {!isFirebaseConfigured && (
            <p className="text-xs text-white/50 mt-3 leading-relaxed">
              オンライン対戦を使うには、READMEの「③ オンライン対戦の設定」に従って
              .env.local を作成してください。設定しなくてもカード作成・デッキ構築・
              NPC対戦は利用できます。
            </p>
          )}
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="font-bold mb-3">
            対応している発動タイミング({EVENT_TYPES.length}種)
          </h2>
          <div className="flex flex-wrap gap-2">
            {EVENT_TYPES.map((e) => (
              <span
                key={e}
                className="text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/10"
              >
                {EVENT_LABEL[e]}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="font-bold mb-3">
            対応している効果({EFFECT_TYPES.length}種)
          </h2>
          <div className="flex flex-wrap gap-2">
            {EFFECT_TYPES.map((e) => (
              <span
                key={e}
                className="text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/10"
              >
                {EFFECT_LABEL[e]}
              </span>
            ))}
          </div>
          <p className="text-xs text-white/50 mt-3">
            効果を追加する手順は README の「効果の追加方法」を参照してください。
          </p>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="font-bold mb-2">次の工程</h2>
          <p className="text-sm text-white/60 leading-relaxed">
            ゲームエンジン・効果処理・通信の実装は完了しています。
            次は対戦画面などのUIを実装し、この画面と置き換えます。
          </p>
        </section>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-white/60">{label}</dt>
      <dd className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: ok ? '#3FD08A' : '#FFD24A' }}
        />
        <span>{value}</span>
      </dd>
    </div>
  );
}
