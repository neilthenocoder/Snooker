// Fixed lists of words that are used in more than one place (the public pages and the dashboard).

/** The kinds of meeting, in the order of the filter buttons on /meetings. */
export const MEETING_KINDS = ["AGM", "Committee Meeting", "Special General Meeting", "Captains' Meeting", "Other"];

/**
 * A player's status. "playing" and "no_team" appear in squad lists, scorecards and entry forms;
 * "not_playing" and "deceased" don't — but their results, breaks and profile page stay.
 */
export const PLAYER_STATUS = {
  playing: "Playing", no_team: "No team at the moment",
  not_playing: "Not playing (stopped / retired)", deceased: "Sadly no longer with us",
};
/** The short tag shown beside a player's name on the website (nothing for someone who is playing). */
export const PLAYER_TAG = { no_team: "No team at the moment", not_playing: "No longer playing", deceased: "Sadly no longer with us" };
