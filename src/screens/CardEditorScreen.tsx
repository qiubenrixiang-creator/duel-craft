/**
 * カード作成画面。
 *
 * このゲームの中心になる画面で、ここで作ったカードが対戦で使われる。
 *
 * 【画面の構え】
 * 左に入力欄、右に出来上がりのカードを常に出しておき、
 * 打ち込んだ内容がその場で反映されるようにしている。
 * 狭い画面では縦に積み、カードのプレビューは上部に貼り付ける。
 *
 * 【入力の方針】
 * 遊べないカードが保存されないよう、保存前に必ず検証する。
 * ただし「強すぎる」ことは止めない(自作カードで遊ぶゲームのため)。
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  Card,
  CardEffect,
  CardType,
  Civilization,
  EventType,
  EffectType,
  KeywordAbilities,
  Rarity,
  TargetType,
} from '../types/card';
import { CardView } from '../components/CardView';
import {
  Button,
  ChipGroup,
  Field,
  Notice,
  NumberInput,
  Section,
  TextArea,
  TextInput,
  Toggle,
} from '../components/FormControls';
import {
  EFFECT_LABEL,
  EFFECT_TYPES,
  TARGET_LABEL,
  TARGET_TYPES,
  VALUE_REQUIRED_EFFECTS,
} from '../game/effects/effectRegistry';
import { EVENT_LABEL, EVENT_TYPES } from '../game/events/eventTypes';
import { RARITY_LABEL, RARITY_ORDER } from '../types/collection';
import {
  ACCEPTED_TYPES,
  SIZE_WARN_THRESHOLD,
  formatBytes,
  processCardImage,
} from '../cards/imageProcessor';
import {
  ALL_CIVILIZATIONS,
  CIV_COLOR,
  CIV_LABEL,
  GLASS,
  INK,
  NEON,
  VOID,
  clipDiagonal,
} from '../ui/tokens';

/* ===== 選択肢 ===== */

const CARD_TYPES: { value: CardType; label: string }[] = [
  { value: 'creature', label: 'クリーチャー' },
  { value: 'spell', label: '呪文' },
  { value: 'evolution', label: '進化' },
  { value: 'crossGear', label: 'クロスギア' },
];

/** パワーを持つ種別。呪文にはパワー欄を出さない。 */
const HAS_POWER: CardType[] = ['creature', 'evolution'];

export interface CardEditorScreenProps {
  /** 編集するカード。新規作成なら undefined。 */
  editing?: Card;
  /** 既存カード(名前の重複を知らせるために使う) */
  existing: Card[];
  onSave: (card: Card) => void;
  onCancel: () => void;
}

