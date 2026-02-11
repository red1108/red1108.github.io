---
layout: page
title: News
permalink: /news/
description: Timeline of highlights and announcements.
---

{% for item in site.data.news %}
### {{ item.date | date: '%B %d, %Y' }}
{{ item.title }}

---
{% endfor %}
