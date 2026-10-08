import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig
} from 'remotion';

export type RecapEntry = {
  rank: number;
  label: string;
  image?: string;
  square?: boolean;
  video?: boolean;
  song?: boolean;
};

export type RecapDecision = { winner: RecapEntry; loser: RecapEntry; tie: boolean; ms: number };

export type RecapData = {
  title: string;
  total: number;
  picks?: number;
  durationMs?: number;
  ties: number;
  removed?: number;
  toughest?: RecapDecision;
  easiest?: RecapDecision;
  entries: RecapEntry[];
  qr?: { path: string; size: number };
};

export type Slide =
  | { kind: 'intro' }
  | { kind: 'stats' }
  | { kind: 'decisions' }
  | { kind: 'rank'; entry: number }
  | { kind: 'summary' };

export type TimedSlide = Slide & { from: number; length: number; song?: number };

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

const BLUE = '#2e5bff';
const PINK = '#f0306f';
const GOLD = '#ffb020';
const MINT = '#2fd8a0';
const INK = '#12152a';
const PAPER = '#f2f4f7';
const DISPLAY = "'Bricolage Grotesque', 'Arial Narrow', sans-serif";
const BODY = "'Instrument Sans', system-ui, sans-serif";

const seconds = (s: number) => Math.round(s * FPS);

const rankLength = (rank: number) =>
  rank === 1 ? seconds(14) : rank === 2 ? seconds(10) : rank === 3 ? seconds(9) : seconds(7);

export const recapTimeline = (data: RecapData): { slides: TimedSlide[]; duration: number } => {
  const countdown = data.entries.map((_, i) => i).reverse();
  const withSong = (i: number) => (data.entries[i]?.song ? i : undefined);
  const warmup = countdown.find((i) => data.entries[i].song);
  let carry = warmup;
  const songFor = (i: number) => (carry = withSong(i) ?? carry);
  const plan: (Slide & { length: number; song?: number })[] = [
    { kind: 'intro', length: seconds(4), song: warmup },
    ...(data.picks !== undefined
      ? [{ kind: 'stats' as const, length: seconds(6), song: warmup }]
      : []),
    ...(data.toughest ? [{ kind: 'decisions' as const, length: seconds(7), song: warmup }] : []),
    ...countdown.map((entry) => ({
      kind: 'rank' as const,
      entry,
      length: rankLength(data.entries[entry].rank),
      song: songFor(entry)
    })),
    { kind: 'summary', length: seconds(12), song: carry }
  ];
  let from = 0;
  const slides = plan.map((slide) => {
    const timed = { ...slide, from } as TimedSlide;
    from += slide.length;
    return timed;
  });
  return { slides, duration: from };
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const useIn = (delay = 0, damping = 12) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.6, stiffness: 170 } });
};

