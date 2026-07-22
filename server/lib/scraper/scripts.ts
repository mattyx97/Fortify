/** Browser-evaluated scripts as plain strings to avoid esbuild __name injection issues. */

export const LINKEDIN_PROFILE_SCRIPT = `(() => {
  var rawText = (document.body && document.body.innerText) ? document.body.innerText : ''
  var lines = rawText.split('\\n').map(function (l) {
    return l.replace(/[\\u200B-\\u200D\\uFEFF]/g, '').replace(/\\s+$/, '').replace(/^\\s+/, '')
  })

  // ---------- predicates ----------
  function hasYear(l) { return /(?:19|20)\\d{2}/.test(l) }
  function isDate(l) {
    if (!l || !hasYear(l)) return false
    var low = l.toLowerCase()
    return l.indexOf('-') >= 0 || l.indexOf('–') >= 0 || low.indexOf('present') >= 0
      || /\\b(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic|jan|may|jun|jul|aug|sep|oct|dec)\\b/.test(low)
  }
  function isSkillsSummary(l) {
    if (!l) return false
    var low = l.toLowerCase()
    if (low.indexOf('competenz') >= 0) return true
    return low.indexOf('skill') >= 0 && l.indexOf('+') >= 0
  }
  function isTypeDuration(l) {
    if (!l || l.indexOf('·') < 0 || hasYear(l)) return false
    // Grouped-company meta line carries the TOTAL tenure, e.g. "A tempo pieno · 3 anni e 7 mesi".
    // Require a duration token, otherwise a member-view "COMPANY · Autonomo" line (employment
    // type only, no duration) would be mistaken for a grouped-company header.
    return /\\b(ann[oi]|mes[ei]|year|yr|month|mo)\\b/.test(l.toLowerCase())
  }
  function stripEmploymentType(company) {
    // "GREM COMPANY · Autonomo" -> "GREM COMPANY"; leaves plain names untouched.
    return (company || '').split('·')[0].replace(/\\s+$/, '').replace(/^\\s+/, '')
  }
  function isLocation(l) {
    return !!l && l.indexOf(',') >= 0 && l.indexOf('·') < 0 && !hasYear(l)
      && l.length >= 5 && l.length < 70 && !isSkillsSummary(l)
  }
  function isCurrent(l) { return /present/i.test(l) }

  // ---------- section detection (by title text — layout independent) ----------
  function findSection(markers) {
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i]
      for (var m = 0; m < markers.length; m++) {
        if (t === markers[m] || t.indexOf(markers[m] + ' (') === 0) return i
      }
    }
    return -1
  }
  var sectionIndexes = {
    about: findSection(['Informazioni', 'About']),
    activity: findSection(['Attività', 'Activity']),
    experience: findSection(['Esperienza', 'Experience']),
    education: findSection(['Formazione', 'Education']),
    skills: findSection(['Competenze', 'Skills']),
    projects: findSection(['Progetti', 'Projects']),
    certifications: findSection(['Licenze e certificazioni', 'Licenses & certifications', 'Licenses and certifications']),
    languages: findSection(['Lingue', 'Languages']),
    volunteering: findSection(['Volontariato', 'Volunteering']),
    // Boundary-only markers: not extracted, but they cap the section above them
    // so the last real section (often Skills) doesn't run into page footer/suggestions.
    interests: findSection(['Interessi', 'Interests']),
    peopleAlsoViewed: findSection(['Altri profili consultati', 'People also viewed']),
    peopleYouMayKnow: findSection(['Persone che potresti conoscere', 'People you may know']),
  }
  var orderedKeys = Object.keys(sectionIndexes)
    .filter(function (k) { return sectionIndexes[k] >= 0 })
    .sort(function (a, b) { return sectionIndexes[a] - sectionIndexes[b] })
  function sectionLines(key) {
    var start = sectionIndexes[key]
    if (start < 0) return []
    var idx = orderedKeys.indexOf(key)
    var end = idx < orderedKeys.length - 1 ? sectionIndexes[orderedKeys[idx + 1]] : lines.length
    return lines.slice(start + 1, end).filter(Boolean)
  }
  function notMostra(l) { return l.indexOf('Mostra') !== 0 && l.indexOf('Show') !== 0 && l.indexOf('Vedi tutt') !== 0 }

  // ---------- topcard: name / headline / location ----------
  var h1 = document.querySelector('h1')
  var fullName = (h1 && h1.innerText && h1.innerText.trim()) ? h1.innerText.trim() : null
  if (!fullName) {
    fullName = (document.title || '').split('|')[0].replace(/\\s*\\(\\d+\\)\\s*/, '').trim() || null
  }

  var navNoise = {
    'migliora profilo': 1, 'aggiungi sezione': 1, 'disponibile per': 1, 'più': 1, 'more': 1,
    'aggiungi badge di verifica': 1, 'informazioni di contatto': 1, 'consigliato per te': 1,
    'contact info': 1, 'open to': 1, 'add profile section': 1, 'enhance profile': 1,
  }
  var headline = null
  if (fullName) {
    var ni = lines.indexOf(fullName)
    if (ni >= 0) {
      for (var k = ni + 1; k < Math.min(ni + 9, lines.length); k++) {
        var cand = lines[k]
        if (!cand || cand === fullName) continue
        if (navNoise[cand.toLowerCase()]) continue
        if (cand === '·' || cand.indexOf('Prova Premium') === 0) continue
        if (isLocation(cand)) continue
        if (cand.length < 4 || cand.length > 220) continue
        headline = cand
        break
      }
    }
  }

  var location = null
  for (var t = 0; t < Math.min(lines.length, 40); t++) {
    var ll = lines[t]
    if (isLocation(ll) && ll !== fullName && ll !== headline) { location = ll; break }
  }

  // ---------- about / bio ----------
  function isFooterNoise(text) {
    var t = (text || '').toLowerCase()
    return t.indexOf('linkedin corporation') >= 0 || t.indexOf('seleziona lingua') >= 0
      || t.indexOf('talent solutions') >= 0 || t.indexOf('privacy e condizioni') >= 0
      || t === 'accessibilità' || t === 'accessibility'
  }
  function sanitizeBio(text) {
    if (!text) return null
    var b = text.replace(/[\\u200B-\\u200D\\uFEFF]/g, '').replace(/\\s+/g, ' ').trim()
    if (!b || isFooterNoise(b) || b.length < 2) return null
    return b
  }
  function extractAboutFromDom() {
    var secs = document.querySelectorAll('main section, section')
    for (var i = 0; i < secs.length; i++) {
      var h = secs[i].querySelector('h2, h3')
      var heading = (h && h.innerText) ? h.innerText.trim().toLowerCase() : ''
      if (heading !== 'informazioni' && heading !== 'about') continue
      var cands = [
        secs[i].querySelector('[class*="inline-show-more-text"] span[aria-hidden="true"]'),
        secs[i].querySelector('[class*="inline-show-more-text"]'),
        secs[i].querySelector('.pv-shared-text-with-see-more span[aria-hidden="true"]'),
        secs[i].querySelector('.pv-shared-text-with-see-more'),
      ]
      for (var c = 0; c < cands.length; c++) {
        if (!cands[c]) continue
        var clean = sanitizeBio(cands[c].textContent || cands[c].innerText || '')
        if (clean) return clean
      }
    }
    return null
  }
  var bio = extractAboutFromDom()
  if (!bio) {
    var aboutLines = sectionLines('about').filter(function (l) {
      return notMostra(l) && l !== '… altro' && l !== '…see more'
    })
    if (aboutLines.length) bio = sanitizeBio(aboutLines.join(' '))
  }

  // ---------- experience ----------
  function parseExperience() {
    var L = sectionLines('experience').filter(notMostra)
    var out = []
    var activeCompany = ''
    var i = 0
    while (i < L.length && out.length < 15) {
      var cur = L[i]
      if (i + 1 < L.length && isTypeDuration(L[i + 1]) && !isDate(cur) && !isSkillsSummary(cur)) {
        activeCompany = cur
        i += 2
        if (i < L.length && isLocation(L[i])) i++
        continue
      }
      if (i + 2 < L.length && isDate(L[i + 2]) && !isDate(L[i + 1]) && !isSkillsSummary(L[i + 1]) && !isDate(cur) && !isSkillsSummary(cur)) {
        out.push({ title: cur, company: stripEmploymentType(L[i + 1]), duration: L[i + 2], current: isCurrent(L[i + 2]) })
        activeCompany = ''
        i += 3
        if (i < L.length && isLocation(L[i])) i++
        if (i < L.length && isSkillsSummary(L[i])) i++
        continue
      }
      if (i + 1 < L.length && isDate(L[i + 1]) && !isDate(cur) && !isSkillsSummary(cur)) {
        out.push({ title: cur, company: activeCompany, duration: L[i + 1], current: isCurrent(L[i + 1]) })
        i += 2
        if (i < L.length && isLocation(L[i])) i++
        if (i < L.length && isSkillsSummary(L[i])) i++
        continue
      }
      i++
    }
    return out
  }

  // ---------- education (date-anchored: school/degree are the 2 lines before the date) ----------
  function parseEducation() {
    var L = sectionLines('education').filter(notMostra)
    var out = []
    for (var d = 0; d < L.length && out.length < 8; d++) {
      if (!isDate(L[d])) continue
      var degree = d - 1 >= 0 ? L[d - 1] : ''
      var school = d - 2 >= 0 ? L[d - 2] : ''
      if (isSkillsSummary(school) || isDate(school) || isLocation(school)) school = ''
      if (isSkillsSummary(degree) || isDate(degree)) degree = ''
      if (!school && !degree) continue
      out.push({ school: school || degree, degree: school ? degree : '' })
    }
    // Fallback: no dated entries — pair school/degree two-by-two
    if (!out.length) {
      for (var j = 0; j + 1 < L.length && out.length < 8; j += 2) {
        if (isSkillsSummary(L[j]) || isDate(L[j])) { j -= 1; continue }
        out.push({ school: L[j], degree: L[j + 1] || '' })
      }
    }
    return out
  }

  // ---------- skills (visible + enriched from "e +N competenze" summaries) ----------
  function parseSkills() {
    var seen = {}
    var order = []
    function add(s) {
      var v = (s || '').replace(/^\\s+|\\s+$/g, '')
      if (!v || v.length < 2 || v.length > 60) return
      if (/^\\d+$/.test(v)) return
      var key = v.toLowerCase()
      if (seen[key]) return
      seen[key] = 1
      order.push(v)
    }
    function isSkillNoise(v) {
      var low = v.toLowerCase()
      return v.charAt(0) === '·' || /·\\s*\\d+°/.test(v) || low === 'visualizza' || low === 'view'
        || low === 'collegati' || low === 'connect' || low === 'segui' || low === 'follow'
        || low.indexOf('follower') >= 0 || /^competenze?\\s*\\(\\d+\\)/i.test(v) || /^skills?\\s*\\(\\d+\\)/i.test(v)
    }
    var sk = sectionLines('skills')
    for (var s = 0; s < sk.length; s++) {
      var name = sk[s]
      var ctx = sk[s + 1] || ''
      if (!name || !notMostra(name) || isSkillsSummary(name) || isDate(name) || isSkillNoise(name)) continue
      var lowCtx = ctx.toLowerCase()
      var ctxValid = ctx.indexOf(' presso ') >= 0 || ctx.indexOf(' at ') >= 0
        || lowCtx.indexOf('esperien') >= 0 || ctx.indexOf('Università') >= 0 || ctx.indexOf('University') >= 0
      if (!ctxValid) continue
      if (name.indexOf(' presso ') >= 0 || name.indexOf('Università') >= 0 || name.indexOf('University') >= 0) continue
      add(name)
    }
    // Enrich from the LinkedIn skill-summary marker "A, B e +N competenze".
    // Require the explicit "+N competenze/skills" token: plain prose that merely
    // contains the word "competenza" (post snippets, bios) must NOT be treated as
    // a skill list, or sentence fragments leak in as fake skills.
    var SUMMARY_MARKER = /\\+\\s*\\d+\\s*(?:competenz\\w*|skills?)/i
    for (var a = 0; a < lines.length; a++) {
      var ln = lines[a]
      if (!SUMMARY_MARKER.test(ln)) continue
      var cleaned = ln
        .replace(/\\s*(?:e|and)\\s\\+\\d+\\s*(?:competenz\\w*|skills?)\\s*$/i, '')
        .replace(/\\s*\\+\\d+\\s*(?:competenz\\w*|skills?)\\s*$/i, '')
      if (cleaned === ln) cleaned = cleaned.replace(/\\s+(?:e|and)\\s\\+\\d+.*$/i, '')
      var parts = cleaned.split(',')
      for (var p = 0; p < parts.length; p++) {
        var v = parts[p].replace(/^\\s+|\\s+$/g, '')
        // A real skill is a short noun phrase, not a sentence.
        if (v.length > 45 || v.indexOf('. ') >= 0 || /[.!?]$/.test(v)) continue
        if (!isSkillNoise(v)) add(v)
      }
    }
    return order.slice(0, 40)
  }

  // ---------- certifications ----------
  function parseCertifications() {
    var L = sectionLines('certifications')
    var out = []
    var inEntry = false
    for (var c = 0; c < L.length && out.length < 15; c++) {
      var ln = L[c]
      if (!ln || !notMostra(ln)) continue
      var low = ln.toLowerCase()
      var isMeta = isSkillsSummary(ln) || isDate(ln)
        || low.indexOf('data di rilascio') >= 0 || low.indexOf('emesso') >= 0
        || low.indexOf('issued') >= 0 || low.indexOf('scadenza') >= 0 || low.indexOf('expire') >= 0
        || low.indexOf('credenzial') >= 0 || low.indexOf('credential') >= 0
      if (isMeta) { inEntry = false; continue }
      if (!inEntry) { out.push(ln); inEntry = true }
    }
    return out
  }

  // ---------- projects ----------
  function parseProjects() {
    var L = sectionLines('projects').filter(notMostra)
    var out = []
    var i = 0
    while (i < L.length && out.length < 12) {
      var name = L[i]
      if (!name || isSkillsSummary(name) || isDate(name)) { i++; continue }
      var description = ''
      var j = i + 1
      while (j < L.length && (isDate(L[j]) || isSkillsSummary(L[j]))) j++
      if (j < L.length && !isDate(L[j]) && !isSkillsSummary(L[j])) {
        // A description line tends to be longer prose; only take it if it isn't the next project's title
        if (L[j].length > 40) { description = L[j]; }
      }
      out.push({ name: name, description: description })
      i = j > i ? j : i + 1
    }
    return out
  }

  // ---------- languages ----------
  function parseLanguages() {
    var L = sectionLines('languages').filter(function (l) {
      return notMostra(l) && l.length > 1 && l.length < 40
    })
    // LinkedIn lists: Language / proficiency / Language / proficiency ...
    return L.filter(function (l, idx) { return idx % 2 === 0 }).slice(0, 10)
  }

  function parseVolunteering() {
    return sectionLines('volunteering').filter(function (l) {
      return notMostra(l) && l.length > 2
    }).slice(0, 8)
  }

  return {
    platform: 'linkedin',
    fullName: fullName,
    headline: headline,
    location: location,
    bio: bio,
    experiences: parseExperience(),
    education: parseEducation(),
    skills: parseSkills(),
    projects: parseProjects(),
    languages: parseLanguages(),
    certifications: parseCertifications(),
    volunteering: parseVolunteering(),
    activity: [],
  }
})()`

