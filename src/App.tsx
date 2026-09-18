/**
 * アプリの入口。画面の切り替えを担当する。
 * 現時点では、対戦画面の動作を確かめられる状態にしてある。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Card } from './types/card';
import type { GameState } from './types/game';
import type { FieldId } from './types/ui';

import { BattleScreen } from './screens/BattleScreen';
import { createGame } from './game/engine/gameEngine';
import { isFirebaseConfigured } from './network/firebase';
import { loadCards, loadDecks, loadPlayerName, savePlayerName } from './network/localStore';
import { SAMPLE_CARDS } from './cards/sampleCards';
import { randomFieldId } from './ui/fields';
import { ACCENT, GLASS, INK } from './ui/tokens';
import { startBgm, unlockAudio } from './ui/sound';

type Screen = 'home' | 'battle';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [game, setGame] = useState<GameState | null>(null);
  const [fieldId, setFieldId] = useState<FieldId>('plain');
  const [playerName, setPlayerName] = useState(loadPlayerName() || 'あなた');

  // 作成済みカード。まだ1枚も無ければサンプルを使う。
  const pool: Card[] = useMemo(() => {
    const saved = loadCards();
    return saved.length > 0 ? saved : SAMPLE_CARDS;
  }, []);

  const decks = useMemo(() => loadDecks(), []);

  /** 最初の操作で音を有効にする(ブラウザの制限への対応) */
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      startBgm('menu');
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const startTestBattle = useCallback(() => {
    const deckIds = decks[0]?.cardIds ?? buildSampleDeck(pool);
    const state = createGame(
      { name: playerName, deckCardIds: deckIds },
      { name: '対戦相手', deckCardIds: deckIds }
    );
    setGame(state);
    setFieldId(randomFieldId());
    setScreen('battle');
    savePlayerName(playerName);
  }, [decks, pool, playerName]);

  if (screen === 'battle' && game) {
    return (
      <BattleScreen
        state={game}
        seat="p1"
        pool={pool}
        fieldId={fieldId}
        onStateChange={setGame}
        onExit={() => {
          setScreen('home');
          setGame(null);
          startBgm('menu');
        }}
      />
    );
  }

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        background: 'linear-gradient(180deg,#0B1020,#16233B)',
        color: INK.base,
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <header
          style={{
            borderBottom: `1px solid ${GLASS.edgeSoft}`,
            paddingBottom: 16,
            marginBottom: 20,
          }}
        >
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>Duel Craft</h1>
          <p style={{ fontSize: 13, color: INK.dim, marginTop: 4 }}>
            自分でカードを作って遊べるカードゲーム
          </p>
        </header>

        <section style={panelStyle}>
          <h2 style={h2Style}>対戦を試す</h2>
          <p style={{ fontSize: 13, color: INK.dim, lineHeight: 1.7 }}>
            対戦画面の動作を確認できます。横画面でお試しください。
            {decks.length === 0 &&
              'まだデッキが保存されていないため、サンプルカードで40枚のデッキを自動生成します。'}
          </p>

          <label style={{ display: 'block', marginTop: 14 }}>
            <span style={{ fontSize: 12, color: INK.dim }}>あなたの名前</span>
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 6,
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${GLASS.edgeSoft}`,
                background: 'rgba(255,255,255,0.06)',
                color: INK.base,
                fontFamily: 'inherit',
                fontSize: 14,
              }}
            />
          </label>

          <button onClick={startTestBattle} style={buttonStyle}>
            対戦をはじめる
          </button>
        </section>

        <section style={panelStyle}>
          <h2 style={h2Style}>操作のしかた</h2>
          <ul style={{ fontSize: 13, lineHeight: 1.9, paddingLeft: 18 }}>
            <li>カードを<b>タップ</b>すると選択、もう一度で解除します</li>
            <li>カードを<b>ドラッグ</b>して、マナゾーンやバトルゾーンに運べます</li>
            <li>カードを<b>長押し</b>すると、効果の全文が見られます</li>
            <li>ゾーンを<b>長押し</b>すると、中身の一覧が見られます</li>
            <li>操作は必ず確認画面を挟むので、誤操作しても取り消せます</li>
          </ul>
          <p style={{ fontSize: 12, color: INK.dim, marginTop: 10 }}>
            進行は マナ → メイン → 攻撃 の順です。メインに進むと、そのターンは
            マナを置けなくなります(公式ルールと同じ)。
          </p>
        </section>

        <section style={panelStyle}>
          <h2 style={h2Style}>状態</h2>
          <Row label="作成済みカード" value={`${loadCards().length} 枚`} />
          <Row label="保存されたデッキ" value={`${decks.length} 個`} />
          <Row
            label="オンライン対戦"
            value={isFirebaseConfigured ? '利用できます' : '未設定'}
          />
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 13,
        padding: '5px 0',
      }}
    >
      <span style={{ color: INK.dim }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** サンプルカードから40枚のデッキを作る(同名は最大4枚) */
function buildSampleDeck(pool: Card[]): string[] {
  const ids: string[] = [];
  let index = 0;
  while (ids.length < 40 && pool.length > 0) {
    const card = pool[index % pool.length];
    const count = ids.filter((id) => id === card.id).length;
    if (count < 4) ids.push(card.id);
    index++;
    if (index > pool.length * 6) break;
  }
  return ids;
}

const panelStyle: React.CSSProperties = {
  background: GLASS.panel,
  border: `1px solid ${GLASS.edgeSoft}`,
  borderRadius: 14,
  padding: 18,
  marginBottom: 16,
};

const h2Style: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 10,
};

const buttonStyle: React.CSSProperties = {
  marginTop: 16,
  width: '100%',
  padding: '14px',
  borderRadius: 10,
  border: 'none',
  background: ACCENT.gold,
  color: '#3A2A00',
  fontWeight: 800,
  fontSize: 15,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
