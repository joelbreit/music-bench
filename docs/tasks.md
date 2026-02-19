# MusicBench — Tasks

- [x] Bug: When I leave the Run surface and come back, the RunRow metadata doesn't show any more
- [x] Potential bug: When I start a Run, the Plan and Models selectors are disabled
  - I don't know if the disabling is intentional, but if I navigate away and back, they are enabled again, and starting another Run seems to, for the most part (see below), work as expected.
- [x] Bug: When multiple Runs are going, only the top one shows metadata updates. It gets the update of all active Runs, so if a run with 3 trials and a run with 5 trials are both running, it switches back and forth to whatever was updated last: 2/3 -> 3/5 -> 3/3 -> 4/5 etc.
- [ ] Improvement: add parallel execution of Trials
- [ ] Improvement: Prompt versioning. Probably at the Plan level, but open to advice.
- [ ] Improvement: Trials are clearly taking roughly a minute each to run. We are logging "latency", but we should log the actual time it takes to run each Trial.
- [ ] UI: Basically all of the left-side panels should are too scrunched. They should be given more space. If it wouldn't be a pain, it would be nice to be able to adjust the width of the panels a la VSCode, but that is an effort decision.
- [ ] UI: I keep needing to scroll a long way to click buttons at the bottom of the screen. The panels and main sections should probably be independently scrollable.