(function redirectScheduledFlow() {
  const params = new URLSearchParams(window.location.search);
  params.set("mode", "scheduled");
  const target = `emergency.html?${params.toString()}`;

  const fallbackLink = document.getElementById("scheduleFallbackLink");
  if (fallbackLink) {
    fallbackLink.href = target;
    fallbackLink.textContent = target;
  }

  window.location.replace(target);
})();
