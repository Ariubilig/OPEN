import { GROUPS, type Affect, type Group, type Story } from '../data/schema'

/** A group name from a URL parameter, or null when it is not one of the schema groups. */
export function parseGroup(value: string | null): Group | null {
  return GROUPS.find((g) => g === value) ?? null
}

/** Groups at least one story affects, in schema order, with how many stories affect each. */
export function groupCounts(
  stories: Story[],
): { group: Group; count: number }[] {
  return GROUPS.map((group) => ({
    group,
    count: stories.filter((s) => s.affects.some((a) => a.group === group))
      .length,
  })).filter((g) => g.count > 0)
}

/** The stories that affect `group`, in feed order, each with its sentences for that group. */
export function storiesFor(
  stories: Story[],
  group: Group,
): { story: Story; affects: Affect[] }[] {
  return stories
    .map((story) => ({
      story,
      affects: story.affects.filter((a) => a.group === group),
    }))
    .filter((x) => x.affects.length > 0)
}
