---
layout: page
title: Teaching
permalink: /teaching/
description: Courses taught and materials.
---

| Term | Course | Institution | Role | Materials |
| --- | --- | --- | --- | --- |
{% for entry in site.data.teaching %}
| {{ entry.term }} | {{ entry.course }} | {{ entry.institution }} | {{ entry.role }} | [Resources]({{ entry.materials }}) |
{% endfor %}
