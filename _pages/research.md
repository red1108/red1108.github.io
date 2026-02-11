---
layout: page
title: Research
permalink: /research/
description: Active research thrusts and focus areas.
---

{% for research in site.data.research %}
### {{ research.title }}
{{ research.summary }}

**Keywords:** {{ research.interests | join: ', ' }}

---
{% endfor %}