export const LINKEDIN_ACTIVITY_SCRIPT = `(() => {
  var profileName = document.title.split('|')[0].replace(/\\s+/g, ' ').trim().split('(')[0].trim()
  var actors = document.querySelectorAll('.update-components-actor__title')
  var contents = document.querySelectorAll('span[dir="ltr"]')
  var activity = []
  var usedContents = {}

  for (var a = 0; a < actors.length && activity.length < 8; a++) {
    var actorName = actors[a].innerText.split('\\n')[0].trim()
    var actorRect = actors[a].getBoundingClientRect()
    var bestContent = null
    var bestDist = Infinity

    for (var c = 0; c < contents.length; c++) {
      if (usedContents[c]) continue
      var t = contents[c].innerText.trim()
      if (t.length < 30 || t.includes('Accetta') || t.includes('cookie')) continue
      var cRect = contents[c].getBoundingClientRect()
      var dist = cRect.top - actorRect.top
      if (dist > 0 && dist < bestDist) { bestDist = dist; bestContent = { index: c, text: t } }
    }

    if (bestContent) {
      usedContents[bestContent.index] = true
      var cleanContent = bestContent.text.replace(/\\n/g, ' ').replace(/\\s+/g, ' ').trim()
      if (cleanContent.length < 50) continue
      var normActor = actorName.replace(/\\s+/g, ' ').trim()
      var isOwnPost = normActor === profileName || profileName.includes(normActor) || normActor.includes(profileName)
      activity.push({
        type: isOwnPost ? 'post' : 'repost',
        content: bestContent.text.substring(0, 500),
        originalAuthor: isOwnPost ? null : actorName
      })
    }
  }

  return activity
})()`

