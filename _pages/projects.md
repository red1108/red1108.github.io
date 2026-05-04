---
layout: page
title: Projects
permalink: /projects/
eyebrow: Projects
---

<section class="project-list">
  {% for project in site.data.projects %}
  <article class="proj-row">
    <div class="proj-row__year">{{ project.year }}<span class="status">{{ project.status }}</span></div>
    <div class="proj-row__main">
      <h3><a href="{{ project.url | relative_url }}">{{ project.name }}</a></h3>
      <p>{{ project.description }}</p>
      {% if project.tags %}
      <div class="tags">
        {% for tag in project.tags %}
          <span class="tag">{{ tag }}</span>
        {% endfor %}
      </div>
      {% endif %}
    </div>
    <div class="proj-row__type">{{ project.type }}</div>
  </article>
  {% endfor %}
</section>
