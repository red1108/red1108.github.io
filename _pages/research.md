---
layout: page
title: Research
permalink: /research/
description: The longer version of each thread.
eyebrow: Research
---

<section class="thread-list">
{% for research in site.data.research %}
<article class="thread">
  <div class="thread__id"><span class="num">{{ forloop.index | prepend: '0' | slice: -2, 2 }}</span>{{ research.interests | first }}</div>
  <div>
    <h2>{{ research.title }}</h2>
    <div class="body">
      <p>{{ research.summary }}</p>
    </div>
    {% if research.interests %}
    <dl class="related">
      <dt>Keywords</dt>
      <dd>{{ research.interests | join: ' · ' }}</dd>
    </dl>
    {% endif %}
  </div>
</article>
{% endfor %}
</section>
