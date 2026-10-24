(() => {
  "use strict";

  const CATEGORIES = ["History", "Automotive", "Real Estate", "Electronics", "Books", "News", "Science & Tech"];
  const FREQUENT = ["iPhone 16", "World War II", "Tesla Model 3", "Atomic Habits"];
  const FEATURED_LIMIT = 8;

  const $ = id => document.getElementById(id);
  const hero = $("hero"), results = $("results"), input = $("q"), list = $("list"), sum = $("sum");
  const featuredList = $("featured-list");

  let category = null;
  let query = "";
  let controller = null;

  const esc = value => String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));

  function safeHref(value) {
    try {
      const url = new URL(value);
      return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch {
      return null;
    }
  }

  function renderCategories() {
    $("cats").innerHTML = ["All", ...CATEGORIES].map(name => {
      const selected = name === "All" ? category === null : name === category;
      return `<button class="chip" type="button" data-c="${esc(name)}" aria-pressed="${selected}">${esc(name)}</button>`;
    }).join("");
  }

  function renderTags() {
    $("tags").innerHTML = FREQUENT.map(term =>
      `<button class="tag" type="button" data-q="${esc(term)}">${esc(term)}</button>`
    ).join("");
  }

  function createCard(item) {
    const sourceUrl = safeHref(item.url);
    if (!sourceUrl) return null;

    const card = document.createElement("article");
    card.className = "card";

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = item.source;

    const title = document.createElement("a");
    title.className = "ct";
    title.href = sourceUrl;
    title.target = "_blank";
    title.rel = "noopener noreferrer";
    title.textContent = item.title;

    const description = document.createElement("p");
    description.className = "cs";
    description.textContent = item.description;

    const links = document.createElement("div");
    links.className = "card-links";

    const open = document.createElement("a");
    open.className = "open";
    open.href = sourceUrl;
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    open.textContent = "Open Source ↗";

    const wikipediaUrl = new URL("https://en.wikipedia.org/w/index.php");
    wikipediaUrl.searchParams.set("search", item.title);
    const wikipedia = document.createElement("a");
    wikipedia.className = "wiki";
    wikipedia.href = wikipediaUrl.href;
    wikipedia.target = "_blank";
    wikipedia.rel = "noopener noreferrer";
    wikipedia.textContent = "Wikipedia ↗";

    links.append(open, wikipedia);
    card.append(badge, title, description, links);
    return card;
  }

  function renderCards(container, items) {
    const cards = items.map(createCard).filter(Boolean);
    container.replaceChildren(...cards);
    return cards.length;
  }

  function renderState(container, title, message, error = false) {
    const state = document.createElement("div");
    state.className = error ? "state err" : "state";
    const heading = document.createElement("h3");
    heading.textContent = title;
    const detail = document.createElement("p");
    detail.textContent = message;
    state.append(heading, detail);
    container.replaceChildren(state);
  }

  async function fetchResults(params, signal) {
    const response = await fetch(`/api/search?${params}`, {
      signal,
      headers: { Accept: "application/json" }
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("The search service returned an invalid response.");
    }

    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    if (!data || !Array.isArray(data.results)) throw new Error("The search service returned invalid results.");
    return data.results;
  }

  async function loadFeatured() {
    const params = new URLSearchParams({ limit: String(FEATURED_LIMIT) });
    try {
      const items = await fetchResults(params);
      if (!renderCards(featuredList, items)) {
        renderState(featuredList, "No sources available", "Please check back later.");
      }
    } catch {
      renderState(featuredList, "Sources are unavailable", "Try again in a moment.", true);
      const retry = document.createElement("button");
      retry.className = "retry";
      retry.type = "button";
      retry.textContent = "Retry";
      retry.addEventListener("click", loadFeatured, { once: true });
      featuredList.firstElementChild.append(retry);
    }
  }

  function showHero() {
    if (controller) controller.abort();
    results.classList.remove("active");
    hero.classList.add("active");
    input.value = "";
    query = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
    input.focus();
  }

  function showLoading() {
    hero.classList.remove("active");
    results.classList.add("active");
    sum.textContent = "Searching…";
    list.innerHTML = Array.from({ length: 4 }, () => '<div class="skel" aria-hidden="true"></div>').join("");
  }

  function renderError(message) {
    sum.textContent = "";
    list.replaceChildren();
    renderState(list, "Something went wrong", message, true);
    const retry = document.createElement("button");
    retry.className = "retry";
    retry.id = "retry";
    retry.type = "button";
    retry.textContent = "Try again";
    list.firstElementChild.append(retry);
  }

  function renderResults(items) {
    const visibleItems = items.filter(item =>
      item && typeof item.title === "string" && typeof item.source === "string" &&
      typeof item.description === "string" && safeHref(item.url)
    );
    const label = query ? ` for “<strong>${esc(query)}</strong>”` : "";
    const scope = category ? ` in <strong>${esc(category)}</strong>` : "";
    sum.innerHTML = `<strong>${visibleItems.length}</strong> result${visibleItems.length === 1 ? "" : "s"}${label}${scope}`;

    if (!visibleItems.length) {
      renderState(list, "No results found", `Try a different keyword${category ? " or choose another category" : ""}.`);
      return;
    }
    renderCards(list, visibleItems);
  }

  async function search(term) {
    query = term;
    showLoading();
    if (controller) controller.abort();
    controller = new AbortController();

    const params = new URLSearchParams();
    if (term) params.set("q", term);
    if (category) params.set("category", category);

    try {
      renderResults(await fetchResults(params, controller.signal));
    } catch (error) {
      if (error.name === "AbortError") return;
      renderError(error.message || "Network error. Check your connection and try again.");
    }
  }

  function runFromInput() {
    const term = input.value.trim();
    if (!term && category === null) {
      input.focus();
      return;
    }
    search(term);
  }

  input.addEventListener("keydown", event => {
    if (event.key === "Enter") runFromInput();
  });

  $("tags").addEventListener("click", event => {
    const tag = event.target.closest(".tag");
    if (!tag) return;
    input.value = tag.dataset.q;
    search(tag.dataset.q);
  });

  $("cats").addEventListener("click", event => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    category = chip.dataset.c === "All" ? null : chip.dataset.c;
    renderCategories();
    if (results.classList.contains("active")) search(query);
    else if (input.value.trim()) search(input.value.trim());
    else if (category) search("");
    else input.focus();
  });

  list.addEventListener("click", event => {
    if (event.target.id === "retry") search(query);
  });

  $("back").addEventListener("click", showHero);
  $("logo").addEventListener("click", event => {
    event.preventDefault();
    showHero();
  });

  $("year").textContent = new Date().getFullYear();
  renderCategories();
  renderTags();
  loadFeatured();
})();
