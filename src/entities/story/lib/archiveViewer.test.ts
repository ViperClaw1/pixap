import { describe, expect, it } from "vitest";
import type { StoryItem } from "@/shared/model/types/stories";
import { rotateStoriesFromIndex } from "./archiveViewer";

function makeStory(id: string): StoryItem {
  return {
    id,
    user_id: "u1",
    place_id: "p1",
    content: id,
    media_url: null,
    created_at: "2026-01-01T00:00:00.000Z",
    reaction_count: 0,
    comment_count: 0,
    my_reaction: null,
    profile: null,
  };
}

describe("rotateStoriesFromIndex", () => {
  it("rotates array so selected index becomes first", () => {
    const stories = [makeStory("s1"), makeStory("s2"), makeStory("s3"), makeStory("s4")];
    const rotated = rotateStoriesFromIndex(stories, 2);
    expect(rotated.map((s) => s.id)).toEqual(["s3", "s4", "s1", "s2"]);
  });

  it("clamps invalid index and keeps deterministic order", () => {
    const stories = [makeStory("s1"), makeStory("s2"), makeStory("s3")];
    const rotated = rotateStoriesFromIndex(stories, 999);
    expect(rotated.map((s) => s.id)).toEqual(["s3", "s1", "s2"]);
  });
});

