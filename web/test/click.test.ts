import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { useClick } from "~/composables/useClick";
import { fakeAudio, timers } from "./clickFakes";

const chart = () =>
  ref({ beats: 4 as const, style: "Medium up", metreChanges: false });

describe("useClick", () => {
  beforeEach(() => localStorage.removeItem("csm-click"));

  it("starts at the style’s tempo and feel, remembers them per chart", () => {
    localStorage.clear();
    const c = useClick(chart(), ref("autumn-leaves"), { audio: fakeAudio });
    expect([c.tempo.value, c.feel.value]).toEqual([160, "swing"]);
    c.tempo.value = 140;
    c.feel.value = "quarters";
    const again = useClick(chart(), ref("autumn-leaves"), { audio: fakeAudio });
    expect([again.tempo.value, again.feel.value]).toEqual([140, "quarters"]);
    expect(
      useClick(chart(), ref(undefined), { audio: fakeAudio }).tempo.value,
    ).toBe(160); // a draft: not remembered
  });

  it("books the clicks ahead of the clock, once each", async () => {
    const audio = fakeAudio();
    const t = timers();
    const c = useClick(chart(), ref(undefined), { audio: () => audio, ...t });
    c.feel.value = "quarters";
    await c.start();
    expect(c.running.value).toBe(true);
    t.tick();
    expect(audio.played.map((p) => p.kind)).toEqual(["accent"]); // 160 bpm: the next beat is 0.375 s away, past the 0.1 s lookahead
    audio.clock.t = 0.3;
    t.tick();
    expect(audio.played).toHaveLength(2);
    await c.start(); // idempotent
    t.tick();
    expect(audio.played).toHaveLength(2);
  });

  it("skips what it missed in the background instead of bursting", async () => {
    const audio = fakeAudio();
    const t = timers();
    const c = useClick(chart(), ref(undefined), { audio: () => audio, ...t });
    await c.start();
    t.tick();
    audio.clock.t = 30; // the interval didn't run for 30 s
    t.tick();
    expect(audio.played.every((p) => p.time === 0 || p.time >= 30)).toBe(true);
    expect(audio.played.length).toBeLessThanOrEqual(3);
  });

  it("plays the count-in first and lights it", async () => {
    const audio = fakeAudio();
    const t = timers();
    const c = useClick(chart(), ref(undefined), { audio: () => audio, ...t });
    c.settings.value = { ...c.settings.value, countIn: 1 };
    await c.start();
    t.tick();
    expect(audio.played[0]?.kind).toBe("count");
    expect(c.counting.value).toBe(true);
    expect(c.beat.value).toBe(0);
  });

  it("stop suspends and clears the beat; dispose closes", async () => {
    const audio = fakeAudio();
    const suspend = vi.spyOn(audio, "suspend");
    const close = vi.spyOn(audio, "close");
    const c = useClick(chart(), ref(undefined), {
      audio: () => audio,
      ...timers(),
    });
    await c.start();
    c.stop();
    expect(suspend).toHaveBeenCalled();
    expect([c.running.value, c.beat.value]).toEqual([false, null]);
    c.dispose();
    expect(close).toHaveBeenCalled();
  });

  it("hide stops it; show doesn’t start it", async () => {
    const c = useClick(chart(), ref(undefined), {
      audio: fakeAudio,
      ...timers(),
    });
    c.show();
    expect([c.shown.value, c.running.value]).toEqual([true, false]);
    await c.start();
    c.hide();
    expect([c.shown.value, c.running.value]).toEqual([false, false]);
  });

  it("toggle ignores key repeat; tap sets the tempo", () => {
    const c = useClick(chart(), ref(undefined), {
      audio: fakeAudio,
      ...timers(),
    });
    c.toggle(new KeyboardEvent("keydown", { key: " ", repeat: true }));
    expect(c.running.value).toBe(false);
    vi.useFakeTimers();
    for (const ms of [0, 500, 1000]) {
      vi.setSystemTime(ms);
      c.tap();
    }
    vi.useRealTimers();
    expect(c.tempo.value).toBe(120);
  });

  it("is unavailable without WebAudio", async () => {
    const c = useClick(chart(), ref(undefined), {
      audio: () => null,
      ...timers(),
    });
    await c.start();
    expect([c.running.value, c.unavailable.value]).toEqual([false, true]);
  });

  it("keeps its settings in this browser", () => {
    localStorage.clear();
    const c = useClick(chart(), ref(undefined), { audio: fakeAudio });
    c.settings.value = {
      hat: true,
      countIn: 2,
      sound: "beep",
      folded: true,
      hear: true,
      hearRhythm: false,
    };
    expect(
      useClick(chart(), ref(undefined), { audio: fakeAudio }).settings.value,
    ).toEqual({
      hat: true,
      countIn: 2,
      sound: "beep",
      folded: true,
      hear: true,
      hearRhythm: false,
    });
  });

  it("back from a hidden tab, books no beat twice", async () => {
    const audio = fakeAudio();
    const t = timers();
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    const c = useClick(chart(), ref(undefined), { audio: () => audio, ...t });
    await c.start();
    for (const at of [1, 2, 3.4]) {
      // the last lookahead ends mid-bar (bars at 0, 1.5, 3, 4.5 s)
      audio.clock.t = at;
      t.tick();
    }
    hidden.mockReturnValue(false);
    for (let at = 3.5; at < 5; at += 0.025) {
      audio.clock.t = at; // the interval's 25 ms, back in the foreground
      t.tick();
    }
    hidden.mockRestore();
    const times = audio.played.map((p) => p.time);
    expect(times.length).toBe(new Set(times).size);
  });

  it("a chart’s style, edited, moves the tempo it hasn’t been given, and stores nothing", async () => {
    localStorage.removeItem("csm-click:mine:abc");
    const style = ref({ beats: 4 as const, style: "M", metreChanges: false });
    const c = useClick(style, ref("mine:abc"), { audio: fakeAudio });
    style.value = { ...style.value, style: "Medium up" };
    await nextTick();
    expect(c.tempo.value).toBe(160);
    expect(localStorage.getItem("csm-click:mine:abc")).toBeNull();
    c.tempo.value = 100;
    style.value = { ...style.value, style: "Ballad" };
    await nextTick();
    expect(c.tempo.value).toBe(100); // the player's tempo stays
  });

  it("a draft keeps the tempo the player set when its style changes", async () => {
    const style = ref({
      beats: 4 as const,
      style: "Medium",
      metreChanges: false,
    });
    const c = useClick(style, ref(undefined), { audio: fakeAudio });
    c.tempo.value = 90;
    style.value = { ...style.value, style: "Up" };
    await nextTick();
    expect(c.tempo.value).toBe(90);
  });

  it("a refused resume leaves it stopped and says so", async () => {
    const audio = {
      ...fakeAudio(),
      resume: () => Promise.reject(new Error("no")),
    };
    const c = useClick(chart(), ref(undefined), {
      audio: () => audio,
      ...timers(),
    });
    await c.start();
    expect([c.running.value, c.unavailable.value]).toEqual([false, true]);
  });

  it("Start, Stop and Start again before the audio resumes runs one scheduler", async () => {
    const pending: (() => void)[] = [];
    const audio = {
      ...fakeAudio(),
      resume: () => new Promise<void>((r) => pending.push(r)),
    };
    let intervals = 0;
    let frames = 0;
    const c = useClick(chart(), ref(undefined), {
      audio: () => audio,
      setInterval: () => ++intervals,
      clearInterval: () => {},
      raf: () => ++frames,
    });
    const first = c.start();
    c.stop();
    const second = c.start();
    for (const r of pending) r();
    await Promise.all([first, second]);
    expect([intervals, frames, c.running.value]).toEqual([1, 1, true]);
  });

  it("a swing style plays its skip note from the start; Quarters plays the beats alone", async () => {
    const audio = fakeAudio();
    const t = timers();
    const c = useClick(chart(), ref(undefined), { audio: () => audio, ...t });
    await c.start();
    for (const at of [0, 0.2]) {
      audio.clock.t = at;
      t.tick();
    }
    expect(audio.played.map((p) => p.kind)).toEqual(["accent", "sub"]); // 160 bpm: the skip note at 0.25 s
    c.feel.value = "quarters";
    for (const at of [0.4, 0.6, 0.8, 1.0, 1.2, 1.4]) {
      audio.clock.t = at;
      t.tick();
    }
    expect(audio.played.slice(2).some((p) => p.kind === "sub")).toBe(false);
  });

  it("Click on follows the rhythm’s Feel until it’s set, then the chart remembers it", async () => {
    localStorage.clear();
    const c4 = ref({
      beats: 4 as const,
      style: "Medium up",
      metreChanges: false,
      rhythmFeel: 4 as 4 | 2 | 1,
    });
    const c = useClick(c4, ref("autumn-leaves"), { audio: fakeAudio });
    expect(c.pattern.value).toBe("all");
    c4.value = { ...c4.value, rhythmFeel: 2 };
    await nextTick();
    expect(c.pattern.value).toBe("2-4");
    expect(localStorage.getItem("csm-click:autumn-leaves")).toBeNull(); // followed, not chosen
    c.pattern.value = "3";
    c4.value = { ...c4.value, rhythmFeel: 1 };
    await nextTick();
    expect(c.pattern.value).toBe("3");
    expect(
      useClick(ref({ ...c4.value }), ref("autumn-leaves"), { audio: fakeAudio })
        .pattern.value,
    ).toBe("3");
  });

  it("Swing: two thirds until moved, then the chart remembers it, clamped", () => {
    localStorage.clear();
    const c = useClick(chart(), ref("autumn-leaves"), { audio: fakeAudio });
    expect(c.swing.value).toBeCloseTo(2 / 3);
    expect(localStorage.getItem("csm-click:autumn-leaves")).toBeNull(); // not moved, not stored
    c.swing.value = 0.6;
    expect(
      JSON.parse(localStorage.getItem("csm-click:autumn-leaves")!),
    ).toEqual({ swing: 0.6 });
    expect(
      useClick(chart(), ref("autumn-leaves"), { audio: fakeAudio }).swing.value,
    ).toBe(0.6);
    localStorage.setItem(
      "csm-click:autumn-leaves",
      JSON.stringify({ swing: 0.9 }),
    );
    expect(
      useClick(chart(), ref("autumn-leaves"), { audio: fakeAudio }).swing.value,
    ).toBe(0.75);
  });

  it("puts the skip note where the swing dial says", async () => {
    const audio = fakeAudio();
    const t = timers();
    const c = useClick(
      ref({ beats: 4 as const, style: "Ballad", metreChanges: false }),
      ref(undefined),
      { audio: () => audio, ...t },
    ); // 66 bpm, swing
    c.swing.value = 0.75;
    await c.start();
    audio.clock.t = 0;
    t.tick();
    for (let at = 0; at < 1; at += 0.05) {
      audio.clock.t = at;
      t.tick();
    }
    expect(audio.played.find((p) => p.kind === "sub")?.time).toBeCloseTo(
      0.75 * (60 / 66),
    );
  });

  it("on 2 and 4 plays those beats alone and still lights the beat", async () => {
    const audio = fakeAudio();
    const t = timers();
    const c = useClick(chart(), ref(undefined), { audio: () => audio, ...t });
    c.pattern.value = "2-4";
    await c.start();
    for (let at = 0; at < 1.45; at += 0.05) {
      audio.clock.t = at;
      t.tick();
      if (at === 0) expect(c.beat.value).toBe(0);
    }
    expect(audio.played.map((p) => p.kind)).toEqual(["beat", "beat"]); // 160 bpm: beats 2 and 4 at 0.375 s and 1.125 s
  });

  describe("the form (#559)", () => {
    it("clicks each bar in its drawn bar’s meter, and the Line in the form’s order", async () => {
      const audio = fakeAudio();
      const t = timers();
      const c = useClick(
        ref({ beats: 4 as const, style: "Ballad", metreChanges: true }),
        ref(undefined),
        { audio: () => audio, ...t },
      );
      c.feel.value = "quarters";
      c.settings.value = { ...c.settings.value, hear: true };
      c.setLine({
        notes: [
          { bar: 0, at: 0, beats: 1, midi: 60 },
          { bar: 1, at: 0, beats: 1, midi: 62 },
        ],
        bars: 2,
      });
      c.setForm({ order: [1, 0, 1], beats: [4, 3] });
      expect(c.hasForm.value).toBe(true);
      await c.start();
      for (let at = 0; at < 9.5 * (60 / 66); at += 0.05) {
        audio.clock.t = at;
        t.tick();
      }
      const beat = 60 / 66;
      expect(
        audio.played
          .filter((p) => p.kind === "accent")
          .map((p) => p.time / beat),
      ).toEqual([0, 3, 7].map((n) => expect.closeTo(n, 5)));
      expect(audio.notes.map((n) => n.midi)).toEqual([62, 60, 62]);
      c.setForm(null);
      expect(c.hasForm.value).toBe(false);
    });
  });

  describe("Hear rhythm", () => {
    const rhythm = {
      hits: [
        { bar: 0, at: 0, accent: true },
        { bar: 0, at: 2, accent: false },
        { bar: 1, at: 1, accent: false },
      ],
      bars: 2,
    };
    async function hearing(hearRhythm: boolean) {
      const audio = fakeAudio();
      const t = timers();
      const c = useClick(
        ref({ beats: 4 as const, style: "Ballad", metreChanges: false }),
        ref(undefined),
        { audio: () => audio, ...t },
      );
      c.settings.value = { ...c.settings.value, hearRhythm };
      c.setRhythm(rhythm);
      await c.start();
      for (let at = 0; at < 8; at += 0.05) {
        audio.clock.t = at;
        t.tick();
      }
      return { audio, c, t };
    }

    it("starts on, and is remembered in this browser", () => {
      localStorage.removeItem("csm-click");
      const c = useClick(chart(), ref(undefined), { audio: fakeAudio });
      expect(c.settings.value.hearRhythm).toBe(true);
      c.settings.value = { ...c.settings.value, hearRhythm: false };
      expect(
        useClick(chart(), ref(undefined), { audio: fakeAudio }).settings.value
          .hearRhythm,
      ).toBe(false);
    });

    it("taps the rhythm with the click, bar by bar, looping the form", async () => {
      const { audio } = await hearing(true); // Ballad: 66 bpm, a beat is 0.909 s
      const beat = 60 / 66;
      expect(audio.hits.map((h) => h.accent)).toEqual([
        true,
        false,
        false,
        true,
      ]);
      expect(audio.hits[1]?.time).toBeCloseTo(2 * beat);
      expect(audio.hits[2]?.time).toBeCloseTo(5 * beat);
    });

    it("stays quiet with Hear rhythm off", async () => {
      expect((await hearing(false)).audio.hits).toEqual([]);
    });

    it("says whether there is a rhythm to hear", () => {
      const c = useClick(chart(), ref(undefined), { audio: fakeAudio });
      expect(c.hasRhythm.value).toBe(false);
      c.setRhythm(rhythm);
      expect(c.hasRhythm.value).toBe(true);
      c.setRhythm({ hits: [], bars: 4 });
      expect(c.hasRhythm.value).toBe(false);
    });
  });

  describe("Hear line", () => {
    const line = {
      notes: [
        { bar: 0, at: 0, beats: 4, midi: 65 },
        { bar: 1, at: 0, beats: 4, midi: 64 },
      ],
      bars: 2,
    };
    async function hearing(hear: boolean) {
      const audio = fakeAudio();
      const t = timers();
      const c = useClick(
        ref({ beats: 4 as const, style: "Ballad", metreChanges: false }),
        ref(undefined),
        { audio: () => audio, ...t },
      );
      c.settings.value = { ...c.settings.value, hear };
      c.setLine(line);
      await c.start();
      for (let at = 0; at < 8; at += 0.05) {
        audio.clock.t = at;
        t.tick();
      }
      return { audio, c, t };
    }

    it("starts off, and is remembered in this browser", () => {
      localStorage.removeItem("csm-click");
      const c = useClick(chart(), ref(undefined), { audio: fakeAudio });
      expect(c.settings.value.hear).toBe(false);
      c.settings.value = { ...c.settings.value, hear: true };
      expect(
        useClick(chart(), ref(undefined), { audio: fakeAudio }).settings.value
          .hear,
      ).toBe(true);
    });

    it("sounds the Line with the click, bar by bar, looping the form", async () => {
      const { audio } = await hearing(true); // Ballad: 66 bpm, a bar is 3.64 s
      expect(audio.notes.map((n) => n.midi)).toEqual([65, 64, 65]);
      expect(audio.notes[1]?.time).toBeCloseTo((4 * 60) / 66);
      expect(audio.notes[0]?.length).toBeCloseTo((4 * 60) / 66);
    });

    it("stays quiet with Hear line off, or with no Line", async () => {
      expect((await hearing(false)).audio.notes).toEqual([]);
      const { audio, c, t } = await hearing(true);
      c.setLine(null);
      const before = audio.notes.length;
      for (let at = 8; at < 12; at += 0.05) {
        audio.clock.t = at;
        t.tick();
      }
      expect(c.hasLine.value).toBe(false);
      expect(audio.notes).toHaveLength(before);
    });

    it("says whether there is a Line to hear", () => {
      const c = useClick(chart(), ref(undefined), { audio: fakeAudio });
      expect(c.hasLine.value).toBe(false);
      c.setLine(line);
      expect(c.hasLine.value).toBe(true);
      c.setLine({ notes: [], bars: 4 });
      expect(c.hasLine.value).toBe(false);
    });
  });

  describe("Play a staff", () => {
    const phrase = [
      { at: 0, beats: 0.5, midi: 60 },
      { at: 0.5, beats: 1, midi: 62 },
    ];
    function player() {
      const audio = fakeAudio();
      const t = timers();
      const c = useClick(chart(), ref(undefined), { audio: () => audio, ...t }); // 160 bpm, swing
      c.feel.value = "straight";
      return { audio, c, t };
    }

    it("with the click stopped, plays at once at its tempo, then says it’s done and suspends", async () => {
      const { audio, c, t } = player();
      audio.clock.t = 5;
      await c.play("a", phrase);
      expect(c.playing.value).toBe("a");
      expect(c.running.value).toBe(false);
      expect(audio.notes.map((n) => n.midi)).toEqual([60, 62]);
      expect(audio.notes[0]!.time).toBeGreaterThan(5);
      expect(audio.notes[1]!.time - audio.notes[0]!.time).toBeCloseTo(
        60 / 160 / 2,
      );
      t.end();
      expect(c.playing.value).toBe(null);
      expect(audio.suspended.n).toBe(1);
    });

    it("swings as far as the dial says", async () => {
      const { audio, c } = player();
      c.feel.value = "swing";
      c.swing.value = 0.75;
      await c.play("a", phrase);
      expect(audio.notes[1]!.time - audio.notes[0]!.time).toBeCloseTo(
        (60 / 160) * 0.75,
      );
    });

    it("with the click running, starts on its next bar", async () => {
      const { audio, c, t } = player();
      await c.start();
      audio.clock.t = 0.5;
      t.tick();
      await c.play("a", phrase);
      expect(audio.notes[0]!.time).toBeCloseTo((4 * 60) / 160);
      t.end();
      expect(audio.suspended.n).toBe(0); // the click plays on
    });

    it("one at a time: another Play, Stop, or the click stopping silences it", async () => {
      const { audio, c } = player();
      await c.play("a", phrase);
      await c.play("b", phrase);
      expect(audio.notes.map((n) => n.stopped)).toEqual([
        true,
        true,
        false,
        false,
      ]);
      expect(c.playing.value).toBe("b");
      c.stopPhrase();
      expect(audio.notes.every((n) => n.stopped)).toBe(true);
      expect(c.playing.value).toBe(null);
      await c.play("a", phrase);
      await c.start();
      c.stop();
      expect(c.playing.value).toBe(null);
      expect(audio.notes.every((n) => n.stopped)).toBe(true);
    });

    it("is unavailable without WebAudio", async () => {
      const c = useClick(chart(), ref(undefined), { audio: () => null });
      await c.play("a", phrase);
      expect([c.playing.value, c.unavailable.value]).toEqual([null, true]);
    });
  });
});