const Blobs = ({ colors, speed = 1 }: { colors: string[]; speed?: number }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {colors.map((color, i) => {
        const size = 700 + rand(i + 1) * 500;
        const x = rand(i + 7) * WIDTH + Math.sin(frame / (40 / speed) + i * 2) * 140 - size / 2;
        const y = rand(i + 13) * HEIGHT + Math.cos(frame / (52 / speed) + i) * 180 - size / 2;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: i % 2 ? '50%' : '38% 62% 55% 45%',
              background: color,
              transform: `rotate(${frame * (0.4 + i * 0.15)}deg)`
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Words = ({
  text,
  size,
  color = '#fff',
  delay = 0,
  weight = 800,
  align = 'left'
}: {
  text: string;
  size: number;
  color?: string;
  delay?: number;
  weight?: number;
  align?: 'left' | 'center';
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: `0 ${size * 0.26}px`,
        justifyContent: align === 'center' ? 'center' : 'flex-start'
      }}
    >
      {words.map((word, i) => {
        const pop = spring({
          frame: frame - delay - i * 3,
          fps,
          config: { damping: 11, mass: 0.5, stiffness: 200 }
        });
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              fontFamily: DISPLAY,
              fontWeight: weight,
              fontSize: size,
              lineHeight: 1,
              letterSpacing: '-0.035em',
              color,
              opacity: Math.min(1, pop * 1.4),
              transform: `translateY(${(1 - pop) * size * 0.6}px) rotate(${(1 - pop) * (i % 2 ? 6 : -6)}deg)`
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

const Art = ({
  entry,
  size,
  radius = 36
}: {
  entry: RecapEntry;
  size: number;
  radius?: number;
}) => (
  <div
    style={{
      width: size,
      height: entry.square || !entry.image ? size : size * 0.5625,
      borderRadius: radius,
      overflow: 'hidden',
      background: `linear-gradient(135deg, ${BLUE}, ${PINK})`,
      boxShadow: '0 40px 90px rgba(0,0,0,0.4)',
      display: 'grid',
      placeItems: 'center',
      flex: 'none'
    }}
  >
    {entry.image ? (
      <Img src={entry.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    ) : (
      <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size * 0.42, color: '#fff' }}>
        {entry.label.slice(0, 1)}
      </span>
    )}
  </div>
);

const formatDuration = (ms: number) => {
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  return minutes > 0 ? `${minutes}m ${total % 60}s` : `${total}s`;
};

const IntroSlide = ({ data }: { data: RecapData }) => {
  const chip = useIn(18);
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Blobs colors={[BLUE, PINK, GOLD]} />
      <AbsoluteFill style={{ padding: 96, justifyContent: 'center', gap: 48 }}>
        {data.title ? (
          <>
            <Words text="Your ranking," size={96} />
            <Words text={data.title} size={data.title.length > 22 ? 132 : 180} delay={8} />
          </>
        ) : (
          <Words text="Your ranking" size={180} />
        )}
        <div
          style={{
            alignSelf: 'flex-start',
            fontFamily: BODY,
            fontWeight: 700,
            fontSize: 44,
            color: INK,
            background: '#fff',
            padding: '14px 30px',
            borderRadius: 999,
            transform: `scale(${chip})`,
            transformOrigin: 'left center'
          }}
        >
          {data.total} things, sorted
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const StatsSlide = ({ data }: { data: RecapData }) => {
  const frame = useCurrentFrame();
  const count = Math.round(
    interpolate(frame, [6, 40], [0, data.picks ?? 0], { ...clamp, easing: (t) => 1 - (1 - t) ** 3 })
  );
  const line1 = useIn(46);
  const line2 = useIn(70);
  return (
    <AbsoluteFill style={{ background: MINT }}>
      <Blobs colors={['#20b884', '#7cf0c5']} speed={0.6} />
      <AbsoluteFill style={{ padding: 96, justifyContent: 'center', gap: 28 }}>
        <Words text="You made" size={84} color={INK} />
        <div
          style={{
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: 460,
            lineHeight: 0.85,
            letterSpacing: '-0.06em',
            color: INK,
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {count}
        </div>
        <Words text={`picks to rank ${data.total} things.`} size={84} color={INK} delay={10} />
        {data.durationMs !== undefined && data.durationMs > 1000 && (
          <div
            style={{
              fontFamily: BODY,
              fontWeight: 600,
              fontSize: 52,
              color: INK,
              opacity: line1,
              transform: `translateY(${(1 - line1) * 40}px)`
            }}
          >
            {formatDuration(data.durationMs)} of deciding.
          </div>
        )}
        {data.ties > 0 && (
          <div
            style={{
              fontFamily: BODY,
              fontWeight: 600,
              fontSize: 52,
              color: INK,
              opacity: line2,
              transform: `translateY(${(1 - line2) * 40}px)`
            }}
          >
            {data.ties === 1
              ? '1 tie. You just couldn’t choose.'
              : `${data.ties} ties. You just couldn’t choose.`}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const DecisionCard = ({
  title,
  decision,
  delay,
  color
}: {
  title: string;
  decision: RecapDecision;
  delay: number;
  color: string;
}) => {
  const enter = useIn(delay, 14);
  const secs = decision.ms / 1000;
  const time = secs < 10 ? secs.toFixed(1) : Math.round(secs).toString();
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 48,
        padding: 48,
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        transform: `translateX(${(1 - enter) * 900}px) rotate(${(1 - enter) * 6}deg)`,
        boxShadow: `18px 18px 0 ${INK}`
      }}
    >
      <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 40, color }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <Art entry={decision.winner} size={200} radius={28} />
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 56, color: INK }}>vs</div>
        <Art entry={decision.loser} size={200} radius={28} />
      </div>
      <div
        style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 64, lineHeight: 1.05, color: INK }}
      >
        {time}s.{' '}
        {decision.tie
          ? `${decision.winner.label} and ${decision.loser.label}: a tie.`
          : `${decision.winner.label} over ${decision.loser.label}.`}
      </div>
    </div>
  );
};

const DecisionsSlide = ({ data }: { data: RecapData }) => (
  <AbsoluteFill style={{ background: PINK }}>
    <Blobs colors={['#ff6a98', '#c81852']} speed={0.8} />
    <AbsoluteFill style={{ padding: 80, justifyContent: 'center', gap: 56 }}>
      {data.toughest && (
        <DecisionCard title="Toughest call" decision={data.toughest} delay={4} color={PINK} />
      )}
      {data.easiest && (
        <DecisionCard title="No contest" decision={data.easiest} delay={40} color={BLUE} />
      )}
    </AbsoluteFill>
  </AbsoluteFill>
);

const RankSlide = ({
  entry,
  index,
  length
}: {
  entry: RecapEntry;
  index: number;
  length: number;
}) => {
  const frame = useCurrentFrame();
  const isTop = entry.rank === 1;
  const color = isTop ? GOLD : [BLUE, PINK, MINT, '#8a5bff'][index % 4];
  const label = useIn(isTop ? 34 : 10);
  const art = useIn(isTop ? 22 : 4, 13);
  const number = useIn(0, 9);
  const zoom = interpolate(frame, [0, length], [1, 1.08]);
  const reveal = isTop ? interpolate(frame, [0, 20], [0, 1], clamp) : 1;
  const pulse = isTop ? 1 + Math.max(0, 1 - (frame % 20) / 6) * 0.025 : 1;
  return (
    <AbsoluteFill style={{ background: entry.video ? `${color}cc` : color }}>
      {!entry.video && <Blobs colors={[`${INK}22`, '#ffffff33']} speed={0.7} />}
      {isTop && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: 0.5 }}>
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: 18,
                height: 1400,
                background: i % 2 ? '#fff' : INK,
                opacity: 0.25,
                transform: `rotate(${(i / 20) * 360 + frame * 0.5}deg)`
              }}
            />
          ))}
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ padding: 96, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
          <div
            style={{
              fontFamily: DISPLAY,
              fontWeight: 800,
              fontSize: isTop ? 120 : 96,
              color: isTop ? INK : '#fff',
              opacity: reveal
            }}
          >
            {isTop ? 'Your #1' : `#${entry.rank}`}
          </div>
        </div>
        <div
          style={{
            alignSelf: 'center',
            transform: `scale(${(0.6 + art * 0.4) * zoom * pulse}) rotate(${(1 - art) * -10}deg)`,
            opacity: Math.min(1, art * 1.3)
          }}
        >
          <Art entry={entry} size={isTop ? 860 : 780} />
        </div>
        <div style={{ opacity: label, transform: `translateY(${(1 - label) * 60}px)` }}>
          <Words
            text={entry.label}
            size={entry.label.length > 26 ? 84 : 120}
            color={isTop ? INK : '#fff'}
            delay={isTop ? 34 : 10}
          />
        </div>
      </AbsoluteFill>
      {!isTop && (
        <div
          style={{
            position: 'absolute',
            right: 40,
            top: 40,
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: 420,
            lineHeight: 1,
            color: '#fff',
            opacity: 0.16,
            transform: `scale(${1.6 - number * 0.6})`
          }}
        >
          {entry.rank}
        </div>
      )}
    </AbsoluteFill>
  );
};

