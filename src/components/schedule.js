// Runs `run` once before the next paint, however often it is asked for until then. A browser may hold back
// the frame itself: WebKit pauses requestAnimationFrame in an iframe out of view, so a measured layout would
// wait there until it is scrolled to, and then jump. A timer stands in for a frame that does not come, and
// whichever comes first runs it. A frame not yet come means nothing has painted since, so either way it runs
// before the next paint.
export function frameScheduler(run, fallback = 100) {
  let frame, timer, queued = false;
  const flush = () => {
    if (!queued) return;
    queued = false;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    run();
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    frame = requestAnimationFrame(flush);
    timer = setTimeout(flush, fallback);
  };
  schedule.cancel = () => {
    if (!queued) return;
    queued = false;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
  };
  return schedule;
}
