(() => {
  "use strict";

  const CATEGORIES = ["History", "Automotive", "Real Estate", "Electronics", "Books", "News", "Science & Tech"];
  const FREQUENT = ["iPhone 16", "World War II", "Tesla Model 3", "Atomic Habits"];
  const FEATURED_LIMIT = 8;
  const PAGE_SIZE = 60;

  const $ = id => document.getElementById(id);
  const hero = $("hero"), results = $("results"), input = $("q"), list = $("list"), sum = $("sum");
  const featuredList = $("featured-list"), loadMoreButton = $("load-more");

  let category = null;
  let query = "";
  let controller = null;
  let loadedCount = 0;
  let totalCount = 0;

  const esc = value => String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));

  function safeHref(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
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

    const wikipediaUrl = safeHref(item.wikipediaUrl);
    if (!wikipediaUrl) return null;
    const wikipedia = document.createElement("a");
    wikipedia.className = "wiki";
    wikipedia.href = wikipediaUrl;
    wikipedia.target = "_blank";
    wikipedia.rel = "noopener noreferrer";
    wikipedia.textContent = "Wikipedia ↗";

    links.append(open, wikipedia);
    card.append(badge, title, description, links);
    return card;
  }

  function renderCards(container, items, append = false) {
    const cards = items.map(createCard).filter(Boolean);
    if (append) container.append(...cards);
    else container.replaceChildren(...cards);
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
      ...(signal ? { signal } : {}),
      headers: { Accept: "application/json" }
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("The search service returned an invalid response.");
    }

    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    if (!data || !Array.isArray(data.results) || !Number.isSafeInteger(data.total) ||
        !Number.isSafeInteger(data.offset) || !Number.isSafeInteger(data.limit) ||
        data.total < 0 || data.offset < 0 || data.limit < 1 ||
        data.results.length > data.limit || data.offset + data.results.length > data.total) {
      throw new Error("The search service returned invalid results.");
    }
    return data;
  }

  async function loadFeatured() {
    const params = new URLSearchParams({ limit: String(FEATURED_LIMIT) });
    try {
      const data = await fetchResults(params);
      if (!renderCards(featuredList, data.results)) {
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
    loadMoreButton.hidden = true;
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

  function renderResults(data, append = false) {
    const visibleItems = data.results.filter(item =>
      item && typeof item.title === "string" && typeof item.source === "string" &&
      typeof item.description === "string" && safeHref(item.url) && safeHref(item.wikipediaUrl)
    );
    const label = query ? ` for “<strong>${esc(query)}</strong>”` : "";
    const scope = category ? ` in <strong>${esc(category)}</strong>` : "";
    loadedCount = data.offset + visibleItems.length;
    totalCount = data.total;
    const noun = totalCount === 1 ? "result" : "results";
    sum.innerHTML = `Showing <strong>${loadedCount}</strong> of <strong>${totalCount}</strong> ${noun}${label}${scope}`;

    if (!visibleItems.length && !append) {
      renderState(list, "No results found", `Try a different keyword${category ? " or choose another category" : ""}.`);
    } else {
      renderCards(list, visibleItems, append);
    }
    loadMoreButton.hidden = loadedCount >= totalCount;
    loadMoreButton.disabled = false;
    loadMoreButton.textContent = "Load more results";
  }

  async function search(term) {
    query = term;
    showLoading();
    if (controller) controller.abort();
    controller = new AbortController();
    loadedCount = 0;
    totalCount = 0;

    const params = new URLSearchParams();
    if (term) params.set("q", term);
    if (category) params.set("category", category);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", "0");

    try {
      const data = await fetchResults(params, controller.signal);
      renderResults(data);
    } catch (error) {
      if (error.name === "AbortError") return;
      renderError(error.message || "Network error. Check your connection and try again.");
    }
  }

  async function loadMore() {
    if (loadMoreButton.disabled || loadedCount >= totalCount || !controller) return;
    loadMoreButton.disabled = true;
    loadMoreButton.textContent = "Loading…";

    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(loadedCount));

    try {
      const data = await fetchResults(params, controller.signal);
      if (data.offset !== loadedCount) throw new Error("The search service returned an unexpected page.");
      renderResults(data, true);
    } catch (error) {
      if (error.name === "AbortError") return;
      loadMoreButton.disabled = false;
      loadMoreButton.textContent = `${error.message || "Could not load more."} Retry`;
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

  $("browse-all").addEventListener("click", () => {
    category = null;
    renderCategories();
    search("");
  });
  loadMoreButton.addEventListener("click", loadMore);

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
