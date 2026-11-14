/** Shown while a local model call is in flight. */
export function Analysing({ showText = true }: { showText?: boolean }) {
  return (
    <div className="analysing" role="status">
      {showText && <p className="analysing__text">AI analysing</p>}
      <div className="analysing__track">
        <div className="analysing__bar" />
      </div>
    </div>
  );
}
