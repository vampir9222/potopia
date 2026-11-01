// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { claimMediaFocus } from "@app/ui";

afterEach(() => vi.restoreAllMocks());
it("met en pause la musique du portail pendant un lecteur GOTY et ne la reprend qu’après le dernier lecteur", async () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    this.dispatchEvent(new Event("pause"));
  });
  const music = document.createElement("audio");
  music.loop = true;
  // claimMediaFocus installe le suivi avant la première lecture.
  const init = claimMediaFocus();
  init();
  await music.play();
  const first = claimMediaFocus();
  const second = claimMediaFocus();
  expect(pause).toHaveBeenCalledTimes(1);
  const queued = document.createElement("audio");
  queued.loop = true;
  await queued.play();
  const cancelled = document.createElement("audio");
  cancelled.loop = true;
  await cancelled.play();
  cancelled.pause();
  expect(play).toHaveBeenCalledTimes(1);
  first();
  expect(play).toHaveBeenCalledTimes(1);
  second();
  second();
  expect(play).toHaveBeenCalledTimes(3);
});
