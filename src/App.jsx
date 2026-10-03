import { useState, useMemo } from "react";

// ── 定数 ──────────────────────────────────────────────
const LUNCH_DURATION = 75;
const MOKEI_START_MIN = 15 * 60 + 30; // 15:30固定

function calcCoolDuration(b) {
  if (b <= 25) return 60;
  return 120;
}

// 能力値で補正した時間（基準時間 ÷ 能力値、30分単位で丸める）
function adjustedTime(baseMin, ability) {
  if (!ability || ability <= 0) return baseMin;
  return Math.round((baseMin / ability) / 30) * 30;
}

function minutesToTime(m) {
  if (m == null || isNaN(m)) return "--:--";
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const STEPS = [
  { key: "maisotsu",  label: "埋没",    color: "#4A90D9", emoji: "💉" },
  { key: "datsurou",  label: "脱ろう",  color: "#E8835A", emoji: "🔥" },
  { key: "shot",      label: "ショット", color: "#7DBF6E", emoji: "⚡" },
  { key: "waridashi", label: "割り出し", color: "#C97CC4", emoji: "🔨" },
  { key: "souji",     label: "掃除",    color: "#8BACC8", emoji: "🧹" },
];

const ATTENDANCE_OPTIONS = [
  { value: 1,   label: "出勤", color: "#7DBF6E" },
  { value: 0.5, label: "早退", color: "#E8835A" },
  { value: 0,   label: "休み", color: "#667788" },
];

const DEFAULT_MEMBERS = [
  { name: "メンバー1", attendance: 1, ability: 1.0 },
  { name: "メンバー2", attendance: 1, ability: 1.0 },
  { name: "メンバー3", attendance: 1, ability: 1.0 },
  { name: "メンバー4", attendance: 1, ability: 1.0 },
  { name: "メンバー5", attendance: 1, ability: 1.0 },
  { name: "メンバー6", attendance: 1, ability: 1.0 },
];

const DEFAULT_BEDS = [40, 40, 40, 40];

export default function App() {
  // メンバー管理
  const [members, setMembers] = useState(DEFAULT_MEMBERS);

  // クール設定
  const [coolBeds, setCoolBeds]         = useState(DEFAULT_BEDS);
  const [prevLastBeds, setPrevLastBeds] = useState(40);
  const [lunchSlot, setLunchSlot]       = useState(2);

  // 担当者
  const [assigns, setAssigns] = useState({
    maisotsu: "", datsurou: "", shot: "", waridashi: "",
  });

  // 模型出し
  const [mokeiMin, setMokeiMin]   = useState(180); // 3時間=180分
  const [mokeiStaff, setMokeiStaff] = useState("");

  // 掃除
  const [soujiMin, setSoujiMin]       = useState(40);
  const [tankMin, setTankMin]         = useState(0);
  const [airconMin, setAirconMin]     = useState(0);
  const [dustMin, setDustMin]         = useState(0);

  const schedCools = coolBeds.length;
  const lc = schedCools - 1;

  // メンバー更新
  const updateMember = (i, key, val) =>
    setMembers(m => m.map((x, idx) => idx === i ? { ...x, [key]: val } : x));

  // アクティブメンバー（出勤・早退）
  const activeMembers = members.filter(m => m.attendance > 0 && m.name.trim());
  const memberNames = activeMembers.map(m => m.name);

  // 担当者の能力値を取得
  const getAbility = (name) => {
    const m = members.find(m => m.name === name);
    return m ? m.ability * m.attendance : 1.0;
  };

  const updateBeds     = (i, val) => setCoolBeds(b => b.map((x, idx) => idx === i ? Math.max(0, Math.min(60, Number(val))) : x));
  const updatePrevLast = (val)    => setPrevLastBeds(Math.max(0, Math.min(60, Number(val))));

  // 全クールを時系列で構築
  const allCoolTimes = useMemo(() => {
    const result = [];
    let cursor = 8 * 60;

    // 前日最終クール
    const prevDur = calcCoolDuration(prevLastBeds);
    result.push({
      key: "prev", label: "前日 最終", index: -1,
      startMin: cursor, endMin: cursor + prevDur,
      beds: prevLastBeds, duration: prevDur, isPrev: true,
    });
    cursor += prevDur;
    if (lunchSlot === 0) cursor += LUNCH_DURATION;

    // 当日クール
    for (let i = 0; i < schedCools; i++) {
      const isLastCool = i === schedCools - 1;
      const dur = (isLastCool && coolBeds[i] <= 25) ? 0 : calcCoolDuration(coolBeds[i]);
      result.push({
        key: `today-${i}`, label: `第${i + 1}クール`, index: i,
        startMin: cursor, endMin: cursor + dur,
        beds: coolBeds[i], duration: dur, isPrev: false, isLast: isLastCool,
        noWork: isLastCool && coolBeds[i] <= 25,
      });
      cursor += dur;
      if (lunchSlot === i + 1) cursor += LUNCH_DURATION;
    }

    // 模型出し（15:30固定）
    const mokeiActive = coolBeds[coolBeds.length - 1] > 22;
    if (mokeiActive) {
      result.push({
        key: "mokei", label: "模型出し", index: -2,
        startMin: MOKEI_START_MIN, endMin: MOKEI_START_MIN + mokeiMin,
        duration: mokeiMin, isMokei: true,
      });
    }

    return result;
  }, [prevLastBeds, mokeiMin, coolBeds, lunchSlot, schedCools]);

  const prevCool    = allCoolTimes[0];
  const mokeiActive = coolBeds[lc] > 22;
  const mokeiBlock  = mokeiActive ? allCoolTimes.find(c => c.isMokei) : null;
  const todayCools  = allCoolTimes.filter(c => !c.isPrev && !c.isMokei);
  const lastCool    = todayCools[lc];

  const lunchStartMin = useMemo(() => {
    if (lunchSlot === 0) return prevCool?.endMin;
    return todayCools[lunchSlot - 1]?.endMin;
  }, [lunchSlot, prevCool, todayCools]);

  const prevLastDur = calcCoolDuration(prevLastBeds);
  const totalSoujiMin = soujiMin + tankMin + airconMin + dustMin;
  const finishMin = (lastCool?.endMin ?? 0) + totalSoujiMin;

  // 工程別タイムテーブル（担当者能力値を反映）
  const stepRanges = useMemo(() => {
    const t = todayCools;
    const maisotsuAbility  = getAbility(assigns.maisotsu);
    const datsurouAbility  = getAbility(assigns.datsurou);
    const shotAbility      = getAbility(assigns.shot);
    const waridashiAbility = getAbility(assigns.waridashi);

    // 基準時間
    const maisotsuBase  = (t[lc - 1]?.endMin ?? 0) + 60 - 8 * 60; // 8:00からの経過分
    const datsurouBase  = (t[lc - 2]?.endMin ?? 0) - 8 * 60;
    const shotBase      = 5 * 120; // 5クール×2時間
    const waridashiBase = 4 * 120 + 30; // 4クール×2時間+30分

    return {
      maisotsu:  {
        toLabel: `当日 第${lc}クール終了＋トリミング2回`,
        toMin: 8 * 60 + adjustedTime(maisotsuBase, maisotsuAbility),
        ability: maisotsuAbility,
      },
      datsurou:  {
        toLabel: "当日 最終-2クール終了",
        toMin: 8 * 60 + adjustedTime(datsurouBase, datsurouAbility),
        ability: datsurouAbility,
      },
      shot:      {
        toLabel: "当日 第2クール終了（5クール×2h）",
        toMin: 8 * 60 + adjustedTime(shotBase, shotAbility),
        ability: shotAbility,
      },
      waridashi: {
        toLabel: "当日 第1クール終了＋プラスコ処理",
        toMin: 8 * 60 + adjustedTime(waridashiBase, waridashiAbility),
        ability: waridashiAbility,
      },
      souji: { startMin: lastCool?.endMin, duration: totalSoujiMin },
    };
  }, [todayCools, lc, lastCool, assigns, members, totalSoujiMin]);

  const selStyle = {
    background: "#1a2d42", border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 6, color: "#fff", fontSize: 12, padding: "4px 6px",
    cursor: "pointer", flex: 1,
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0d1b2a 0%, #1a2d42 50%, #0d1b2a 100%)",
      fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif",
      color: "#e8f4f8", padding: "20px 12px",
    }}>
      {/* ヘッダー */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          background: "rgba(74,144,217,0.15)", border: "1px solid rgba(74,144,217,0.4)",
          borderRadius: 12, padding: "8px 20px", marginBottom: 10,
        }}>
          <span style={{ fontSize: 20 }}>🦷</span>
          <span style={{ fontSize: 12, letterSpacing: 3, color: "#4A90D9", fontWeight: 700 }}>DENTAL LAB</span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>重合スケジューラー</h1>
        <p style={{ color: "#8bacc8", fontSize: 11, marginTop: 4 }}>Polymerization Schedule Manager</p>
      </div>

      {/* ── メンバー管理 ── */}
      <div style={{
        maxWidth: 680, margin: "0 auto 16px",
        background: "rgba(255,255,255,0.05)", borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.1)", padding: "16px 16px",
      }}>
        <div style={{ fontSize: 11, color: "#8bacc8", letterSpacing: 1, marginBottom: 12 }}>👥 作業メンバー</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {members.map((m, i) => {
            const att = ATTENDANCE_OPTIONS.find(a => a.value === m.attendance) || ATTENDANCE_OPTIONS[0];
            return (
              <div key={i} style={{
                background: m.attendance === 0 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${m.attendance === 0 ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.12)"}`,
                borderRadius: 10, padding: "10px 12px",
                opacity: m.attendance === 0 ? 0.5 : 1,
              }}>
                {/* 出勤状態 */}
                <select
                  value={m.attendance}
                  onChange={e => updateMember(i, "attendance", Number(e.target.value))}
                  style={{
                    ...selStyle, width: "100%", marginBottom: 6,
                    background: m.attendance === 1 ? "rgba(125,191,110,0.2)" :
                                m.attendance === 0.5 ? "rgba(232,131,90,0.2)" : "rgba(100,100,120,0.2)",
                    border: `1px solid ${att.color}55`,
                    color: att.color, fontWeight: 700,
                  }}
                >
                  {ATTENDANCE_OPTIONS.map(a => (
                    <option key={a.value} value={a.value}>{a.label}（{a.value}）</option>
                  ))}
                </select>
                {/* 名前 */}
                <input
                  type="text" value={m.name}
                  onChange={e => updateMember(i, "name", e.target.value)}
                  placeholder={`メンバー${i + 1}`}
                  style={{
                    width: "100%", fontSize: 14, fontWeight: 700, padding: "5px 8px",
                    background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 6, color: "#fff", marginBottom: 8, boxSizing: "border-box",
                  }}
                />
                {/* 能力値 */}
                <div style={{ fontSize: 10, color: "#8bacc8", marginBottom: 4 }}>
                  能力値：<span style={{ color: "#e8d080", fontWeight: 700 }}>{m.ability.toFixed(1)}</span>
                </div>
                <input
                  type="range" min={0.3} max={1.5} step={0.1} value={m.ability}
                  onChange={e => updateMember(i, "ability", Number(e.target.value))}
                  style={{ width: "100%", accentColor: att.color, cursor: "pointer" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#445566" }}>
                  <span>0.3</span><span>1.0</span><span>1.5</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 担当者アサイン ── */}
      <div style={{
        maxWidth: 680, margin: "0 auto 16px",
        background: "rgba(255,255,255,0.05)", borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.1)", padding: "16px 16px",
      }}>
        <div style={{ fontSize: 11, color: "#8bacc8", letterSpacing: 1, marginBottom: 12 }}>🎯 工程担当者</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {STEPS.filter(s => s.key !== "souji").map(step => {
            const ability = getAbility(assigns[step.key]);
            return (
              <div key={step.key} style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${step.color}33`,
                borderRadius: 8, padding: "10px 12px",
              }}>
                <div style={{ fontSize: 11, color: step.color, fontWeight: 700, marginBottom: 6 }}>
                  {step.emoji} {step.label}
                </div>
                <select
                  value={assigns[step.key]}
                  onChange={e => setAssigns(a => ({ ...a, [step.key]: e.target.value }))}
                  style={{ ...selStyle, width: "100%", marginBottom: 4 }}
                >
                  <option value="">-- 担当者を選択 --</option>
                  {activeMembers.map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
                {assigns[step.key] && (
                  <div style={{ fontSize: 10, color: "#a0b8c8" }}>
                    能力値：<span style={{ color: "#e8d080", fontWeight: 700 }}>{ability.toFixed(2)}</span>
                    　補正：<span style={{ color: ability >= 1 ? "#7DBF6E" : "#E8835A", fontWeight: 700 }}>
                      {ability >= 1 ? "▲短縮" : "▼延長"}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 前日最終クール設定 ── */}
      <div style={{
        maxWidth: 680, margin: "0 auto 12px",
        background: "rgba(255,220,150,0.06)", borderRadius: 14,
        border: "1px solid rgba(255,200,80,0.25)", padding: "14px 16px",
      }}>
        <div style={{ fontSize: 11, color: "#c8a84b", letterSpacing: 1, marginBottom: 10 }}>
          🌙 前日 最終クール 床数（8:00スタート）
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => updatePrevLast(prevLastBeds - 1)} style={btnStyle}>－</button>
            <input type="number" value={prevLastBeds} onChange={e => updatePrevLast(e.target.value)}
              style={{
                width: 60, textAlign: "center", fontSize: 20, fontWeight: 700,
                background: "rgba(255,200,80,0.12)", border: "1px solid rgba(255,200,80,0.35)",
                borderRadius: 8, color: "#fff", padding: "3px 0",
              }}
            />
            <button onClick={() => updatePrevLast(prevLastBeds + 1)} style={btnStyle}>＋</button>
            <span style={{ fontSize: 13, color: "#8bacc8" }}>床</span>
          </div>
          <input type="range" min={0} max={60} value={prevLastBeds}
            onChange={e => updatePrevLast(e.target.value)}
            style={{ flex: 1, minWidth: 100, accentColor: "#c8a84b" }}
          />
          <div style={{
            fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 5, whiteSpace: "nowrap",
            background: prevLastDur === 120 ? "rgba(232,131,90,0.2)" : "rgba(125,191,110,0.2)",
            color: prevLastDur === 120 ? "#E8835A" : "#7DBF6E",
          }}>{prevLastDur === 60 ? "1時間" : "2時間"}</div>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#a08840" }}>
          08:00 〜 <span style={{ color: "#e8d080", fontWeight: 700 }}>{minutesToTime(prevCool?.endMin)}</span>
        </div>
      </div>

      {/* ── 模型出し設定 ── */}
      <div style={{
        maxWidth: 680, margin: "0 auto 12px",
        background: "rgba(100,200,150,0.05)", borderRadius: 14,
        border: "1px solid rgba(100,200,150,0.25)", padding: "14px 16px",
      }}>
        <div style={{ fontSize: 11, color: "#6ec89a", letterSpacing: 1, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
          🏗️ 模型出し設定
          {!mokeiActive && (
            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "rgba(200,80,80,0.2)", color: "#e07070" }}>
              当日最終クール 22床以下 → 作業なし
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          {/* 時間 */}
          <div>
            <div style={{ fontSize: 10, color: "#8bacc8", marginBottom: 4 }}>作業時間</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[180, 210, 240].map(min => (
                <button key={min} onClick={() => setMokeiMin(min)} style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                  background: mokeiMin === min ? "rgba(100,200,150,0.3)" : "rgba(255,255,255,0.05)",
                  border: mokeiMin === min ? "1px solid rgba(100,200,150,0.6)" : "1px solid rgba(255,255,255,0.1)",
                  color: mokeiMin === min ? "#9de8c0" : "#667788",
                  fontWeight: mokeiMin === min ? 700 : 400,
                }}>
                  {min / 60 === Math.floor(min / 60) ? `${min / 60}時間` : `${Math.floor(min / 60)}時間${min % 60}分`}
                </button>
              ))}
            </div>
          </div>
          {/* 担当者 */}
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 10, color: "#8bacc8", marginBottom: 4 }}>担当者</div>
            <select value={mokeiStaff} onChange={e => setMokeiStaff(e.target.value)}
              style={{ ...selStyle, width: "100%" }}>
              <option value="">-- 担当者を選択 --</option>
              {activeMembers.map(m => (
                <option key={m.name} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>
        {mokeiBlock && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#a08840" }}>
            {minutesToTime(mokeiBlock.startMin)} 〜 <span style={{ color: "#9de8c0", fontWeight: 700 }}>{minutesToTime(mokeiBlock.endMin)}</span>
            {mokeiStaff && <span style={{ marginLeft: 8, color: "#9de8c0" }}>👤 {mokeiStaff}</span>}
          </div>
        )}
      </div>

      {/* ── 掃除設定 ── */}
      <div style={{
        maxWidth: 680, margin: "0 auto 12px",
        background: "rgba(139,172,200,0.06)", borderRadius: 14,
        border: "1px solid rgba(139,172,200,0.25)", padding: "14px 16px",
      }}>
        <div style={{ fontSize: 11, color: "#8bacc8", letterSpacing: 1, marginBottom: 12 }}>🧹 掃除時間設定</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "通常掃除", val: soujiMin, setVal: setSoujiMin, min: 40, max: 60, step: 5, color: "#8BACC8" },
            { label: "🪣 タンク掃除", val: tankMin, setVal: setTankMin, min: 0, max: 60, step: 15, color: "#7DBF6E" },
            { label: "❄️ エアコン掃除", val: airconMin, setVal: setAirconMin, min: 0, max: 60, step: 15, color: "#4A90D9" },
            { label: "🌀 集塵機掃除", val: dustMin, setVal: setDustMin, min: 0, max: 60, step: 15, color: "#C97CC4" },
          ].map(item => (
            <div key={item.label} style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 10px",
            }}>
              <div style={{ fontSize: 12, color: item.color, minWidth: 100 }}>{item.label}</div>
              <button onClick={() => item.setVal(v => Math.max(item.min, v - item.step))} style={btnStyle}>－</button>
              <div style={{
                fontSize: 16, fontWeight: 700, minWidth: 44, textAlign: "center",
                color: item.val === 0 ? "#445566" : "#e8f4f8",
              }}>
                {item.val === 0 ? "なし" : `${item.val}分`}
              </div>
              <button onClick={() => item.setVal(v => Math.min(item.max, v + item.step))} style={btnStyle}>＋</button>
              <input type="range" min={item.min} max={item.max} step={item.step} value={item.val}
                onChange={e => item.setVal(Number(e.target.value))}
                style={{ flex: 1, accentColor: item.color, cursor: "pointer" }}
              />
            </div>
          ))}
          <div style={{ fontSize: 12, color: "#8bacc8", textAlign: "right", paddingRight: 4 }}>
            合計掃除時間：<span style={{ color: "#e8f4f8", fontWeight: 700 }}>{totalSoujiMin}分</span>
            　終了予定：<span style={{ color: "#e8d080", fontWeight: 700 }}>{minutesToTime(finishMin)}</span>
          </div>
        </div>
      </div>

      {/* ── 当日クール設定 ── */}
      <div style={{
        maxWidth: 680, margin: "0 auto 16px",
        background: "rgba(255,255,255,0.05)", borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.1)", padding: "16px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: "#8bacc8", letterSpacing: 1 }}>当日 クール別 床数設定</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => { if (coolBeds.length <= 4) return; setCoolBeds(b => b.slice(0, -1)); }}
              disabled={coolBeds.length <= 4}
              style={{ ...smallBtnStyle, opacity: coolBeds.length <= 4 ? 0.3 : 1 }}>削除</button>
            <button onClick={() => { if (coolBeds.length < 5) setCoolBeds(b => [...b, 40]); }}
              disabled={coolBeds.length >= 5}
              style={{ ...smallBtnStyle, background: "rgba(74,144,217,0.25)", border: "1px solid rgba(74,144,217,0.5)", opacity: coolBeds.length >= 5 ? 0.3 : 1 }}>
              ＋5クール
            </button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {coolBeds.map((b, i) => {
            const dur = i === lc && b <= 25 ? 0 : calcCoolDuration(b);
            const isLast = i === lc;
            return (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "32px 1fr auto",
                alignItems: "center", gap: 8,
                background: isLast ? "rgba(74,144,217,0.12)" : "rgba(255,255,255,0.04)",
                border: isLast ? "1px solid rgba(74,144,217,0.4)" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10, padding: "8px 12px",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: isLast ? "#4A90D9" : "rgba(255,255,255,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700,
                }}>{i + 1}</div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <button onClick={() => updateBeds(i, b - 1)} style={btnStyle}>－</button>
                    <input type="number" value={b} onChange={e => updateBeds(i, e.target.value)}
                      style={{
                        width: 54, textAlign: "center", fontSize: 18, fontWeight: 700,
                        background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 6, color: "#fff", padding: "2px 0",
                      }}
                    />
                    <button onClick={() => updateBeds(i, b + 1)} style={btnStyle}>＋</button>
                    <span style={{ fontSize: 12, color: "#8bacc8" }}>床</span>
                  </div>
                  <input type="range" min={0} max={60} value={b}
                    onChange={e => updateBeds(i, e.target.value)}
                    style={{ width: "100%", accentColor: isLast ? "#4A90D9" : "#7DBF6E" }}
                  />
                </div>
                <div style={{ textAlign: "right" }}>
                  {b <= 25 && isLast ? (
                    <div style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(200,80,80,0.2)", color: "#e07070" }}>作業なし</div>
                  ) : (
                    <div style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                      background: dur === 120 ? "rgba(232,131,90,0.2)" : "rgba(125,191,110,0.2)",
                      color: dur === 120 ? "#E8835A" : "#7DBF6E",
                    }}>{dur === 0 ? "なし" : dur === 60 ? "1h" : "2h"}</div>
                  )}
                  {isLast && <div style={{ fontSize: 9, color: "#4A90D9", marginTop: 2 }}>最終</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* 昼休み */}
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10,
          background: "rgba(232,131,90,0.07)", border: "1px dashed rgba(232,131,90,0.3)",
          borderRadius: 10, padding: "10px 12px" }}>
          <span style={{ fontSize: 16 }}>🍱</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "#8bacc8", marginBottom: 3 }}>昼休み</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => setLunchSlot(l => Math.max(0, l - 1))} style={btnStyle}>－</button>
              <span style={{ fontSize: 12, fontWeight: 700, minWidth: 100, textAlign: "center" }}>
                {lunchSlot === 0 ? "前日最終後" : `当日第${lunchSlot}クール後`}
              </span>
              <button onClick={() => setLunchSlot(l => Math.min(schedCools, l + 1))} style={btnStyle}>＋</button>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700 }}>
            {minutesToTime(lunchStartMin)}<br/>
            <span style={{ fontSize: 10, color: "#E8835A" }}>〜{minutesToTime((lunchStartMin ?? 0) + LUNCH_DURATION)}</span>
          </div>
        </div>

        {/* サマリー */}
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { label: "当日総床数", value: `${coolBeds.reduce((a,b)=>a+b,0)}床` },
            { label: "クール数", value: `${schedCools}クール` },
            { label: "終了予定", value: minutesToTime(finishMin) },
          ].map(item => (
            <div key={item.label} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "7px 12px", flex: "1 1 90px" }}>
              <div style={{ fontSize: 9, color: "#8bacc8", marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 当日スケジュール ── */}
      <div style={{ maxWidth: 680, margin: "0 auto 20px" }}>
        <h2 style={{ fontSize: 11, color: "#8bacc8", letterSpacing: 2, marginBottom: 10, textAlign: "center" }}>── 当日スケジュール ──</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {/* 前日最終 */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(255,200,80,0.08)", border: "1px solid rgba(255,200,80,0.3)",
            borderRadius: 10, padding: "9px 14px",
          }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,200,80,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>🌙</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#c8a84b", marginBottom: 1 }}>前日 最終クール</div>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#e8d080" }}>{minutesToTime(prevCool?.startMin)}</span>
              <span style={{ color: "#8bacc8", margin: "0 5px" }}>〜</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#e8d080" }}>{minutesToTime(prevCool?.endMin)}</span>
            </div>
            <div style={{ fontSize: 12, color: "#a08840" }}>{prevLastBeds}床</div>
            <div style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: prevLastDur === 120 ? "rgba(232,131,90,0.15)" : "rgba(125,191,110,0.15)", color: prevLastDur === 120 ? "#E8835A" : "#7DBF6E" }}>{prevLastDur}分</div>
          </div>

          {/* 当日クール */}
          {todayCools.map((cool, i) => (
            <div key={cool.key}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                background: cool.isLast ? "rgba(74,144,217,0.18)" : "rgba(255,255,255,0.04)",
                border: cool.isLast ? "1px solid rgba(74,144,217,0.5)" : "1px solid rgba(255,255,255,0.07)",
                borderRadius: 10, padding: "9px 14px",
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%",
                  background: cool.isLast ? "#4A90D9" : "rgba(255,255,255,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700,
                }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{minutesToTime(cool.startMin)}</span>
                  <span style={{ color: "#8bacc8", margin: "0 5px" }}>〜</span>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{minutesToTime(cool.endMin)}</span>
                </div>
                <div style={{ fontSize: 12, color: "#8bacc8" }}>{cool.beds}床</div>
                {cool.noWork ? (
                  <div style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(200,80,80,0.15)", color: "#e07070" }}>作業なし</div>
                ) : (
                  <div style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: cool.duration === 120 ? "rgba(232,131,90,0.15)" : "rgba(125,191,110,0.15)", color: cool.duration === 120 ? "#E8835A" : "#7DBF6E" }}>{cool.duration}分</div>
                )}
                {cool.isLast && <div style={{ fontSize: 9, color: "#4A90D9", fontWeight: 700 }}>最終</div>}
              </div>
              {i + 1 === lunchSlot && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(232,131,90,0.07)", border: "1px dashed rgba(232,131,90,0.3)", borderRadius: 10, padding: "7px 14px", marginTop: 5 }}>
                  <span style={{ fontSize: 16 }}>🍱</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{minutesToTime(lunchStartMin)}</span>
                    <span style={{ color: "#8bacc8", margin: "0 5px" }}>〜</span>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{minutesToTime((lunchStartMin ?? 0) + LUNCH_DURATION)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#E8835A" }}>昼休み 75分</div>
                </div>
              )}
            </div>
          ))}

          {/* 模型出し */}
          {mokeiActive && mokeiBlock && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(100,200,150,0.07)", border: "1px solid rgba(100,200,150,0.25)", borderRadius: 10, padding: "9px 14px" }}>
              <span style={{ fontSize: 16 }}>🏗️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#6ec89a", marginBottom: 1 }}>模型出し{mokeiStaff && ` 👤${mokeiStaff}`}</div>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{minutesToTime(mokeiBlock.startMin)}</span>
                <span style={{ color: "#8bacc8", margin: "0 5px" }}>〜</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{minutesToTime(mokeiBlock.endMin)}</span>
              </div>
              <div style={{ fontSize: 12, color: "#6ec89a" }}>{mokeiMin}分</div>
            </div>
          )}

          {/* 掃除 */}
          <div style={{ background: "rgba(139,172,200,0.07)", border: "1px solid rgba(139,172,200,0.2)", borderRadius: 10, padding: "9px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>🧹</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{minutesToTime(lastCool?.endMin ?? 0)}</span>
                <span style={{ color: "#8bacc8", margin: "0 5px" }}>〜</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{minutesToTime(finishMin)}</span>
              </div>
              <div style={{ fontSize: 12, color: "#8bacc8" }}>計{totalSoujiMin}分</div>
            </div>
            {/* 内訳 */}
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              {[
                { label: "通常", val: soujiMin, color: "#8BACC8" },
                { label: "タンク", val: tankMin, color: "#7DBF6E" },
                { label: "エアコン", val: airconMin, color: "#4A90D9" },
                { label: "集塵機", val: dustMin, color: "#C97CC4" },
              ].filter(x => x.val > 0).map(x => (
                <span key={x.label} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: x.color }}>
                  {x.label} {x.val}分
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 工程別タイムテーブル ── */}
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <h2 style={{ fontSize: 11, color: "#8bacc8", letterSpacing: 2, marginBottom: 10, textAlign: "center" }}>── 工程別タイムテーブル ──</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {STEPS.filter(s => s.key !== "souji").map(step => {
            const r = stepRanges[step.key];
            if (!r || r.toMin == null) return null;
            const stepEnd = r.toMin;
            const lunchInRange = lunchStartMin != null && lunchStartMin >= 8 * 60 && lunchStartMin < stepEnd;
            const coolTags = {
              shot:      ["前日 最終-2", "前日 最終-1", "前日 最終", "当日 第1クール", "当日 第2クール"],
              waridashi: ["前日 最終-3", "前日 最終-2", "前日 最終-1", "当日 第1クール"],
            }[step.key];
            const plascoProcMin = step.key === "waridashi" ? 30 : 0;
            const trimmingBlocks = step.key === "maisotsu" && todayCools.length >= 3
              ? [
                  { label: "トリミング（第2クール）", start: todayCools[1]?.startMin, end: todayCools[1]?.startMin + 30 },
                  { label: "トリミング（第3クール）", start: todayCools[2]?.startMin, end: todayCools[2]?.startMin + 30 },
                ]
              : null;
            const assignedName = assigns[step.key];
            const ability = r.ability ?? 1.0;

            return (
              <div key={step.key} style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${step.color}44`,
                borderLeft: `3px solid ${step.color}`,
                borderRadius: "0 12px 12px 0",
                padding: "12px 14px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{step.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: step.color, display: "flex", alignItems: "center", gap: 8 }}>
                      {step.label}
                      {assignedName && (
                        <span style={{ fontSize: 11, color: "#a0b8c8", fontWeight: 400 }}>
                          👤 {assignedName}
                          <span style={{ marginLeft: 4, color: ability >= 1 ? "#7DBF6E" : "#E8835A" }}>
                            （×{ability.toFixed(2)}）
                          </span>
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#b0ccd8", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ background: "rgba(255,200,80,0.12)", border: "1px solid rgba(255,200,80,0.25)", borderRadius: 5, padding: "2px 7px", color: "#e8d080" }}>08:00</span>
                      <span style={{ color: "#556677" }}>→</span>
                      <span style={{ background: "rgba(255,255,255,0.09)", borderRadius: 5, padding: "2px 7px" }}>{minutesToTime(stepEnd)}</span>
                    </div>
                    {coolTags && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
                        {coolTags.map((tag, ti) => (
                          <span key={ti} style={{
                            fontSize: 9, padding: "1px 6px", borderRadius: 4,
                            background: tag.startsWith("前日") ? "rgba(255,200,80,0.12)" : "rgba(74,144,217,0.12)",
                            border: tag.startsWith("前日") ? "1px solid rgba(255,200,80,0.25)" : "1px solid rgba(74,144,217,0.25)",
                            color: tag.startsWith("前日") ? "#c8a84b" : "#7aaed6",
                          }}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 9, color: "#556677", textAlign: "right" }}>{r.toLabel}</div>
                </div>
                {plascoProcMin > 0 && (
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 7, background: "rgba(180,120,220,0.08)", border: "1px dashed rgba(180,120,220,0.4)", borderRadius: 7, padding: "5px 10px" }}>
                    <span style={{ fontSize: 12 }}>⚗️</span>
                    <span style={{ fontSize: 11, color: "#b87adc", fontWeight: 600 }}>プラスコ処理</span>
                    <span style={{ fontSize: 11, color: "#b0ccd8", marginLeft: 3 }}>08:00 〜 {minutesToTime(8 * 60 + plascoProcMin)}</span>
                    <span style={{ fontSize: 10, color: "#7a5580", marginLeft: "auto" }}>30分</span>
                  </div>
                )}
                {trimmingBlocks && trimmingBlocks.map((tb, ti) => (
                  <div key={ti} style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 7, background: "rgba(74,144,217,0.08)", border: "1px dashed rgba(74,144,217,0.35)", borderRadius: 7, padding: "5px 10px" }}>
                    <span style={{ fontSize: 12 }}>✂️</span>
                    <span style={{ fontSize: 11, color: "#7aaed6", fontWeight: 600 }}>{tb.label}</span>
                    <span style={{ fontSize: 11, color: "#b0ccd8", marginLeft: 3 }}>{minutesToTime(tb.start)} 〜 {minutesToTime(tb.end)}</span>
                    <span style={{ fontSize: 10, color: "#3a6080", marginLeft: "auto" }}>30分</span>
                  </div>
                ))}
                {lunchInRange && (
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 7, background: "rgba(232,131,90,0.08)", border: "1px dashed rgba(232,131,90,0.4)", borderRadius: 7, padding: "5px 10px" }}>
                    <span style={{ fontSize: 12 }}>🍱</span>
                    <span style={{ fontSize: 11, color: "#E8835A", fontWeight: 600 }}>昼休み</span>
                    <span style={{ fontSize: 11, color: "#b0ccd8", marginLeft: 3 }}>{minutesToTime(lunchStartMin)} 〜 {minutesToTime((lunchStartMin ?? 0) + 75)}</span>
                    <span style={{ fontSize: 10, color: "#7a5533", marginLeft: "auto" }}>75分</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* 模型出し（タイムテーブル） */}
          {mokeiActive && (
            <div style={{ background: "rgba(100,200,150,0.05)", border: "1px solid rgba(100,200,150,0.3)", borderLeft: "3px solid #6ec89a", borderRadius: "0 12px 12px 0", padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20 }}>🏗️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "#6ec89a" }}>
                  模型出し{mokeiStaff && <span style={{ fontSize: 11, color: "#9de8c0", marginLeft: 8 }}>👤 {mokeiStaff}</span>}
                </div>
                <div style={{ fontSize: 12, color: "#b0ccd8", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ background: "rgba(255,200,80,0.12)", border: "1px solid rgba(255,200,80,0.25)", borderRadius: 5, padding: "2px 7px", color: "#e8d080" }}>{minutesToTime(MOKEI_START_MIN)}</span>
                  <span style={{ color: "#556677" }}>→</span>
                  <span style={{ background: "rgba(255,255,255,0.09)", borderRadius: 5, padding: "2px 7px" }}>{minutesToTime(MOKEI_START_MIN + mokeiMin)}</span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#6ec89a" }}>{mokeiMin}分</div>
            </div>
          )}

          {/* 掃除（タイムテーブル） */}
          {(() => {
            const r = stepRanges.souji;
            if (!r) return null;
            return (
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(139,172,200,0.3)", borderLeft: "3px solid #8BACC8", borderRadius: "0 12px 12px 0", padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20 }}>🧹</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "#8BACC8" }}>掃除</div>
                    <div style={{ fontSize: 12, color: "#b0ccd8", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ background: "rgba(255,255,255,0.09)", borderRadius: 5, padding: "2px 7px" }}>{minutesToTime(r.startMin)}</span>
                      <span style={{ color: "#556677" }}>→</span>
                      <span style={{ background: "rgba(255,255,255,0.09)", borderRadius: 5, padding: "2px 7px" }}>{minutesToTime(finishMin)}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#8bacc8" }}>計{totalSoujiMin}分</div>
                </div>
                <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
                  {[
                    { label: "通常掃除", val: soujiMin, color: "#8BACC8" },
                    { label: "🪣タンク", val: tankMin, color: "#7DBF6E" },
                    { label: "❄️エアコン", val: airconMin, color: "#4A90D9" },
                    { label: "🌀集塵機", val: dustMin, color: "#C97CC4" },
                  ].filter(x => x.val > 0).map(x => (
                    <span key={x.label} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: x.color }}>
                      {x.label} {x.val}分
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: 24, color: "#334455", fontSize: 10 }}>
        営業時間 08:00〜21:00　1〜25床=1時間 / 26〜60床=2時間
      </div>
    </div>
  );
}

const btnStyle = {
  width: 26, height: 26, borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 15, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};
const smallBtnStyle = {
  fontSize: 10, padding: "3px 8px", borderRadius: 5,
  border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.07)",
  color: "#aabbcc", cursor: "pointer",
};
