---
layout: page
title: Projects
permalink: /projects/
description: Software, datasets, and experiments.
---

<section class="project-board">
  <p>Interactive research builds spanning quantum machine learning, ETF research systems, and live quant dashboards.</p>
  <div class="card-grid project-grid">
    {% for project in site.data.projects %}
      {% assign primary_link = project.url | default: project.links[0].url | default: '#' %}
      <a class="project-card" href="{{ primary_link | relative_url }}">
        <div class="project-card-status">{{ project.status }}</div>
        <h3>{{ project.name }}</h3>
        <p>{{ project.description }}</p>
        {% if project.tags %}
        <div class="chips">
          {% for tag in project.tags %}
            <span class="chip">{{ tag }}</span>
          {% endfor %}
        </div>
        {% endif %}
        {% if project.links %}
        <div class="project-card-links">
          {% for link in project.links %}
            <span>{{ link.label }}</span>
          {% endfor %}
        </div>
        {% endif %}
      </a>
    {% endfor %}
  </div>
</section>