export function CardEditorScreen({
  editing,
  existing,
  onSave,
  onCancel,
}: CardEditorScreenProps) {
  /* ===== 入力の状態 ===== */
  const [name, setName] = useState(editing?.name ?? '');
  const [nameRuby, setNameRuby] = useState(editing?.nameRuby ?? '');
  const [type, setType] = useState<CardType>(editing?.type ?? 'creature');
  const [civilizations, setCivilizations] = useState<Civilization[]>(
    editing?.civilizations ?? ['fire']
  );
  const [cost, setCost] = useState(editing?.cost ?? 3);
  const [power, setPower] = useState(editing?.power ?? 2000);
  const [race, setRace] = useState(editing?.race ?? '');
  const [flavor, setFlavor] = useState(editing?.flavor ?? '');
  const [rarity, setRarity] = useState<Rarity>(editing?.rarity ?? 'N');
  const [foil, setFoil] = useState(editing?.foil ?? false);
  const [image, setImage] = useState<string | undefined>(editing?.image);
  const [imageBytes, setImageBytes] = useState(0);
  const [imageError, setImageError] = useState<string | null>(null);
  const [effects, setEffects] = useState<CardEffect[]>(editing?.effects ?? []);
  const [keywords, setKeywords] = useState<KeywordAbilities>(
    editing?.keywords ?? {}
  );
  /** 保存を押したあとだけ、入力の不備を赤く出す */
  const [submitted, setSubmitted] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);

  /** プレビュー用に、今の入力からカードを組み立てる */
  const preview: Card = useMemo(
    () => ({
      id: editing?.id ?? 'preview',
      name: name || '(名前未設定)',
      nameRuby: nameRuby || undefined,
      cost,
      civilizations: civilizations.length > 0 ? civilizations : ['fire'],
      power: HAS_POWER.includes(type) ? power : undefined,
      race: race || undefined,
      type,
      effects,
      keywords,
      image,
      flavor: flavor || undefined,
      rarity,
      foil,
    }),
    [
      editing?.id, name, nameRuby, cost, civilizations, power, race, type,
      effects, keywords, image, flavor, rarity, foil,
    ]
  );

  /* ===== 検証 ===== */

  const problems = useMemo(() => {
    const list: string[] = [];
    if (!name.trim()) list.push('カード名を入力してください。');
    if (civilizations.length === 0) list.push('文明を1つ以上選んでください。');
    if (HAS_POWER.includes(type) && power <= 0) {
      list.push('クリーチャーのパワーは1以上にしてください。');
    }
    if (type === 'evolution' && !keywords.evolutionFrom?.race?.trim()) {
      list.push('進化クリーチャーには、進化元の種族を指定してください。');
    }
    const duplicate = existing.some(
      (c) => c.id !== editing?.id && c.name.trim() === name.trim()
    );
    if (name.trim() && duplicate) {
      list.push('同じ名前のカードが既にあります。別の名前にしてください。');
    }
    return list;
  }, [name, civilizations, type, power, keywords.evolutionFrom, existing, editing?.id]);

  const canSave = problems.length === 0;

  /* ===== 操作 ===== */

  const toggleCivilization = useCallback((civ: Civilization) => {
    setCivilizations((prev) => {
      if (prev.includes(civ)) {
        // 最後の1つは外させない(文明なしのカードは作れないため)
        return prev.length === 1 ? prev : prev.filter((c) => c !== civ);
      }
      // 多色は2文明まで(マナの支払い処理が2色を前提にしている)
      return prev.length >= 2 ? [prev[1], civ] : [...prev, civ];
    });
  }, []);

  const pickImage = useCallback(async (file: File) => {
    setImageError(null);
    try {
      const processed = await processCardImage(file);
      setImage(processed.dataUrl);
      setImageBytes(processed.bytes);
    } catch (e) {
      setImageError(e instanceof Error ? e.message : '画像を読み込めませんでした。');
    }
  }, []);

  const addEffect = useCallback(() => {
    setEffects((prev) => [
      ...prev,
      { trigger: 'onSummon', effect: 'draw', target: 'self', value: 1 },
    ]);
  }, []);

  const updateEffect = useCallback((index: number, patch: Partial<CardEffect>) => {
    setEffects((prev) =>
      prev.map((e, i) => (i === index ? { ...e, ...patch } : e))
    );
  }, []);

  const removeEffect = useCallback((index: number) => {
    setEffects((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const setKeyword = useCallback(
    <K extends keyof KeywordAbilities>(key: K, value: KeywordAbilities[K]) => {
      setKeywords((prev) => {
        const next = { ...prev };
        // false や 0 は「無し」として保存しない(データを小さく保つ)
        if (value === false || value === 0 || value === undefined) {
          delete next[key];
        } else {
          next[key] = value;
        }
        return next;
      });
    },
    []
  );

  const handleSave = useCallback(() => {
    setSubmitted(true);
    if (!canSave) return;

    onSave({
      ...preview,
      id: editing?.id ?? `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      race: race.trim() || undefined,
      // builtin(サンプル)を編集した場合は、自作カードとして保存し直す
      builtin: undefined,
    });
  }, [canSave, onSave, preview, editing?.id, name, race]);

  /* ===== 描画 ===== */

  const showPower = HAS_POWER.includes(type);

  return (
    <div className="dc-page-root" style={pageStyle}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <Header
          title={editing ? 'カードを編集' : '新しいカードを作る'}
          onCancel={onCancel}
        />

        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* ===== 出来上がりの確認 ===== */}
          <div className="dc-editor-preview">
            <div style={previewBoxStyle}>
              <div
                className="hud-label"
                style={{ fontSize: 10, color: NEON.dim, marginBottom: 12 }}
              >
                PREVIEW
              </div>
              <CardView card={preview} scale={1.35} />
            </div>

            {/* 広い画面では、確認カードの下に保存ボタンを置く */}
            <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
              <Button onClick={handleSave} tone="primary" full disabled={!canSave}>
                {editing ? '変更を保存' : 'このカードを作る'}
              </Button>
              <Button onClick={onCancel} full>
                やめる
              </Button>
            </div>
          </div>

          {/* ===== 入力 ===== */}
          <div style={{ flex: 1, minWidth: 300 }}>
            {submitted && problems.length > 0 && (
              <Notice tone="error">
                {problems.map((p, i) => (
                  <div key={i}>・{p}</div>
                ))}
              </Notice>
            )}

            <Section title="基本">
              <Field label="カード名">
                <TextInput
                  value={name}
                  onChange={setName}
                  placeholder="例: 蒼雷のドラグーン"
                  maxLength={40}
                />
              </Field>

              <Field label="ふりがな" hint="カード名の上に小さく表示されます。省略できます。">
                <TextInput
                  value={nameRuby}
                  onChange={setNameRuby}
                  placeholder="例: そうらいのドラグーン"
                  maxLength={60}
                />
              </Field>

              <Field label="種別">
                <ChipGroup options={CARD_TYPES} value={type} onChange={setType} />
              </Field>

              <Field
                label="文明"
                hint="2つ選ぶと多色カードになります。多色はマナに置く時タップされ、支払いに各文明が1枚ずつ必要です。"
              >
                <ChipGroup
                  multiple
                  options={ALL_CIVILIZATIONS.map((c) => ({
                    value: c,
                    label: CIV_LABEL[c],
                  }))}
                  values={civilizations}
                  onToggle={toggleCivilization}
                  colorOf={(c) => CIV_COLOR[c as Civilization]}
                />
              </Field>

              <Field label="コスト">
                <NumberInput value={cost} onChange={setCost} min={0} max={20} />
              </Field>

              {showPower && (
                <Field label="パワー">
                  <NumberInput
                    value={power}
                    onChange={setPower}
                    min={0}
                    max={99999}
                    step={500}
                  />
                </Field>
              )}

              {showPower && (
                <Field
                  label="種族"
                  hint="進化・革命チェンジ・侵略の条件に使われます。複数ある場合は「・」で区切ってください。"
                >
                  <TextInput
                    value={race}
                    onChange={setRace}
                    placeholder="例: アーマード・ドラゴン"
                    maxLength={40}
                  />
                </Field>
              )}
            </Section>

            <Section
              title="イラスト"
              note="選んだ画像はこの端末の中だけに保存されます。自動で縮小されます。"
            >
              {imageError && <Notice tone="error">{imageError}</Notice>}
              {imageBytes > SIZE_WARN_THRESHOLD && (
                <Notice>
                  画像が大きめです({formatBytes(imageBytes)})。
                  カードをたくさん作ると保存できなくなることがあります。
                </Notice>
              )}

              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void pickImage(file);
                  // 同じ画像をもう一度選べるようにする
                  e.target.value = '';
                }}
              />

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button onClick={() => fileRef.current?.click()}>
                  {image ? '画像を選び直す' : '画像を選ぶ'}
                </Button>
                {image && (
                  <Button
                    tone="danger"
                    onClick={() => {
                      setImage(undefined);
                      setImageBytes(0);
                    }}
                  >
                    画像を外す
                  </Button>
                )}
              </div>
            </Section>

            <Section
              title="効果"
              note="「いつ」「何を」「誰に」の3つを選びます。いくつでも追加できます。"
            >
              {effects.map((effect, i) => (
                <EffectRow
                  key={i}
                  index={i}
                  effect={effect}
                  onChange={(patch) => updateEffect(i, patch)}
                  onRemove={() => removeEffect(i)}
                />
              ))}
              {effects.length === 0 && (
                <p style={{ fontSize: 12, color: INK.dim, marginBottom: 12 }}>
                  効果なしでも保存できます。バニラ(効果のない)クリーチャーになります。
                </p>
              )}
              <Button onClick={addEffect} full>
                ＋ 効果を追加
              </Button>
            </Section>

            <KeywordSection
              keywords={keywords}
              setKeyword={setKeyword}
              type={type}
            />

            <Section title="見た目と記載">
              <Field label="レアリティ" hint="強さには影響しません。枠と演出だけが変わります。">
                <ChipGroup
                  options={RARITY_ORDER.map((r) => ({
                    value: r,
                    label: `${r}(${RARITY_LABEL[r]})`,
                  }))}
                  value={rarity}
                  onChange={setRarity}
                />
              </Field>

              <Toggle
                label="キラ加工にする"
                description="カード面に斜めの光沢が入ります。"
                checked={foil}
                onChange={setFoil}
              />

              <div style={{ marginTop: 14 }}>
                <Field label="フレーバーテキスト" hint="ゲームの進行には影響しません。">
                  <TextArea
                    value={flavor}
                    onChange={setFlavor}
                    placeholder="例: 雷光は、空を裂いてから音を連れてくる。"
                    maxLength={120}
                  />
                </Field>
              </div>
            </Section>

            {/* 狭い画面用。プレビュー横のボタンが画面外にあるため、ここにも置く。 */}
            <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
              <Button onClick={handleSave} tone="primary" full disabled={!canSave}>
                {editing ? '変更を保存' : 'このカードを作る'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== 効果1つ分の行 ===== */

function EffectRow({
  index,
  effect,
  onChange,
  onRemove,
}: {
  index: number;
  effect: CardEffect;
  onChange: (patch: Partial<CardEffect>) => void;
  onRemove: () => void;
}) {
  const needsValue = VALUE_REQUIRED_EFFECTS.includes(effect.effect);

  return (
    <div
      style={{
        padding: 14,
        marginBottom: 12,
        clipPath: clipDiagonal(10),
        background: 'rgba(4,7,15,0.5)',
        boxShadow: `inset 0 0 0 1px ${GLASS.edgeSoft}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span
          className="hud-num hud-label"
          style={{ fontSize: 11, color: NEON.core }}
        >
          効果 {String(index + 1).padStart(2, '0')}
        </span>
        <Button tone="danger" onClick={onRemove}>
          削除
        </Button>
      </div>

      <Field label="いつ">
        <NativeSelect
          value={effect.trigger}
          options={EVENT_TYPES.map((t) => ({ value: t, label: EVENT_LABEL[t] }))}
          onChange={(v) => onChange({ trigger: v as EventType })}
        />
      </Field>

      <Field label="何を">
        <NativeSelect
          value={effect.effect}
          options={EFFECT_TYPES.map((t) => ({ value: t, label: EFFECT_LABEL[t] }))}
          onChange={(v) => onChange({ effect: v as EffectType })}
        />
      </Field>

      <Field label="誰に">
        <NativeSelect
          value={effect.target}
          options={TARGET_TYPES.map((t) => ({ value: t, label: TARGET_LABEL[t] }))}
          onChange={(v) => onChange({ target: v as TargetType })}
        />
      </Field>

      {needsValue && (
        <Field label="数値" hint="引く枚数・上げるパワーなど。">
          <NumberInput
            value={effect.value ?? 1}
            onChange={(v) => onChange({ value: v })}
            min={0}
            max={99999}
            step={effect.effect === 'powerUp' || effect.effect === 'powerDown' ? 500 : 1}
          />
        </Field>
      )}
    </div>
  );
}

/* ===== キーワード能力 ===== */

function KeywordSection({
  keywords,
  setKeyword,
  type,
}: {
  keywords: KeywordAbilities;
  setKeyword: <K extends keyof KeywordAbilities>(
    key: K,
    value: KeywordAbilities[K]
  ) => void;
  type: CardType;
}) {
  const flags: {
    key: keyof KeywordAbilities;
    label: string;
    description: string;
  }[] = [
    { key: 'speedAttacker', label: 'スピードアタッカー', description: '出したターンから攻撃できる' },
    { key: 'blocker', label: 'ブロッカー', description: '相手の攻撃をタップして防げる' },
    { key: 'shieldTrigger', label: 'S・トリガー', description: 'シールドから手札に加わる時、コスト無しで使える' },
    { key: 'gStrike', label: 'G・ストライク', description: '見せると、相手クリーチャー1体が攻撃できなくなる' },
    { key: 'slayer', label: 'スレイヤー', description: 'バトルした相手を、パワーに関わらず破壊する' },
    { key: 'cannotBeBlocked', label: 'ブロックされない', description: '相手のブロッカーを無視して攻撃できる' },
    { key: 'machFighter', label: 'マッハファイター', description: '出たターンに相手クリーチャーを攻撃できる' },
    { key: 'justDiver', label: 'ジャストダイバー', description: '出た次の自分のターンまで、相手の能力の対象にならない' },
    { key: 'poweredBreaker', label: 'パワード・ブレイカー', description: 'パワー6000ごとにブレイク数が1増える' },
    { key: 'escape', label: 'エスケープ', description: '破壊される時、かわりに自分のシールドを1枚手札に加える' },
  ];

  const breakers: { value: string; label: string }[] = [
    { value: 'none', label: 'なし' },
    { value: 'W', label: 'W・ブレイカー' },
    { value: 'T', label: 'T・ブレイカー' },
    { value: 'Q', label: 'Q・ブレイカー' },
    { value: 'world', label: 'ワールド・ブレイカー' },
  ];

  return (
    <Section
      title="キーワード能力"
      note="デュエル・マスターズでおなじみの、常に働く性質です。必要なものだけ選んでください。"
    >
      {flags.map((f) => (
        <Toggle
          key={f.key}
          label={f.label}
          description={f.description}
          checked={Boolean(keywords[f.key])}
          onChange={(v) => setKeyword(f.key, v as never)}
        />
      ))}

      <div style={{ marginTop: 16 }}>
        <Field label="ブレイク数" hint="シールドを一度に何枚割れるかです。">
          <ChipGroup
            options={breakers}
            value={keywords.breakerType ?? 'none'}
            onChange={(v) =>
              setKeyword(
                'breakerType',
                v === 'none' ? undefined : (v as KeywordAbilities['breakerType'])
              )
            }
          />
        </Field>

        <Field label="パワーアタッカー" hint="攻撃する時だけ加算されるパワー。0なら無しです。">
          <NumberInput
            value={keywords.powerAttacker ?? 0}
            onChange={(v) => setKeyword('powerAttacker', v)}
            min={0}
            max={99999}
            step={1000}
          />
        </Field>

        <Field label="コスト軽減" hint="召喚コストを下げます。0なら無しです。">
          <NumberInput
            value={keywords.costReduction ?? 0}
            onChange={(v) => setKeyword('costReduction', v)}
            min={0}
            max={20}
          />
        </Field>

        {type === 'evolution' && (
          <Field
            label="進化元の種族"
            hint="この種族のクリーチャーの上に重ねて出せます。進化には必須です。"
          >
            <TextInput
              value={keywords.evolutionFrom?.race ?? ''}
              onChange={(v) =>
                setKeyword('evolutionFrom', v.trim() ? { race: v } : undefined)
              }
              placeholder="例: アーマード・ドラゴン"
              maxLength={40}
            />
          </Field>
        )}
      </div>
    </Section>
  );
}

/* ===== 共通の部品 ===== */

/**
 * 選択肢が多いものはプルダウンにする。
 * 端末ごとの見た目の差はあるが、10個以上の選択肢を並べるより扱いやすい。
 */
function NativeSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        display: 'block',
        width: '100%',
        minHeight: 46,
        padding: '11px 12px',
        border: 'none',
        clipPath: clipDiagonal(7),
        boxShadow: `inset 0 0 0 1px ${GLASS.edgeSoft}`,
        background: 'rgba(4,7,15,0.7)',
        color: NEON.bright,
        fontFamily: 'inherit',
        fontSize: 16,
      }}
    >
      {options.map((o) => (
        // 選択肢の文字色は端末側が決めるため、暗い背景を明示しておく
        <option key={o.value} value={o.value} style={{ background: VOID.deep }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Header({
  title,
  onCancel,
  right,
}: {
  title: string;
  onCancel: () => void;
  right?: React.ReactNode;
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
      }}
    >
      <button
        type="button"
        onClick={onCancel}
        aria-label="戻る"
        style={{
          width: 40,
          height: 40,
          flexShrink: 0,
          border: 'none',
          clipPath: clipDiagonal(8),
          background: 'rgba(4,7,15,0.7)',
          boxShadow: `inset 0 0 0 1px ${NEON.faint}`,
          color: INK.dim,
          fontSize: 16,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        ←
      </button>
      <h1
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 19,
          fontWeight: 800,
          letterSpacing: '0.1em',
          color: NEON.bright,
          textShadow: `0 0 14px ${NEON.glow}`,
        }}
      >
        {title}
      </h1>
      {right}
    </header>
  );
}

/* ===== 見た目の値 ===== */

export const pageStyle: React.CSSProperties = {
  color: INK.base,
  background:
    'radial-gradient(120% 80% at 50% -10%,rgba(34,211,238,0.16),transparent 60%),' +
    'repeating-linear-gradient(0deg,transparent 0 31px,rgba(34,211,238,0.05) 31px 32px),' +
    'repeating-linear-gradient(90deg,transparent 0 31px,rgba(34,211,238,0.05) 31px 32px),' +
    'linear-gradient(180deg,#070D1A,#04070F)',
};

const previewBoxStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: 18,
  clipPath: clipDiagonal(14),
  background: GLASS.panel,
  boxShadow: `inset 0 0 0 1px ${GLASS.edgeSoft}`,
};
