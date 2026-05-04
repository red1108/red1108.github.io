---
layout: page
title: Publications
permalink: /publications/
description: Peer-reviewed, contributed, invited.
eyebrow: Publications
---

<nav class="pubs-toc">
  <a href="#peer-reviewed">Peer-reviewed</a>
  <a href="#talks">Talks</a>
  <a href="#posters">Posters</a>
</nav>

<section class="pubs-section" id="peer-reviewed">
  <h2>Peer-reviewed articles</h2>
{% bibliography --template bibliography %}
</section>

<section class="pubs-section" id="talks">
  <h2>Contributed and invited talks</h2>
  {% assign talk_sections = site.data.cv.sections | where: 'title', 'Contributed Talks' %}
  {% assign invited_sections = site.data.cv.sections | where: 'title', 'Invited Talks' %}
  {% for section in talk_sections %}
    {% for item in section.items %}
      <div class="talk"><div class="talk__date">{{ item.period }}</div><div class="talk__body"><strong>{{ item.role }}</strong>. <em>{{ item.institution }}</em>.</div></div>
    {% endfor %}
  {% endfor %}
  {% for section in invited_sections %}
    {% for item in section.items %}
      <div class="talk"><div class="talk__date">{{ item.period }}</div><div class="talk__body"><strong>{{ item.role }}</strong>. <em>{{ item.institution }}</em>.</div></div>
    {% endfor %}
  {% endfor %}
</section>

<section class="pubs-section" id="posters">
  <h2>Posters</h2>
  {% assign poster_sections = site.data.cv.sections | where: 'title', 'Poster Presentations' %}
  {% for section in poster_sections %}
    {% for item in section.items %}
      <div class="talk"><div class="talk__date">{{ item.period }}</div><div class="talk__body"><strong>{{ item.role }}</strong>. <em>{{ item.institution }}</em>.</div></div>
    {% endfor %}
  {% endfor %}
</section>
