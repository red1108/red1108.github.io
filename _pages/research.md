---
layout: page
title: Research
permalink: /research/
description: Research papers, talks, and posters.
eyebrow: Research
---

<section class="research-section" id="papers" aria-labelledby="papers-heading">
  <h2 id="papers-heading">Papers</h2>
{% bibliography --template bibliography %}
</section>

<section class="research-section" id="talks" aria-labelledby="talks-heading">
  <h2 id="talks-heading">Talks</h2>
  {% assign talk_sections = site.data.cv.sections | where: 'title', 'Contributed Talks' %}
  {% assign invited_sections = site.data.cv.sections | where: 'title', 'Invited Talks' %}
  {% for section in talk_sections %}
    {% for item in section.items %}
      <div class="talk"><div class="talk__date">{{ item.period }}</div><div class="talk__body"><strong>{{ item.role }}</strong>. <em>{{ item.institution }}</em>.{% if item.details %}<p>{{ item.details | join: ' ' }}</p>{% endif %}</div></div>
    {% endfor %}
  {% endfor %}
  {% for section in invited_sections %}
    {% for item in section.items %}
      <div class="talk"><div class="talk__date">{{ item.period }}</div><div class="talk__body"><strong>{{ item.role }}</strong>. <em>{{ item.institution }}</em>.{% if item.details %}<p>{{ item.details | join: ' ' }}</p>{% endif %}</div></div>
    {% endfor %}
  {% endfor %}
</section>

<section class="research-section" id="posters" aria-labelledby="posters-heading">
  <h2 id="posters-heading">Posters</h2>
  {% assign poster_sections = site.data.cv.sections | where: 'title', 'Poster Presentations' %}
  {% for section in poster_sections %}
    {% for item in section.items %}
      <div class="talk"><div class="talk__date">{{ item.period }}</div><div class="talk__body"><strong>{{ item.role }}</strong>. <em>{{ item.institution }}</em>.{% if item.details %}<p>{{ item.details | join: ' ' }}</p>{% endif %}</div></div>
    {% endfor %}
  {% endfor %}
</section>
