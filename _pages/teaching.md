---
layout: page
title: Teaching
permalink: /teaching/
description: Formal teaching and mentoring.
eyebrow: Teaching
---

<section class="teaching-list">
  {% for entry in site.data.teaching %}
  {% assign entry_url = entry.url %}
  {% if entry_url contains '://' %}
    {% assign entry_href = entry_url %}
  {% else %}
    {% assign entry_href = entry_url | relative_url %}
  {% endif %}
  <article class="teaching-item">
    <div class="teaching-item__top">
      <h2>
        {% if entry.url %}
          <a href="{{ entry_href }}">{{ entry.course }}</a>
        {% else %}
          {{ entry.course }}
        {% endif %}
      </h2>
      <div class="teaching-item__person">{{ entry.role | default: entry.instructor }}</div>
    </div>
    <div class="teaching-item__bottom">
      <div class="teaching-item__meta">{{ entry.term }} · {{ entry.institution }}</div>
      {% if entry.url %}
        <a class="teaching-item__link link-arrow" href="{{ entry_href }}">Course page</a>
      {% endif %}
    </div>
  </article>
  {% endfor %}
</section>
