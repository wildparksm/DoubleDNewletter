import type { CSSProperties } from "react";

// 히어로 카드 좌측 "쥐파먹은" 모양 프로토타입 비교용 임시 페이지.
// 결정 후 이 폴더(app/hero-proto)는 삭제합니다.

// A. 오목한 모서리 — 좌측 상·하 모서리를 안쪽으로 깎음(inverted corners).
//    두 원을 intersect로 합성해 두 모서리만 제거.
const invertedStyle: CSSProperties = {
  WebkitMaskImage:
    "radial-gradient(38px at 0 0, transparent 0 37px, #000 38px), radial-gradient(38px at 0 100%, transparent 0 37px, #000 38px)",
  maskImage:
    "radial-gradient(38px at 0 0, transparent 0 37px, #000 38px), radial-gradient(38px at 0 100%, transparent 0 37px, #000 38px)",
  WebkitMaskComposite: "source-in",
  maskComposite: "intersect",
};

// B. 반원 노치 — 좌측 가운데를 반원으로 파냄(쿠폰/티켓 느낌).
const notchStyle: CSSProperties = {
  WebkitMaskImage: "radial-gradient(46px at 0 50%, transparent 0 45px, #000 46px)",
  maskImage: "radial-gradient(46px at 0 50%, transparent 0 45px, #000 46px)",
};

// D. 좌상단 홈 — 좌측 위 모서리만 배지 크기만큼 오목하게(요즘IT 방식).
//    배지가 이 홈에 앉음. 단일 radial-gradient로 좌상단 1/4원만 제거.
const topLeftNotchStyle: CSSProperties = {
  WebkitMaskImage: "radial-gradient(62px at 0 0, transparent 0 61px, #000 62px)",
  maskImage: "radial-gradient(62px at 0 0, transparent 0 61px, #000 62px)",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
};

const CARD =
  "relative h-[300px] w-full max-w-[640px] overflow-hidden rounded-2xl flex items-end p-8 " +
  "bg-gradient-to-br from-indigo-600 via-blue-700 to-slate-900 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.4)]";

function SampleContent() {
  return (
    <div className="relative z-10">
      <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-white px-3 py-1 rounded-full bg-[#0d1b8e] mb-4">
        오늘의 토픽
      </span>
      <h2 className="text-[26px] font-bold text-white leading-tight">
        바이브 코딩으로 7일간 900커밋,<br />디자이너의 앱 출시기
      </h2>
      <p className="text-white/70 text-sm mt-2">프로덕트</p>
    </div>
  );
}

function Block({ title, desc, style }: { title: string; desc: string; style?: CSSProperties }) {
  return (
    <div className="w-full max-w-[640px]">
      <p className="font-bold text-gray-900 mb-1">{title}</p>
      <p className="text-sm text-gray-500 mb-3">{desc}</p>
      <div className={CARD} style={style}>
        <SampleContent />
      </div>
    </div>
  );
}

// C. 분할형 — 좌측은 커버 이미지, 우측 네이비 패널이 곡선 경계로 겹침.
//    패널 좌측 모서리를 크게 둥글려서 이미지 위로 "겹쳐 파고드는" 느낌을 줌.
function SplitBlock({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="w-full max-w-[640px]">
      <p className="font-bold text-gray-900 mb-1">{title}</p>
      <p className="text-sm text-gray-500 mb-3">{desc}</p>
      <div className="relative h-[300px] w-full max-w-[640px] overflow-hidden rounded-2xl">
        {/* 좌측 커버 이미지 (프로토타입은 그라데이션으로 대체) */}
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-800 via-slate-700 to-slate-500" />
        <span className="absolute top-5 left-5 z-20 inline-flex items-center gap-1.5 text-[12px] font-bold text-white px-3 py-1 rounded-full bg-[#0d1b8e]">
          오늘의 토픽
        </span>
        {/* 우측 네이비 패널 — 좌측 모서리를 크게 둥글려 곡선 경계 */}
        <div
          className="absolute top-0 right-0 h-full w-[64%] flex items-center p-8 bg-gradient-to-br from-indigo-600 via-blue-700 to-slate-900"
          style={{ borderTopLeftRadius: 96, borderBottomLeftRadius: 96 }}
        >
          <div>
            <h2 className="text-[24px] font-bold text-white leading-tight">
              바이브 코딩으로 7일간 900커밋,<br />디자이너의 앱 출시기
            </h2>
            <p className="text-white/70 text-sm mt-2">프로덕트</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// 풀이미지 + 하단 제목 + 좌상단 홈에 배지가 앉은 실제 쓰임새 프로토타입.
function FullNotchBlock() {
  return (
    <div className="w-full max-w-[640px]">
      <p className="font-bold text-gray-900 mb-1">D. 좌상단 홈 (요즘IT 방식) — 추천</p>
      <p className="text-sm text-gray-500 mb-3">
        좌측 위 모서리만 배지 크기만큼 오목. &quot;오늘의 토픽&quot; 배지가 그 홈에 앉음.
      </p>
      <div className="relative w-full max-w-[640px]">
        {/* 카드 본체 (풀이미지 + 좌상단 홈 마스크) */}
        <div
          className="relative h-[300px] w-full overflow-hidden rounded-2xl flex items-end p-8 bg-gradient-to-br from-indigo-600 via-blue-700 to-slate-900 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.4)]"
          style={topLeftNotchStyle}
        >
          {/* 하단 가독성용 스크림 */}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="relative z-10">
            <h2 className="text-[26px] font-bold text-white leading-tight">
              바이브 코딩으로 7일간 900커밋,<br />디자이너의 앱 출시기
            </h2>
            <p className="text-white/70 text-sm mt-2">프로덕트</p>
          </div>
        </div>
        {/* 배지 — 홈 안에 앉음(카드 위에 오버레이) */}
        <span className="absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 text-[12px] font-bold text-white px-3 py-1 rounded-full bg-[#0d1b8e]">
          오늘의 토픽
        </span>
      </div>
    </div>
  );
}

export default function HeroProtoPage() {
  return (
    <main className="min-h-screen bg-[#fafafa] py-12 px-6 flex flex-col items-center gap-12">
      <h1 className="text-xl font-bold text-gray-900">히어로 카드 좌측 모양 비교</h1>
      <p className="text-sm text-gray-500 -mt-8">
        잘린 부분은 페이지 배경(회색)이 비칩니다. 옆에 다른 요소가 붙으면 그 요소가 비쳐요.
      </p>

      <Block
        title="현재 — 직사각형"
        desc="둥근 직사각형 (rounded-2xl)"
      />

      <Block
        title="A. 오목한 모서리 (inverted corners)"
        desc="좌측 상·하 모서리가 안쪽으로 깎인 모던한 느낌"
        style={invertedStyle}
      />

      <Block
        title="B. 반원 노치 (semicircle notch)"
        desc="좌측 가운데를 반원으로 파낸 쿠폰/티켓 느낌"
        style={notchStyle}
      />

      <SplitBlock
        title="C. 분할형 (이미지 좌 + 패널 우)"
        desc="좌측은 커버 이미지, 우측 네이비 패널이 곡선으로 겹침 — 첨부 이미지 느낌"
      />

      <FullNotchBlock />
    </main>
  );
}
