import React, { useState, useMemo } from "react";
import { TIME_SLOTS, SLOT_HEIGHT, meetingPos, colorFor } from "../utils.js";

export default function Calendar({
  tr,
  lang,
  courses,
  selected,
  conflicts,
  hoveredSection,
  conflictFlash,
  removeSelected,
  calendarRef,
  setDraggingSection,
  toggleSelect,
  onCourseClick,
}) {
  const [dragOverDay, setDragOverDay] = useState(null);

  const placedBlocks = useMemo(() => {
    const blocks = [];

    selected.forEach((sel) => {
      const c = courses.find((c) => c.code === sel.code);
      if (!c) return;

      const sec = c.sections.find((s) => s.id === sel.sectionId);
      if (!sec) return;

      sec.meetings.forEach((m, mi) => {
        blocks.push({
          key: `${c.code}-${sel.sectionId}-${mi}`,
          courseKey: `${c.code}-${sel.sectionId}`,
          code: c.code,
          dept: c.dept,
          name: lang === "tr" ? c.nameTr : c.name,
          sectionId: sel.sectionId,
          instructor: sec.instructor,
          meeting: m,
          isGhost: false,
        });
      });
    });

    return blocks;
  }, [selected, courses, lang]);

  const ghostBlocks = useMemo(() => {
    if (!hoveredSection) return [];

    const isAlreadySelected = selected.some(
      (s) =>
        s.code === hoveredSection.code &&
        s.sectionId === hoveredSection.sectionId
    );

    if (isAlreadySelected) return [];

    const c = courses.find((c) => c.code === hoveredSection.code);
    if (!c) return [];

    const sec = c.sections.find((s) => s.id === hoveredSection.sectionId);
    if (!sec) return [];

    return sec.meetings.map((m, mi) => ({
      key: `ghost-${c.code}-${sec.id}-${mi}`,
      courseKey: `${c.code}-${sec.id}`,
      code: c.code,
      dept: c.dept,
      name: lang === "tr" ? c.nameTr : c.name,
      sectionId: sec.id,
      instructor: sec.instructor,
      meeting: m,
      isGhost: true,
    }));
  }, [hoveredSection, courses, selected, lang]);

  const handleDragOver = (e, dayIdx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverDay(dayIdx);
  };

  const handleDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOverDay(null);
  };

  const handleDrop = (e, dayIdx) => {
    e.preventDefault();

    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;

    const [code, sectionId] = data.split("|");

    if (code && sectionId) {
      toggleSelect(code, sectionId);
    }

    setDragOverDay(null);
    setDraggingSection(null);
  };

  return (
    <div className="calendar-wrap">
      <div className="calendar" ref={calendarRef}>
        <div className="cal-corner" />

        {tr.days.map((d, i) => (
          <div
            key={i}
            className={`cal-dayhead ${dragOverDay === i ? "drag-over" : ""}`}
          >
            <div className="dayhead-name">{d}</div>
            <div className="dayhead-short">{tr.daysShort[i]}</div>
          </div>
        ))}

        <div className="cal-timecol">
          {TIME_SLOTS.map((t, i) => (
            <div
              key={i}
              className="cal-timelabel"
              style={{ height: SLOT_HEIGHT }}
            >
              <span>{t}</span>
            </div>
          ))}
        </div>

        {[0, 1, 2, 3, 4].map((dayIdx) => (
          <div
            key={dayIdx}
            className={`cal-daycol ${
              dragOverDay === dayIdx ? "drag-over" : ""
            }`}
            onDragOver={(e) => handleDragOver(e, dayIdx)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, dayIdx)}
          >
            {TIME_SLOTS.map((_, i) => (
              <div
                key={i}
                className={`cal-slot ${i % 2 === 0 ? "even" : "odd"}`}
                style={{ height: SLOT_HEIGHT }}
              />
            ))}

            {ghostBlocks
              .filter((b) => b.meeting.d === dayIdx)
              .map((b) => (
                <CalendarBlock
                  key={b.key}
                  block={b}
                  tr={tr}
                  onCourseClick={onCourseClick}
                />
              ))}

            {placedBlocks
              .filter((b) => b.meeting.d === dayIdx)
              .map((b) => {
                const hasConflict = !!conflicts[b.courseKey];
                const isFlash = conflictFlash === b.courseKey;

                return (
                  <CalendarBlock
                    key={b.key}
                    block={b}
                    tr={tr}
                    hasConflict={hasConflict}
                    isFlash={isFlash}
                    onRemove={() => removeSelected(b.code)}
                    onCourseClick={onCourseClick}
                  />
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarBlock({
  block,
  tr,
  hasConflict,
  isFlash,
  onRemove,
  onCourseClick,
}) {
  const colors = colorFor(block.code);
  const { top, height } = meetingPos(block.meeting);

  const isGhost = block.isGhost;
  const blockH = height - 2;

  const tier =
    blockH < 56 ? "xs" : blockH < 78 ? "sm" : blockH < 110 ? "md" : "lg";

  const style = {
    top,
    height: blockH,
    background: isGhost ? `${colors.bg}33` : colors.bg,
    color: isGhost ? colors.bg : colors.fg,
    borderColor: colors.bg,
  };

  const handleBlockClick = () => {
    if (isGhost) return;
    onCourseClick?.(block.code);
  };

  const handleRemoveClick = (e) => {
    e.stopPropagation();
    onRemove?.();
  };

  return (
    <div
      className={`cal-block tier-${tier} ${isGhost ? "ghost" : ""} ${
        hasConflict ? "conflict" : ""
      } ${isFlash ? "flash" : ""}`}
      style={style}
      onClick={handleBlockClick}
    >
      <div className="cal-block-head">
        <span className="cal-block-code">{block.code}</span>
        <span className="cal-block-sec">§{block.sectionId}</span>
        <span className="cal-block-time-inline">{block.meeting.s}</span>

        {!isGhost && onRemove && (
          <button
            className="cal-block-close"
            onClick={handleRemoveClick}
            aria-label={tr.remove}
          >
            ×
          </button>
        )}
      </div>

      {tier !== "xs" && <div className="cal-block-name">{block.name}</div>}

      {(tier === "md" || tier === "lg") && (
        <div className="cal-block-meta">
          <span>
            {block.meeting.s}–{block.meeting.e}
          </span>
          <span>·</span>
          <span>{block.meeting.room}</span>
        </div>
      )}

      {tier === "sm" && (
        <div className="cal-block-meta">
          <span>{block.meeting.room}</span>
        </div>
      )}

      {hasConflict && tier !== "xs" && (
        <div className="cal-block-warn">⚠ {tr.conflict}</div>
      )}
    </div>
  );
}