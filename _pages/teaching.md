---
layout: page
title: Teaching
permalink: /teaching/
description: Formal teaching and mentoring.
eyebrow: Teaching
---

<section class="teaching-list">
  {% for entry in site.data.teaching %}
  <article class="teaching-item">
    <div class="teaching-item__top">
      <h2>
        {% if entry.url %}
          <a href="{{ entry.url | relative_url }}">{{ entry.course }}</a>
        {% else %}
          {{ entry.course }}
        {% endif %}
      </h2>
      <div class="teaching-item__person">{{ entry.instructor | default: entry.role }}</div>
    </div>
    <div class="teaching-item__bottom">
      <div class="teaching-item__meta">{{ entry.term }} · {{ entry.institution }}</div>
      {% if entry.url %}
        <a class="teaching-item__link link-arrow" href="{{ entry.url | relative_url }}">Course page</a>
      {% endif %}
    </div>
  </article>
  {% endfor %}
</section>
