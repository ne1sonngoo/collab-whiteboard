import Note from "./Note";

export default function NotesLayer({
  notes,
  livePositions,
  draggingNote,
  resizingNote,
  bringToFront,
  startDragging,
  startResizing,
  setNotes,
  getCanvasCoords,
}) {
  return (
    <>
      {notes.map((note) => {
        const live = livePositions.current.get(note.id);
        const x = live?.x ?? note.x;
        const y = live?.y ?? note.y;

        return (
          <Note
            key={note.id}
            note={note}
            x={x}
            y={y}
            draggingNote={draggingNote}
            resizingNote={resizingNote}
            bringToFront={bringToFront}
            startDragging={startDragging}
            startResizing={startResizing}
            setNotes={setNotes}
            getCanvasCoords={getCanvasCoords}
          />
        );
      })}
    </>
  );
}