/**
 * カードに関する型定義。
 * カードの「設計図」(Card)と、場に存在する「実体」(CardInstance)は別物として扱う。
 * 例: 同じ《紅蓮の突撃兵》を3枚デッキに入れた場合、Cardは1つ、CardInstanceは3つになる。
 */

/** 5つの文明 */
export type Civilization = 'fire' | 'water' | 'light' | 'darkness' | 'nature';

/** カードの種別 */
export type CardType =
  | 'creature' // クリーチャー
  | 'spell' // 呪文
  | 'crossGear' // クロスギア
  | 'evolution' // 進化クリーチャー
  | 'twinpact'; // ツインパクト(1枚でクリーチャー面と呪文面を持つ)

/**
 * 効果が発火するタイミング。
 * カードの効果はすべてこのいずれかに紐づき、該当タイミングでイベントが
 * 発行されると自動的に解決される。
 */
export type EventType =
  | 'onSummon' // 召喚時 / 使った時
  | 'onAttack' // 攻撃する時
  | 'onBlock' // ブロックした時
  | 'onTurnStart' // 自分のターンの開始時
  | 'onTurnEnd' // 自分のターンの終了時
  | 'onDestroy' // 破壊されて墓地に置かれた時
  | 'onShieldBreak' // シールドをブレイクした時
  | 'onManaPlaced' // マナゾーンに置かれた時
  | 'onDiscard' // 手札から捨てられた時
  | 'static'; // 常在(発火せず、常に参照される)

/** 効果の内容 */
export type EffectType =
  | 'draw' // カードを引く
  | 'discard' // 手札を捨てる
  | 'destroy' // クリーチャーを破壊する
  | 'powerUp' // パワーを上げる
  | 'powerDown' // パワーを下げる
  | 'toMana' // マナゾーンへ置く
  | 'addShield' // シールドを追加する
  | 'addBreaker' // ブレイクする数を増やす(常在専用)
  | 'bounce' // 手札に戻す
  | 'reviveFromGraveyard' // 墓地から手札に戻す
  | 'tap' // タップする
  | 'untap' // アンタップする
  | 'preventAttack'; // そのターン攻撃できなくする

/** 効果の対象 */
export type TargetType =
  | 'self' // 自分(プレイヤー)
  | 'opponent' // 相手(プレイヤー)
  | 'ownCreatures' // 自分のクリーチャーすべて
  | 'opponentCreatures' // 相手のクリーチャーすべて
  | 'ownRandom' // 自分のクリーチャーからランダムに
  | 'opponentRandom' // 相手のクリーチャーからランダムに
  | 'chosenOwn' // 自分のクリーチャーから選んだ1体
  | 'chosenOpponent' // 相手のクリーチャーから選んだ1体
  | 'chosen' // 自分・相手どちらからでも選んだ1体
  | 'all'; // すべてのクリーチャー

/** 1つの効果。カードは複数持てる。 */
export interface CardEffect {
  trigger: EventType;
  effect: EffectType;
  target: TargetType;
  /** 引く枚数・上げるパワーなど。省略時は1として扱う。 */
  value?: number;
}

/** 種族・文明による条件指定(進化元、革命チェンジ元などで使う) */
export interface RaceCivCondition {
  /** カンマ区切りで複数指定可。空なら種族を問わない。 */
  race?: string;
  /** 未指定なら文明を問わない。 */
  civilization?: Civilization;
}

/** ブレイク数を増やす能力の種類 */
export type BreakerType = 'W' | 'T' | 'Q' | 'world';

/**
 * キーワード能力。
 * 効果(CardEffect)と違い、これらは常に働く固有の性質として扱う。
 */
