# What the old site holds per player

Looked at three player pages (HTML) on 07/10/2026, plus the same records through the REST API (`/wp-json/sportspress/v2/players?search=<name>`), which exposes the profile fields as a `metrics` object.

## Structure of every player page (/player/<slug>/)

1. Heading: player name, sometimes prefixed by a squad number (e.g. "4 Ryan Bilson").
2. A photo. Most are generic placeholder avatars (files named `player-profile-2-300x300.png`, `player-profile-cues-15-300x300.png`, `player-profile-17-300x300.png`); a few are real photos (Richard Pearson (Admin): `IMG_4882-225x300.jpeg`).
3. A details list: Name, Position (Player / Team Captain / Vice Captain), Handicap, then any profile questions the player has answered, Biography, Current Team, Past Teams, Leagues, Seasons, Birthday, Age.
4. One statistics table per competition the player is tagged with (Victory League or Rees Memorial League, Team Handicap, Willie Thomas, Team Pairs, Snooker Shoot-Out, Singles, Seniors, Handicap Doubles, Gordon Boynton Trophy, Doubles, Bill Toms, Rees League Singles). Columns: Season, Team, Points, Wins, Brks, Games Played, Games Won, Win Percentage; one row per season from 2018-2019 plus a Total row.
5. A list of the player's team's fixtures/results going back several seasons.

The main text area of the player record (WordPress post content) is empty for every record seen. So there is no long free-text article per player; the "profile" is the question-and-answer fields plus a one-line Biography field.

## Birthday / Age are not real

Every page shows a Birthday and Age, but they are the date the player record was created on the website, not a date of birth: Ryan Bilson "22/08/2019, Age 7", Amanda Fleming "22/08/2019, Age 7", Matt Green "10/09/2026, Age 0", Richard Pearson (Admin) "09/10/2023, Age 2". That is why the Birthday column in players.csv is empty for everyone.

## The profile questions (field names exactly as on the site)

Handicap; Left or Right Handed; What is your highest break? (shown as "Highest break" on one page); Biography; What has been the most memorable snooker match you have ever seen?; Do you have any snooker ambitions you still have not achieved?; Who is your bogey player?; Funniest moment in your snooker experience?; Who is the most under-rated player in the league?; Who is the best player in the league?; What is your Favourite professional player and why?; Who is your favourite TV commentator?; Who is the most famous professional player you have played or met?; What has been your greatest achievement in snooker?; At what age did you start playing snooker and why?; What was your first ever memory of snooker?; League (seen on one page).

## Example 1 - Ryan Bilson (/player/ryan-bilson/) - full set of answers

- Position: Player. Handicap: (0). Left or Right Handed: Right. Highest break: 122. Current Team: Mevagissey A. Photo: placeholder (`player-profile-2-300x300.png`).
- Biography: "Mr Passionate"
- What has been the most memorable snooker match you have ever seen? "Paul Matthews beating some guy in Rees League many moons ago! He was 52 behind with 27 on and won on the black......started 7:30 finished at 8:55.....marathon match but fair play to him"
- Do you have any snooker ambitions you still have not achieved? "Singles Champion/County Champion"
- Who is your bogey player? "Andy Peers"
- Funniest moment in your snooker experience? "Henry McGall picking up the white thinking Barrie McIntosh had gone in off with basically all the balls open and cert to win only for Barrie to punish that mistake and win on Pink i believe....Henry wasn't happy LOL"
- Who is the most under-rated player in the league? "Jason Cocks"
- Who is the best player in the league? "Barrie McIntosh"
- What is your Favourite professional player and why? "Judd Trump.......exciting to watch"
- Who is your favourite TV commentator? "John Virgo"
- Who is the most famous professional player you have played or met? "Judd Trump"
- What has been your greatest achievement in snooker? "Knocking in my first Century couldn't beat the buzz!"
- At what age did you start playing snooker and why? "17 and only started playing due to not playing football anymore"
- What was your first ever memory of snooker? "Really can't remember....."

## Example 2 - Matt Green (/player/matt-green/) - partial set of answers

- Position: Team Captain. Handicap: 5. Current Team: Bethel A. Photo: placeholder (`player-profile-cues-15-300x300.png`).
- Do you have any snooker ambitions you still have not achieved? "Want to hit the magic century"
- Who is the best player in the league? "Barry Macintosh when he plays"
- Left or Right Handed: "Right handed"
- Who is your favourite TV commentator? "Stephen hendry"
- Who is the most famous professional player you have played or met? "Mark selby"
- What has been your greatest achievement in snooker? "Winning bill Tom's competition"
- What is your highest break? 78

## Example 3 - Amanda Fleming (/player/amanda-fleming/) - statistics only

- Position: Team Captain. Handicap: 60. Current Team: Tregonissey C. Photo: placeholder (`player-profile-17-300x300.png`).
- No questions answered, no biography. Only the details list and the statistics tables (e.g. Rees Memorial League: 2018-2019 Tregonissey C 560 points, 20 games played, 5 won, 25.00%; Total 3298 points, 123 played, 25 won, 17.89%).

A fourth page was read because it is the one registered player with a real photo: Richard Pearson (Admin) (/player/richard-pearson-admin/) has every question answered, but several answers are joke/test text (Biography "Blah blah h blah", "Who is the best player in the league?" "Me", "Funniest moment" "Ironing the cloth").

## How many players have real profile text?

Not counted exactly (that would mean opening all ~150 pages). From the records whose profile fields were seen (about 27 current or recent players): 4 had several answers (Ryan Bilson, Matt Green, Richard Pearson, Andrew Kitt - 5 answers), 1 had a single field (Roger Smithson: "Left or Right Handed: r/h"), and the other ~22 had nothing but a handicap (e.g. Ian Ball, Howard Brett, Darran Lock, Chris Perring, Ben Rothwell, Steve Vicary, Steve Bennallack, Mark Nicolas, Andrew Tamblyn, Darren OShea, Les Shakespeare, Amanda Fleming). So roughly one player in five or six has any question answered and only a handful have a full set. This is an estimate from a small sample.

## Fastest way to pull the profile answers later

`https://stblazeydistrictsnooker.co.uk/wp-json/sportspress/v2/players?per_page=10&search=<name>&_fields=id,title,slug,current_teams,positions,metrics` returns the answers as `metrics` (keys are the question text). Requests for more than about 10 players at once time out. Each real player also has a shadow record named "<Name> (Ext)" that copies some of the same fields - ignore those.
