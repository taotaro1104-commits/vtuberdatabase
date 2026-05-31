const database = window.VTUBER_DATABASE || { vtubers: [], agencies: [], generated_at: "" };
const state = {
  search: "",
  agency: "all",
  language: "all",
  source: "all",
  agencyOnly: false,
  verifiedOnly: false,
};

const elements = {
  generatedAt: document.querySelector("#generatedAt"),
  totalCount: document.querySelector("#totalCount"),
  statTotal: document.querySelector("#statTotal"),
  statAgency: document.querySelector("#statAgency"),
  statOfficial: document.querySelector("#statOfficial"),
  statReview: document.querySelector("#statReview"),
  searchInput: document.querySelector("#searchInput"),
  agencySelect: document.querySelector("#agencySelect"),
  languageSelect: document.querySelector("#languageSelect"),
  sourceSelect: document.querySelector("#sourceSelect"),
  agencyOnly: document.querySelector("#agencyOnly"),
  verifiedOnly: document.querySelector("#verifiedOnly"),
  agencyCount: document.querySelector("#agencyCount"),
  agencyList: document.querySelector("#agencyList"),
  resultCount: document.querySelector("#resultCount"),
  resultList: document.querySelector("#resultList"),
  template: document.querySelector("#vtuberTemplate"),
};

function normalize(value) {
  return String(value || "").toLowerCase();
}

function formatNumber(value) {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function initials(vtuber) {
  const source = vtuber.name_en || vtuber.name || "?";
  const parts = source.replace(/[^\p{L}\p{N}\s]/gu, "").trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2)).toUpperCase();
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja"));
}

function fillSelect(select, values, allLabel) {
  select.innerHTML = "";
  select.append(new Option(allLabel, "all"));
  values.forEach((value) => select.append(new Option(value, value)));
}

function setup() {
  const vtubers = database.vtubers;
  const params = new URLSearchParams(window.location.search);
  state.search = params.get("q") || "";
  elements.generatedAt.textContent = `Generated ${database.generated_at || "-"}`;
  elements.totalCount.textContent = `${formatNumber(vtubers.length)} records`;
  elements.statTotal.textContent = formatNumber(vtubers.length);
  elements.statAgency.textContent = formatNumber(vtubers.filter((item) => item.agency_name).length);
  elements.statOfficial.textContent = formatNumber(vtubers.filter((item) => item.source_type === "公式").length);
  elements.statReview.textContent = formatNumber(vtubers.filter((item) => item.needs_review).length);

  fillSelect(elements.agencySelect, uniqueSorted(vtubers.map((item) => item.agency_name)), "すべて");
  fillSelect(elements.languageSelect, uniqueSorted(vtubers.map((item) => item.language)), "すべて");
  fillSelect(elements.sourceSelect, uniqueSorted(vtubers.map((item) => item.source_type)), "すべて");
  elements.searchInput.value = state.search;

  elements.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    render();
  });
  elements.agencySelect.addEventListener("change", (event) => {
    state.agency = event.target.value;
    render();
  });
  elements.languageSelect.addEventListener("change", (event) => {
    state.language = event.target.value;
    render();
  });
  elements.sourceSelect.addEventListener("change", (event) => {
    state.source = event.target.value;
    render();
  });
  elements.agencyOnly.addEventListener("change", (event) => {
    state.agencyOnly = event.target.checked;
    render();
  });
  elements.verifiedOnly.addEventListener("change", (event) => {
    state.verifiedOnly = event.target.checked;
    render();
  });

  renderAgencyList();
  render();
}

function matchesSearch(vtuber) {
  const query = normalize(state.search).trim();
  if (!query) return true;
  const haystack = normalize([
    vtuber.name,
    vtuber.name_kana,
    vtuber.name_en,
    vtuber.slug,
    vtuber.agency_name,
    vtuber.group_name,
    vtuber.generation,
    vtuber.language,
    vtuber.description,
    vtuber.source_url,
    ...(vtuber.tags || []),
    ...(vtuber.accounts || []).flatMap((account) => [
      account.platform,
      account.account_name,
      account.handle,
      account.channel_id,
      account.url,
    ]),
  ].join(" "));
  return haystack.includes(query);
}

function filteredVtubers() {
  return database.vtubers.filter((vtuber) => {
    if (state.agency !== "all" && vtuber.agency_name !== state.agency) return false;
    if (state.language !== "all" && vtuber.language !== state.language) return false;
    if (state.source !== "all" && vtuber.source_type !== state.source) return false;
    if (state.agencyOnly && !vtuber.agency_name) return false;
    if (state.verifiedOnly && !vtuber.is_verified) return false;
    return matchesSearch(vtuber);
  });
}

