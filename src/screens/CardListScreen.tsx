/**
 * 作ったカードの一覧。
 *
 * ここから新規作成・編集・複製・削除を行う。
 * カードが増えても探せるよう、名前での絞り込みと文明での絞り込みを付けている。
 *
 * サンプルカードも同じ一覧に並べるが、書き換えはできない。
 * かわりに「複製して作る」ことで、真似しながら自分のカードを作れるようにしている。
 */

import { useMemo, useState } from 'react';
import type { Card, Civilization } from '../types/card';
import { CardView } from '../components/CardView';
import { Button, ChipGroup, Notice, TextInput } from '../components/FormControls';
import { Header, pageStyle } from './CardEditorScreen';
import { CardModal } from '../components/Modals';
import {
  ALL_CIVILIZATIONS,
  CIV_COLOR,
  CIV_LABEL,
  GLASS,
  INK,
  NEON,
  clipDiagonal,
} from '../ui/tokens';

export interface CardListScreenProps {
  cards: Card[];
  /** サンプルカード(自作カードが0枚のときの見本) */
  samples: Card[];
  onCreate: () => void;
  onEdit: (card: Card) => void;
  onDuplicate: (card: Card) => void;
  onDelete: (card: Card) => void;
  onBack: () => void;
  /** 保存に失敗している場合の案内 */
  storageError?: string | null;
}

export function CardListScreen({
  cards,
  samples,
  onCreate,
  onEdit,
  onDuplicate,
  onDelete,
  onBack,
  storageError,
}: CardListScreenProps) {
  const [query, setQuery] = useState('');
  const [civFilter, setCivFilter] = useState<Civilization[]>([]);
  const [inspect, setInspect] = useState<Card | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Card | null>(null);

  /** 自作カードを先に、サンプルを後ろに並べる */
  const all = useMemo(() => [...cards, ...samples], [cards, samples]);

  const visible = useMemo(() => {
    const q = query.trim();
    return all.filter((c) => {
      if (q && !`${c.name}${c.nameRuby ?? ''}${c.race ?? ''}`.includes(q)) {
        return false;
      }
      if (civFilter.length > 0) {
        return c.civilizations.some((civ) => civFilter.includes(civ));
      }
      return true;
    });
  }, [all, query, civFilter]);

  const toggleCiv = (civ: Civilization) =>
    setCivFilter((prev) =>
      prev.includes(civ) ? prev.filter((c) => c !== civ) : [...prev, civ]
    );

  return (
    <div className="dc-page-root" style={pageStyle}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <Header
          title="カード一覧"
          onCancel={onBack}
          right={
            <span
              className="hud-num hud-label"
              style={{ fontSize: 11, color: NEON.dim, whiteSpace: 'nowrap' }}
            >
              {cards.length} 枚
            </span>
          }
        />

        {storageError && <Notice tone="error">{storageError}</Notice>}

        <div style={{ marginBottom: 16 }}>
          <Button onClick={onCreate} tone="primary" full>
            ＋ 新しいカードを作る
          </Button>
        </div>

        {/* 絞り込み */}
        <div
          style={{
            padding: 14,
            marginBottom: 18,
            clipPath: clipDiagonal(12),
            background: GLASS.panel,
            boxShadow: `inset 0 0 0 1px ${GLASS.edgeSoft}`,
          }}
        >
          <div style={{ marginBottom: 10 }}>
            <TextInput
              value={query}
              onChange={setQuery}
              placeholder="カード名・種族で探す"
            />
          </div>
          <ChipGroup
            multiple
            options={ALL_CIVILIZATIONS.map((c) => ({
              value: c,
              label: CIV_LABEL[c],
            }))}
            values={civFilter}
            onToggle={toggleCiv}
            colorOf={(c) => CIV_COLOR[c as Civilization]}
          />
        </div>

        {visible.length === 0 && (
          <p style={{ fontSize: 13, color: INK.dim, textAlign: 'center', padding: 40 }}>
            {all.length === 0
              ? 'まだカードがありません。上のボタンから作ってみてください。'
              : '条件に合うカードがありません。'}
          </p>
        )}

        {/* カードを敷き詰める。1枚ずつ、下に操作ボタンを置く。 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))',
            gap: 16,
            paddingBottom: 20,
          }}
        >
          {visible.map((card) => (
            <CardCell
              key={card.id}
              card={card}
              onInspect={() => setInspect(card)}
              onEdit={() => onEdit(card)}
              onDuplicate={() => onDuplicate(card)}
              onDelete={() => setConfirmDelete(card)}
            />
          ))}
        </div>
      </div>

      {inspect && <CardModal card={inspect} onClose={() => setInspect(null)} />}

      {confirmDelete && (
        <DeleteConfirm
          card={confirmDelete}
          onConfirm={() => {
            onDelete(confirmDelete);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

/* ===== 一覧の1枠 ===== */

function CardCell({
  card,
  onInspect,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  card: Card;
  onInspect: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const isSample = Boolean(card.builtin);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        clipPath: clipDiagonal(12),
        background: 'rgba(7,16,31,0.5)',
        boxShadow: `inset 0 0 0 1px ${GLASS.edgeSoft}`,
      }}
    >
      {/*
        一覧ではタップで詳細を開く。
        allowScroll を付けて、カードの上から指を滑らせても画面がスクロールできるようにする。
      */}
      <CardView card={card} scale={1.05} onTap={onInspect} allowScroll />

      {isSample && (
        <span
          className="hud-label"
          style={{ fontSize: 9, color: INK.dim, letterSpacing: '0.14em' }}
        >
          SAMPLE
        </span>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {isSample ? (
          <SmallButton onClick={onDuplicate}>複製して作る</SmallButton>
        ) : (
          <>
            <SmallButton onClick={onEdit}>編集</SmallButton>
            <SmallButton onClick={onDuplicate}>複製</SmallButton>
            <SmallButton onClick={onDelete} danger>
              削除
            </SmallButton>
          </>
        )}
      </div>
    </div>
  );
}

function SmallButton({
  children,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 36,
        padding: '8px 12px',
        border: 'none',
        clipPath: clipDiagonal(6),
        background: danger ? 'rgba(255,77,109,0.12)' : 'rgba(34,211,238,0.10)',
        boxShadow: `inset 0 0 0 1px ${danger ? 'rgba(255,77,109,0.55)' : NEON.faint}`,
        color: danger ? '#FF8DA3' : NEON.bright,
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

/* ===== 削除の確認 ===== */

function DeleteConfirm({
  card,
  onConfirm,
  onCancel,
}: {
  card: Card;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding:
          'max(12px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))' +
          ' max(12px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
        background: 'rgba(3,6,12,0.78)',
        backdropFilter: 'blur(5px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 380,
          padding: 22,
          clipPath: clipDiagonal(16),
          background: GLASS.panel,
          boxShadow: `inset 0 0 0 1px ${GLASS.edge}`,
          color: INK.base,
        }}
      >
        <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.7, marginBottom: 8 }}>
          「{card.name}」を削除しますか？
        </p>
        <p style={{ fontSize: 12, color: INK.dim, lineHeight: 1.7, marginBottom: 18 }}>
          元に戻せません。このカードを入れているデッキからも外れます。
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button tone="danger" onClick={onConfirm} full>
            削除する
          </Button>
          <Button onClick={onCancel} full>
            やめる
          </Button>
        </div>
      </div>
    </div>
  );
}
