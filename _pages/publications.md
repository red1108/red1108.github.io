---
layout: null
title: Research
permalink: /publications/
sitemap: false
---
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex, follow">
  <meta http-equiv="refresh" content="0; url={{ '/research/' | relative_url }}">
  <link rel="canonical" href="{{ '/research/' | absolute_url }}">
  <title>Research | {{ site.title | escape }}</title>
</head>
<body>
  <p><a href="{{ '/research/' | relative_url }}">Continue to Research</a></p>
  <script>
    var section = window.location.hash;
    if (section === '#preprints' || section === '#peer-reviewed') section = '#papers';
    window.location.replace({{ '/research/' | relative_url | jsonify }} + section);
  </script>
</body>
</html>
