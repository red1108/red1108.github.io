---
layout: page
title: News
permalink: /news/
description: Timeline of highlights and announcements.
eyebrow: Recent
---

<ul class="updates">
{% for item in site.data.news %}
  <li class="update">
    <span class="update__date">{{ item.date | date: '%Y · %m' }}</span>
    <span class="update__body">{{ item.title }}</span>
  </li>
{% endfor %}
</ul>