export const GITHUB_SCRIPT = `(() => {
  var text = function(sel) { var el = document.querySelector(sel); return el ? el.textContent.trim() : null }
  var username = text('.p-nickname')
  var fullName = text('.p-name')
  var bio = text('.p-note .user-profile-bio') || text('[data-bio-text]')
  var location = text('.p-label')
  var company = text('.p-org')
  var followersText = (document.querySelector('a[href$="tab=followers"] span') || {}).textContent || '0'
  var followingText = (document.querySelector('a[href$="tab=following"] span') || {}).textContent || '0'
  var followers = parseInt(followersText.replace(/\\D/g, '')) || null
  var following = parseInt(followingText.replace(/\\D/g, '')) || null
  var pinnedRepos = Array.from(document.querySelectorAll('.pinned-item-list-item .repo')).map(function(el) { return el.textContent.trim() }).filter(Boolean)
  var repoCards = document.querySelectorAll('.pinned-item-list-item')
  var repoUrlsSeen = {}
  var repositories = Array.from(repoCards).map(function(card) {
    var url = card.querySelector('a.text-bold') ? card.querySelector('a.text-bold').href.split('?')[0] : ''
    if (url) repoUrlsSeen[url] = true
    return {
      name: card.querySelector('.repo') ? card.querySelector('.repo').textContent.trim() : '',
      description: card.querySelector('.pinned-item-desc') ? card.querySelector('.pinned-item-desc').textContent.trim() : '',
      language: card.querySelector('[itemprop="programmingLanguage"]') ? card.querySelector('[itemprop="programmingLanguage"]').textContent.trim() : '',
      stars: parseInt((card.querySelector('a[href*="stargazers"]') || {}).textContent || '0') || 0,
      forks: parseInt((card.querySelector('a[href*="forks"]') || {}).textContent || '0') || 0,
      url: url
    }
  })

  var maxRepos = 18
  var skipNames = { projects: 1, packages: 1, sponsoring: 1, followers: 1, following: 1, stars: 1 }
  if (username && repositories.length < maxRepos) {
    var prefix = '/' + username + '/'
    document.querySelectorAll('a[href^="' + prefix + '"]').forEach(function(a) {
      if (repositories.length >= maxRepos) return
      var path = (a.getAttribute('href') || '').split('?')[0].replace(/\\/$/, '')
      var parts = path.split('/').filter(Boolean)
      if (parts.length !== 2 || parts[0] !== username) return
      var repoName = parts[1]
      if (!repoName || skipNames[repoName]) return
      var fullUrl = 'https://github.com' + path
      if (repoUrlsSeen[fullUrl]) return
      repoUrlsSeen[fullUrl] = true
      repositories.push({
        name: repoName,
        description: '',
        language: '',
        stars: 0,
        forks: 0,
        url: fullUrl
      })
    })
  }

  return { platform: 'github', username: username, fullName: fullName, bio: bio, location: location, company: company, followers: followers, following: following, repositories: repositories, pinnedRepos: pinnedRepos }
})()`

