// ── רכיב הטורים החדש עם השרשרת (Timeline) ────────────────────────────────
function ColumnWithTimeline({ title, events, type, onDelete }) {
  return (
    <div style={S.column}>
      <div className="kids-font" style={S.columnHeader}>{title}</div>
      {events.map((e, i) => {
        // חישוב הזמן שעבר מהאירוע הקודם כרונולוגית (זה שמתחתיו ברשימה)
        const nextEv = events[i + 1];
        let timeDiff = null;
        if (nextEv) {
          const diffMin = Math.floor((e.ts - nextEv.ts) / 60000);
          const hrs = Math.floor(diffMin / 60);
          const mins = diffMin % 60;
          timeDiff = hrs > 0 ? `${hrs} ש׳ ו-${mins} דק׳` : `${mins} דק׳`;
        }

        return (
          <div key={e.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <div style={{ ...S.eventMiniCard, background: e.user === "אבא" ? C.blueSoft : C.creamSoft }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span style={S.eventTime}>{fmtTime(e.ts)}</span>
                <button onClick={() => onDelete(e.id)} style={S.delBtn}>✕</button>
              </div>
              <span style={S.eventDetail}>
                {type === 'feed' ? `${e.ml} מ"ל` : (e.pee ? "💧" : "") + (e.poop ? "💩" : "")}
              </span>
            </div>
            
            {/* בועית זמן שחלף - השרשרת הוויזואלית */}
            {timeDiff && (
              <div style={S.timelineConnector}>
                <div style={S.timelineLine}></div>
                <div style={S.timelineBadge}>עברו: {timeDiff}</div>
                <div style={S.timelineLine}></div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── הגדרות העיצוב לשרשרת ──────────────────────────────────────────────────
const S_EXTENDED = {
  timelineConnector: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    margin: '4px 0'
  },
  timelineLine: {
    width: '2px',
    height: '10px',
    background: '#f7d7c4', // צבע הפיץ' של הגבולות
  },
  timelineBadge: {
    fontSize: '10px',
    background: '#fef3c7', // צהוב רך
    color: '#b45309',
    padding: '3px 10px',
    borderRadius: '12px',
    fontWeight: '800',
    border: '1px solid #fde68a',
    boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
  }
};
