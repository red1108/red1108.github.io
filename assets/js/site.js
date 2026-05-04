document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("details.section--collapsible").forEach((details) => {
    const body = details.querySelector(".section__body");
    const summary = details.querySelector("summary");
    if (!body || !summary) return;

    summary.addEventListener("click", (event) => {
      event.preventDefault();
      if (details.open) {
        const startHeight = body.scrollHeight;
        body.style.height = `${startHeight}px`;
        requestAnimationFrame(() => {
          body.style.transition = "height 280ms cubic-bezier(0.22,0.8,0.36,1), opacity 200ms ease";
          body.style.opacity = "0";
          body.style.height = "0px";
        });
        body.addEventListener("transitionend", function onEnd(ev) {
          if (ev.propertyName !== "height") return;
          details.open = false;
          body.style.transition = "";
          body.style.height = "";
          body.style.opacity = "";
          body.removeEventListener("transitionend", onEnd);
        });
      } else {
        details.open = true;
        const targetHeight = body.scrollHeight;
        body.style.height = "0px";
        body.style.opacity = "0";
        requestAnimationFrame(() => {
          body.style.transition = "height 320ms cubic-bezier(0.22,0.8,0.36,1), opacity 260ms ease 60ms";
          body.style.height = `${targetHeight}px`;
          body.style.opacity = "1";
        });
        body.addEventListener("transitionend", function onEnd(ev) {
          if (ev.propertyName !== "height") return;
          body.style.transition = "";
          body.style.height = "";
          body.style.opacity = "";
          body.removeEventListener("transitionend", onEnd);
        });
      }
    });
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        if (registration.scope.startsWith(`${window.location.origin}/`)) {
          registration.unregister();
        }
      });
    });
  }
});