/** Run on https://github.com/owner/repo (code tab) — README + contributori in sidebar. */
export const GITHUB_REPO_DETAIL_SCRIPT = `(() => {
  function trimPreview(s, max) {
    if (!s) return null
    var t = s.replace(/\\s+/g, ' ').trim()
    return t.length > max ? t.substring(0, max) + '…' : t
  }
  var readmeEl =
    document.querySelector('article.markdown-body')
    || document.querySelector('#readme article.markdown-body')
    || document.querySelector('#readme .markdown-body')
    || document.querySelector('[itemprop="text"]')
  var readmePreview = readmeEl ? trimPreview(readmeEl.innerText, 5000) : null

  var contributors = []
  var seen = {}
  var sidebar = document.querySelector('.Layout-sidebar') || document.querySelector('aside')
  var scope = sidebar || document.body
  scope.querySelectorAll('a[data-hovercard-type="user"]').forEach(function(a) {
    var href = (a.getAttribute('href') || '').split('?')[0]
    var m = href.match(/^\\/([^\\/]+)\\/?$/)
    if (!m) return
    var login = m[1]
    if (!login || seen[login]) return
    seen[login] = true
    contributors.push({ login: login, profileUrl: 'https://github.com/' + login })
  })
  return { readmePreview: readmePreview, contributors: contributors }
})()`

