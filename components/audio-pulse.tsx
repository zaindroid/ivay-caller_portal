/** The portal's one signature motif: a small audio-equalizer pulse, used
 * anywhere something is live right now (an active campaign, a connected
 * call, a healthy connection). Color comes from the current text color. */
export function AudioPulse({ className = "" }: { className?: string }) {
  return (
    <span className={`audio-pulse ${className}`} aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}