function renderAgencyList() {
  const agencies = database.agencies.filter((agency) => agency.vtuber_count > 0);
  elements.agencyCount.textContent = `${formatNumber(agencies.length)} groups`;
  elements.agencyList.innerHTML = "";

  agencies.slice(0, 24).forEach((agency) => {
    const button = document.createElement("button");
    button.className = "agency-button";
    button.type = "button";
    button.innerHTML = `<strong></strong><span></span>`;
    button.querySelector("strong").textContent = agency.name;
    button.querySelector("span").textContent = formatNumber(agency.vtuber_count);
    button.addEventListener("click", () => {
      state.agency = agency.name;
      elements.agencySelect.value = agency.name;
      render();
    });
    elements.agencyList.append(button);
  });
}

function metaItem(label, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "meta";
  const labelNode = document.createElement("span");
  labelNode.textContent = label;
  const valueNode = document.createElement("strong");
  valueNode.textContent = value || "-";
  wrapper.append(labelNode, valueNode);
  return wrapper;
}

function renderVtuberCard(vtuber) {
  const fragment = elements.template.content.cloneNode(true);
  const card = fragment.querySelector(".vtuber-card");
  const avatar = fragment.querySelector(".avatar");
  const title = fragment.querySelector("h3");
  const subtitle = fragment.querySelector(".subtitle");
  const badge = fragment.querySelector(".badge");
  const description = fragment.querySelector(".description");
  const metaGrid = fragment.querySelector(".meta-grid");
  const tagRow = fragment.querySelector(".tag-row");
  const accountRow = fragment.querySelector(".account-row");

  if (vtuber.icon_url || vtuber.avatar_image_url) {
    const img = document.createElement("img");
    img.src = vtuber.icon_url || vtuber.avatar_image_url;
    img.alt = "";
    avatar.append(img);
  } else {
    avatar.textContent = initials(vtuber);
  }

  const titleLink = document.createElement("a");
  titleLink.href = `vtubers/${vtuber.slug}/`;
  titleLink.textContent = vtuber.name;
  title.append(titleLink);
  subtitle.textContent = [vtuber.name_en, vtuber.agency_name || "所属未設定"].filter(Boolean).join(" / ");
  badge.textContent = vtuber.needs_review ? "要確認" : "確認済み";
  badge.classList.toggle("review", Boolean(vtuber.needs_review));
  description.textContent = vtuber.description || vtuber.short_description || "説明文は未登録です。";

  metaGrid.append(
    metaItem("Language", vtuber.language),
    metaItem("Source", vtuber.source_type),
    metaItem("Confidence", vtuber.confidence_score == null ? "-" : `${Math.round(vtuber.confidence_score * 100)}%`),
    metaItem("Checked", vtuber.last_checked_at)
  );

  (vtuber.tags || []).slice(0, 6).forEach((tag) => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = tag;
    tagRow.append(span);
  });

  const links = [...(vtuber.accounts || [])];
  if (vtuber.official_profile_url) {
    links.unshift({ platform: "official", url: vtuber.official_profile_url });
  }
  if (vtuber.source_url) {
    links.push({ platform: "source", url: vtuber.source_url });
  }
  links.slice(0, 5).forEach((account) => {
    if (!account.url) return;
    const link = document.createElement("a");
    link.className = "account-link";
    link.href = account.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = account.platform || "link";
    accountRow.append(link);
  });

  card.dataset.slug = vtuber.slug;
  return fragment;
}

function render() {
  const results = filteredVtubers();
  elements.resultCount.textContent = `${formatNumber(results.length)} records`;
  elements.resultList.innerHTML = "";

  document.querySelectorAll(".agency-button").forEach((button) => {
    button.classList.toggle("active", button.querySelector("strong").textContent === state.agency);
  });

  if (!results.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "条件に一致するVTuberは見つかりませんでした。";
    elements.resultList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  results.slice(0, 240).forEach((vtuber) => fragment.append(renderVtuberCard(vtuber)));
  elements.resultList.append(fragment);
  if (results.length > 240) {
    const note = document.createElement("div");
    note.className = "empty";
    note.textContent = `表示は240件までです。検索条件を追加すると残り${formatNumber(results.length - 240)}件も探しやすくなります。`;
    elements.resultList.append(note);
  }
}

setup();
