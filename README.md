# Flightline

A waterfowl map for New Hampshire, Massachusetts, Maine and Rhode Island,
2026–27 season. Formerly Granite Flyway.

**https://vikqazi.github.io/flightline/**

Turn on one state or several. Neighbouring states meet on the same Census
border line, so there are no gaps or overlaps at a state line.

Zone polygons are not sketched. They are routed along the actual roads named
in each state's written boundary description (Maine's Coastal Zone is the
state's own polygon), and each state's zones add up to its outline exactly.
Maine's 2026–27 North/South line is the newly adopted Route 2 line; the
state's printed zone map and GIS layer still show the old one, which the app
draws dotted for comparison. Rhode Island sets every season statewide except
the late Canada goose season, so its two areas follow the late-season goose
line: the named roads on land, and RIDEM's own line across the bay.

The address bar carries the view, so a copied link opens on the same spot
with the same states: `#map=zoom/lat/lon&s=nh,ri`.

Each state's data loads when you turn that state on. Once loaded, zones,
seasons and layers keep working without signal while the page stays open.
Weather, satellite and topo imagery need a connection.

Search (the magnifier, or press /) finds towns, villages, lakes, rivers, bays,
points, islands, marshes, ramps, public land, refuges and eBird hotspots in
the states shown. It uses the data already on the page plus USGS place names,
and it reads pasted coordinates: decimal degrees, degrees and minutes, or a
Google or Apple Maps link. Street addresses are looked up only when you ask,
through OpenStreetMap's Nominatim.

Waterfowl sightings come from eBird (Cornell Lab of Ornithology): ducks,
geese and coots reported at public eBird hotspots in the last two weeks.
Personal locations are left out. A scheduled GitHub Action
(`.github/workflows/sightings.yml`) refreshes `data/<state>/sightings.json`
every morning. It uses an API key kept as a repository secret, so the key
never reaches the page. Until that secret exists the job does nothing and
the layer stays hidden. eBird data are used under the eBird API Terms of
Use: non-commercial, credited to eBird.org.

Sources and limitations are listed in the app under Regs → Sources, and in
LICENSE.
