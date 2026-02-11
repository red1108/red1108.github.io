document.addEventListener("DOMContentLoaded", () => {
  const cards = Array.from(document.querySelectorAll("[data-share-card]"));
  const tagSelect = document.getElementById("shares-tag-filter");
  const categorySelect = document.getElementById("shares-category-filter");
  const viewToggle = document.getElementById("shares-view-toggle");

  function applyFilter() {
    const tagValue = tagSelect?.value || "all";
    const categoryValue = categorySelect?.value || "all";
    cards.forEach((card) => {
      const tags = card.dataset.tags?.split(",") || [];
      const category = card.dataset.category || "";
      const tagMatch = tagValue === "all" || tags.includes(tagValue);
      const categoryMatch = categoryValue === "all" || category === categoryValue;
      card.hidden = !(tagMatch && categoryMatch);
    });
  }

  tagSelect?.addEventListener("change", applyFilter);
  categorySelect?.addEventListener("change", applyFilter);
  applyFilter();

  viewToggle?.addEventListener("click", () => {
    const container = document.querySelector(".shares-grid");
    if (!container) return;
    const mode = container.dataset.view === "cards" ? "list" : "cards";
    container.dataset.view = mode;
    viewToggle.textContent = mode === "cards" ? "List view" : "Card view";
  });
});