export interface KeywordAbilities {
  /** 出たターンから攻撃できる */
  speedAttacker?: boolean;
  /** 相手の攻撃をタップして防げる */
  blocker?: boolean;
  /** シールドから手札に加わる時、コスト無しで使える */
  shieldTrigger?: boolean;
  /** シールドから手札に加える時に見せ、相手クリーチャー1体を攻撃できなくする */
  gStrike?: boolean;
  /** バトルした相手を、パワーに関わらず破壊する */
  slayer?: boolean;
  /** ブロックされない */
  cannotBeBlocked?: boolean;
  /** 出たターン、タップ・アンタップに関わらず相手クリーチャーを攻撃できる */
  machFighter?: boolean;
  /** 出た次の自分のターンまで、相手の能力の対象にならない */
  justDiver?: boolean;
  /** パワー6000ごとにブレイク数が1増える */
  poweredBreaker?: boolean;
  /** 破壊される時、墓地に置くかわりに自分のシールドを1枚手札に加える */
  escape?: boolean;
  /** W/T/Q/ワールド・ブレイカー */
  breakerType?: BreakerType;
  /** 攻撃する時のみ加算されるパワー。0または未設定なら無し。 */
  powerAttacker?: number;
  /** 召喚コストの軽減値。0または未設定なら無し。 */
  costReduction?: number;
  /** 革命チェンジ: 条件を満たす自分のクリーチャーの攻撃時、手札から入れ替わる */
  revolutionChange?: RaceCivCondition;
  /** 侵略: 条件を満たす自分のクリーチャーの攻撃時、手札から上に重なる */
  invasion?: RaceCivCondition;
  /** 進化元の条件(進化クリーチャーのみ) */
  evolutionFrom?: RaceCivCondition;
}

/** ツインパクトの呪文面 */
export interface SpellSide {
  name: string;
  nameRuby?: string;
  cost: number;
  effects: CardEffect[];
  flavor?: string;
}

/**
 * カードの設計図。
 * ユーザーが作成し、カードプールに保存される単位。
 */
export interface Card {
  id: string;
  name: string;
  /** ふりがな。カード名の上に小さく表示される。 */
  nameRuby?: string;
  cost: number;
  /** 2つ以上あれば多色カード。マナに置く時タップされ、支払い時は各文明が1枚ずつ必要。 */
  civilizations: Civilization[];
  power?: number;
  race?: string;
  type: CardType;
  /** 効果は複数保持できる。 */
  effects: CardEffect[];
  keywords: KeywordAbilities;
  /**
   * カード画像。設定は任意。
   * 指定する場合はブラウザ内で縮小したうえでBase64データURLとして保持する
   * (外部ストレージを使わないため、追加の設定なしで動く)。
   */
  image?: string;
  /** フレーバーテキスト。ゲーム進行には影響しない。 */
  flavor?: string;
  /** クロスギアが装備先に与えるパワー */
  powerBonus?: number;
  /** ツインパクトの呪文面。type === 'twinpact' の時のみ使う。 */
  spellSide?: SpellSide;
  /** サンプルカードかどうか(削除・編集の可否判定に使う) */
  builtin?: boolean;
}

/**
 * 場に存在するカード1枚の実体。
 * ゾーン間を移動しても instId は変わらないため、これで同一性を追跡する。
 */
export interface CardInstance {
  instId: string;
  cardId: string;
  tapped: boolean;
  /** 召喚酔い。出たターンは攻撃できない(スピードアタッカー等を除く)。 */
  sick: boolean;
  /** クリーチャーか、装備品(クロスギア)か */
  kind: 'creature' | 'gear';
  /** 進化・侵略で下に重なっているカードのid。上から順ではなく、下から順に格納。 */
  understack: string[];
  /** クロスギアの装備先クリーチャーのinstId */
  equippedTo: string | null;
  /** 効果によるパワーの増減の累積 */
  powerMod: number;
  /** このカードがバトルゾーンに出たターン数(マッハファイター判定に使う) */
  enteredTurn: number;
  /** ジャストダイバーが有効な間はtrue */
  justDiverActive: boolean;
  /** そのターン攻撃できない状態か(G・ストライク等で付与される) */
  cannotAttackThisTurn: boolean;
}
