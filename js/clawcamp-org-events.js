// Merges external event lists (data/clawcamp-org-events.json from clawcamp.org and
// data/luma-claw-events.json from the luma.com/claw calendar) into the events
// array the pages render. An event is skipped when an existing DB or static row
// has the same link, or the same date + city AND a title sharing a meaningful word
// (so two different events in one city on one day both stay visible).
// Never rejects: on any failure the page just renders without these events.
(function () {
  var STOP = /^(ai|in|to|of|the|and|a|an|for|with|x|at|on|how|is|by|from|edition|openclaw|claw|clawcamp|meetup|workshop|agent|agents|\d+(st|nd|rd|th)?|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/;
  function tokens(name) {
    var out = {};
    String(name || '').toLowerCase().split(/[^a-z0-9]+/).forEach(function (w) {
      if (w && !STOP.test(w)) out[w] = true;
    });
    return out;
  }
  function overlaps(a, b) {
    for (var w in a) if (b[w]) return true;
    return false;
  }
  var SOURCES = ['/data/clawcamp-org-events.json', '/data/luma-claw-events.json'];
  function normLink(u) {
    return String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/^lu\.ma\//, 'luma.com/')
      .split('#')[0].split('?')[0].replace(/\/+$/, '');
  }
  function loadOne(url) {
    return fetch(url).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
  }
  window.loadClawcampOrgEvents = function (dbEvents) {
    return Promise.all(SOURCES.map(loadOne))
      .then(function (lists) { return [].concat.apply([], lists); })
      .then(function (extra) {
        var seen = {}, links = {};
        function add(d, c, n) { (seen[d + '|' + c] = seen[d + '|' + c] || []).push(tokens(n)); }
        (dbEvents || []).forEach(function (e) { add(e.event_date, e.city, e.name); links[normLink(e.link)] = true; });
        document.querySelectorAll('.event-row[data-date]').forEach(function (r) {
          var n = r.querySelector('.event-name');
          add(r.dataset.date, r.dataset.city, n && n.textContent);
          links[normLink(r.getAttribute('href'))] = true;
        });
        var added = extra.filter(function (e) {
          var t = tokens(e.name);
          if (links[normLink(e.link)]) return false;
          links[normLink(e.link)] = true; // also dedupes across the two sources
          return !(seen[e.event_date + '|' + e.city] || []).some(function (o) { return overlaps(t, o); });
        });
        return (dbEvents || []).concat(added);
      });
  };
})();
