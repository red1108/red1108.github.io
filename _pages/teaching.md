---
layout: page
title: Teaching
permalink: /teaching/
description: Courses taught and materials.
---

<table class="responsive-table">
  <thead>
    <tr>
      <th>Term</th>
      <th>Course</th>
      <th>Institution</th>
      <th>Role</th>
      <th>Materials</th>
    </tr>
  </thead>
  <tbody>
    {% for entry in site.data.teaching %}
      <tr>
        <td data-label="Term">{{ entry.term }}</td>
        <td data-label="Course">{{ entry.course }}</td>
        <td data-label="Institution">{{ entry.institution }}</td>
        <td data-label="Role">{{ entry.role }}</td>
        <td data-label="Materials"><a href="{{ entry.materials }}">Resources</a></td>
      </tr>
    {% endfor %}
  </tbody>
</table>
