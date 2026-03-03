const app = document.getElementById("app");

if (app) {
  app.insertAdjacentHTML(
    "beforeend",
    "<p>main.js loaded. Ready to build.</p>"
  );
}
