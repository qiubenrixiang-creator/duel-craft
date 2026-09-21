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
import { ACCENT, GLASS, INK, NEON, VOID, clipDiagonal } from './ui/tokens';
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

  /**
   * 最初の操作で音を有効にする(ブラウザの制限への対応)。
   *
   * iPhoneでは一度の解除に失敗することがあるため、
   * 音が鳴り始めるまで何度でも試せるように、解除処理は外さずに残しておく。
   */
  useEffect(() => {
    startBgm('menu');

    const unlock = () => {
      unlockAudio();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('touchend', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchend', unlock);
      window.removeEventListener('keydown', unlock);
    };
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
      className="dc-page-root"
      style={{
        color: INK.base,
        // 暗い下地 + 細いグリッド + 上から差すシアンの光
        background:
          `radial-gradient(120% 80% at 50% -10%,rgba(34,211,238,0.16),transparent 60%),` +
          `repeating-linear-gradient(0deg,transparent 0 31px,rgba(34,211,238,0.05) 31px 32px),` +
          `repeating-linear-gradient(90deg,transparent 0 31px,rgba(34,211,238,0.05) 31px 32px),` +
          `linear-gradient(180deg,${VOID.deep},${VOID.base})`,
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <header style={{ marginBottom: 22 }}>
          <div
            className="hud-num hud-label"
            style={{ fontSize: 10, color: NEON.dim, marginBottom: 6 }}
          >
            DUEL SYSTEM // ONLINE
          </div>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: '0.14em',
              color: NEON.bright,
              textShadow: `0 0 18px ${NEON.glow}`,
            }}
          >
            DUEL CRAFT
          </h1>
          <p style={{ fontSize: 13, color: INK.dim, marginTop: 6 }}>
            自分でカードを作って遊べるカードゲーム
          </p>
          {/* 見出しの下に引く二重線。太さを変えてHUDらしくする。 */}
          <div style={{ marginTop: 14, display: 'flex', gap: 4 }}>
            <div style={{ width: 64, height: 2, background: NEON.core }} />
            <div style={{ flex: 1, height: 2, background: NEON.ghost }} />
          </div>
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
                border: 'none',
                clipPath: clipDiagonal(7),
                boxShadow: `inset 0 0 0 1px ${GLASS.edgeSoft}`,
                background: 'rgba(4,7,15,0.7)',
                color: NEON.bright,
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
  position: 'relative',
  clipPath: clipDiagonal(14),
  background: GLASS.panel,
  boxShadow: `inset 0 0 0 1px ${GLASS.edgeSoft}`,
  padding: 18,
  marginBottom: 16,
};

const h2Style: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: '0.16em',
  color: NEON.core,
  marginBottom: 12,
};

const buttonStyle: React.CSSProperties = {
  marginTop: 16,
  width: '100%',
  padding: '15px',
  border: 'none',
  clipPath: clipDiagonal(12),
  background: `linear-gradient(180deg,${ACCENT.gold},#D89A12)`,
  color: '#1A1200',
  fontWeight: 800,
  fontSize: 15,
  letterSpacing: '0.1em',
  boxShadow: '0 0 18px rgba(255,197,61,0.45)',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