const SummarySlide = ({ data }: { data: RecapData }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Blobs colors={[`${BLUE}55`, `${PINK}55`]} speed={0.5} />
      <AbsoluteFill style={{ padding: '110px 90px', gap: 40 }}>
        <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 42, color: GOLD }}>
          My top {data.entries.length}
        </div>
        {data.title && <Words text={data.title} size={data.title.length > 22 ? 88 : 116} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 30, marginTop: 30 }}>
          {data.entries.map((entry, i) => {
            const row = spring({ frame: frame - 10 - i * 5, fps, config: { damping: 14 } });
            return (
              <div
                key={`${entry.rank}-${entry.label}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 30,
                  opacity: row,
                  transform: `translateX(${(1 - row) * 200}px)`
                }}
              >
                <div
                  style={{
                    width: 90,
                    fontFamily: DISPLAY,
                    fontWeight: 800,
                    fontSize: 84,
                    color: entry.rank === 1 ? GOLD : PAPER,
                    textAlign: 'right'
                  }}
                >
                  {entry.rank}
                </div>
                <div
                  style={{
                    width: 150,
                    height: 150,
                    borderRadius: 24,
                    overflow: 'hidden',
                    flex: 'none'
                  }}
                >
                  <Art entry={{ ...entry, square: true }} size={150} radius={24} />
                </div>
                <div
                  style={{
                    fontFamily: DISPLAY,
                    fontWeight: 800,
                    fontSize: 60,
                    lineHeight: 1.05,
                    color: '#fff',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}
                >
                  {entry.label}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 90,
          bottom: 90,
          display: 'flex',
          borderRadius: 12,
          overflow: 'hidden'
        }}
      >
        <span
          style={{
            background: BLUE,
            color: '#fff',
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: 40,
            padding: '6px 18px'
          }}
        >
          Sort
        </span>
        <span
          style={{
            background: PINK,
            color: '#fff',
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: 40,
            padding: '6px 18px'
          }}
        >
          Anything
        </span>
      </div>
      {data.qr && (
        <div
          style={{
            position: 'absolute',
            right: 90,
            bottom: 90,
            width: 380,
            padding: 20,
            borderRadius: 26,
            background: '#fff'
          }}
        >
          <svg
            viewBox={`0 0 ${data.qr.size} ${data.qr.size}`}
            shapeRendering="crispEdges"
            style={{ display: 'block', width: '100%' }}
          >
            <path d={data.qr.path} fill={INK} />
          </svg>
        </div>
      )}
    </AbsoluteFill>
  );
};

export const RecapComposition = ({ data }: { data: RecapData }) => {
  const { slides } = recapTimeline(data);
  return (
    <AbsoluteFill>
      {slides.map((slide, i) => (
        <Sequence key={i} from={slide.from} durationInFrames={slide.length}>
          {slide.kind === 'intro' && <IntroSlide data={data} />}
          {slide.kind === 'stats' && <StatsSlide data={data} />}
          {slide.kind === 'decisions' && <DecisionsSlide data={data} />}
          {slide.kind === 'rank' && (
            <RankSlide
              entry={data.entries[slide.entry]}
              index={data.entries.length - 1 - slide.entry}
              length={slide.length}
            />
          )}
          {slide.kind === 'summary' && <SummarySlide data={data} />}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
