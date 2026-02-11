---
layout: page
title: Projects
permalink: /projects/
description: Software, datasets, and experiments.
---

{% for project in site.data.projects %}
### {{ project.name }}
{{ project.description }}

**Status:** {{ project.status }}

{% if project.links %}
Links:
{% for link in project.links %}
- [{{ link.label }}]({{ link.url }})
{% endfor %}
{% endif %}

---
{% endfor %}