/** Run on /owner/repo/graphs/contributors when sidebar list is empty. */
export const GITHUB_CONTRIBUTORS_GRAPH_SCRIPT = `(() => {
  var contributors = []
  var seen = {}
  var nodes = document.querySelectorAll('a[data-hovercard-type="user"]')
  for (var i = 0; i < nodes.length && contributors.length < 30; i++) {
    var a = nodes[i]
    var href = (a.getAttribute('href') || '').split('?')[0]
    var m = href.match(/^\\/([^\\/]+)\\/?$/)
    if (!m) continue
    var login = m[1]
    if (!login || seen[login]) continue
    seen[login] = true
    contributors.push({ login: login, profileUrl: 'https://github.com/' + login })
  }
  return { contributors: contributors }
})()`

export const SCROLL_SCRIPT = `(async () => {
  function maxScrollY() {
    var b = document.body
    var e = document.documentElement
    return Math.max(b ? b.scrollHeight : 0, e ? e.scrollHeight : 0, window.innerHeight || 0)
  }
  // Aggressive full-page scroll to trigger lazy loading of all sections
  for (var i = 0; i < 30; i++) {
    var y = maxScrollY()
    window.scrollTo(0, y > 0 ? y : window.scrollY + 800)
    await new Promise(function(r) { setTimeout(r, 600) })
  }
  window.scrollTo(0, 0)
  await new Promise(function(r) { setTimeout(r, 1000) })
})()`

export const SCROLL_SHORT_SCRIPT = `(async () => {
  for (var i = 0; i < 3; i++) {
    window.scrollBy(0, 800)
    await new Promise(function(r) { setTimeout(r, 300) })
  }
})()`
