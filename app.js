(function () {
  "use strict";

  const STORAGE_KEY = "memory-card-app-data-v1";

  const defaultData = {
    version: 1,
    selectedDeckId: "deck-english",
    decks: [
      { id: "deck-english", name: "英语单词", cards: [] },
      { id: "deck-major", name: "专业课知识点", cards: [] }
    ]
  };

  const elements = {
    sidebar: document.querySelector("#sidebar"),
    sidebarScrim: document.querySelector("#sidebar-scrim"),
    deckNav: document.querySelector("#deck-nav"),
    deckTitle: document.querySelector("#deck-title"),
    deckSummary: document.querySelector("#deck-summary"),
    cardGrid: document.querySelector("#card-grid"),
    emptyState: document.querySelector("#empty-state"),
    libraryView: document.querySelector("#library-view"),
    studyView: document.querySelector("#study-view"),
    studyComplete: document.querySelector("#study-complete"),
    topbarActions: document.querySelector(".topbar-actions"),
    studyDeckName: document.querySelector("#study-deck-name"),
    studyProgressText: document.querySelector("#study-progress-text"),
    progressBar: document.querySelector("#progress-bar"),
    flashcard: document.querySelector("#flashcard"),
    studyFront: document.querySelector("#study-front"),
    studyBack: document.querySelector("#study-back"),
    studySideLabel: document.querySelector("#study-side-label"),
    flipHint: document.querySelector("#flip-hint"),
    previousCardButton: document.querySelector("#previous-card-button"),
    nextCardButton: document.querySelector("#next-card-button"),
    completeSummary: document.querySelector("#complete-summary"),
    deckModal: document.querySelector("#deck-modal"),
    deckModalTitle: document.querySelector("#deck-modal-title"),
    deckForm: document.querySelector("#deck-form"),
    deckName: document.querySelector("#deck-name"),
    deckNameError: document.querySelector("#deck-name-error"),
    deckSubmitButton: document.querySelector("#deck-submit-button"),
    cardModal: document.querySelector("#card-modal"),
    cardModalTitle: document.querySelector("#card-modal-title"),
    cardForm: document.querySelector("#card-form"),
    cardFront: document.querySelector("#card-front"),
    cardBack: document.querySelector("#card-back"),
    cardError: document.querySelector("#card-error"),
    cardSubmitButton: document.querySelector("#card-submit-button"),
    confirmModal: document.querySelector("#confirm-modal"),
    confirmTitle: document.querySelector("#confirm-title"),
    confirmMessage: document.querySelector("#confirm-message"),
    confirmButton: document.querySelector("#confirm-button"),
    toast: document.querySelector("#toast")
  };

  let data = loadData();
  let deckFormMode = "create";
  let editingCardId = null;
  let pendingConfirmAction = null;
  let toastTimer = null;
  let studySession = null;
  let lastFocusedElement = null;

  function makeId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeData(value) {
    if (!value || !Array.isArray(value.decks)) return structuredCloneFallback(defaultData);

    const decks = value.decks
      .filter((deck) => deck && typeof deck.name === "string")
      .map((deck) => ({
        id: String(deck.id || makeId("deck")),
        name: deck.name.trim() || "未命名卡组",
        cards: Array.isArray(deck.cards)
          ? deck.cards
              .filter((card) => card && typeof card.front === "string" && typeof card.back === "string")
              .map((card) => ({
                id: String(card.id || makeId("card")),
                front: card.front,
                back: card.back,
                createdAt: Number(card.createdAt) || Date.now()
              }))
          : []
      }));

    if (decks.length === 0) return structuredCloneFallback(defaultData);
    const selectedDeckId = decks.some((deck) => deck.id === value.selectedDeckId)
      ? value.selectedDeckId
      : decks[0].id;
    return { version: 1, selectedDeckId, decks };
  }

  function structuredCloneFallback(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadData() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? normalizeData(JSON.parse(saved)) : structuredCloneFallback(defaultData);
    } catch (error) {
      return structuredCloneFallback(defaultData);
    }
  }

  function saveData() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      showToast("浏览器未能保存数据，请检查隐私或存储设置");
    }
  }

  function getSelectedDeck() {
    return data.decks.find((deck) => deck.id === data.selectedDeckId) || data.decks[0];
  }

  function render() {
    const deck = getSelectedDeck();
    if (!deck) return;

    elements.deckNav.replaceChildren(...data.decks.map(createDeckNavItem));
    elements.deckTitle.textContent = deck.name;
    elements.deckSummary.textContent = `${deck.cards.length} 张卡片`;
    elements.cardGrid.replaceChildren(...deck.cards.map(createCardElement));
    elements.cardGrid.hidden = deck.cards.length === 0;
    elements.emptyState.hidden = deck.cards.length !== 0;
    document.title = `${deck.name} · 记忆卡片`;
  }

  function createDeckNavItem(deck) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `deck-nav-item${deck.id === data.selectedDeckId ? " active" : ""}`;
    button.dataset.deckId = deck.id;
    button.setAttribute("aria-current", deck.id === data.selectedDeckId ? "page" : "false");

    const name = document.createElement("span");
    name.className = "deck-nav-name";
    name.textContent = deck.name;
    const count = document.createElement("span");
    count.className = "deck-nav-count";
    count.textContent = deck.cards.length;
    button.append(name, count);
    return button;
  }

  function createCardElement(card) {
    const article = document.createElement("article");
    article.className = "memory-card";
    article.dataset.cardId = card.id;

    const flipButton = document.createElement("button");
    flipButton.type = "button";
    flipButton.className = "card-flip-area";
    flipButton.setAttribute("aria-label", "翻转卡片查看背面");
    flipButton.setAttribute("aria-pressed", "false");

    const inner = document.createElement("span");
    inner.className = "card-preview-inner";
    inner.append(
      createCardFace("front", "正面", card.front),
      createCardFace("back", "背面", card.back)
    );
    flipButton.append(inner);

    const footer = document.createElement("div");
    footer.className = "card-footer";
    const flipLabel = document.createElement("span");
    flipLabel.className = "flip-label";
    flipLabel.textContent = "点击翻面";
    const actions = document.createElement("div");
    actions.className = "card-actions";
    actions.innerHTML = `
      <button class="card-action-button edit" type="button" data-action="edit">编辑</button>
      <button class="card-action-button delete" type="button" data-action="delete">删除</button>
    `;
    footer.append(flipLabel, actions);
    article.append(flipButton, footer);
    return article;
  }

  function createCardFace(side, label, text) {
    const face = document.createElement("span");
    face.className = `card-preview-face card-preview-${side}`;

    const sideTag = document.createElement("span");
    sideTag.className = "card-side-tag";
    sideTag.textContent = label;
    const content = document.createElement("span");
    content.className = "card-text";
    content.textContent = text;
    face.append(sideTag, content);
    return face;
  }

  function selectDeck(deckId) {
    if (!data.decks.some((deck) => deck.id === deckId)) return;
    data.selectedDeckId = deckId;
    saveData();
    showLibrary();
    render();
    closeSidebar();
  }

  function openDeckModal(mode) {
    deckFormMode = mode;
    const deck = getSelectedDeck();
    elements.deckModalTitle.textContent = mode === "create" ? "新建卡组" : "重命名卡组";
    elements.deckSubmitButton.textContent = mode === "create" ? "创建卡组" : "保存名称";
    elements.deckName.value = mode === "create" ? "" : deck.name;
    elements.deckNameError.hidden = true;
    openModal(elements.deckModal, elements.deckName);
    elements.deckName.select();
  }

  function submitDeck(event) {
    event.preventDefault();
    const name = elements.deckName.value.trim();
    if (!name) return showFieldError(elements.deckNameError, "请输入卡组名称");

    const duplicate = data.decks.some((deck) =>
      deck.name.toLocaleLowerCase() === name.toLocaleLowerCase() &&
      (deckFormMode === "create" || deck.id !== data.selectedDeckId)
    );
    if (duplicate) return showFieldError(elements.deckNameError, "已经有同名卡组了，请换一个名称");

    if (deckFormMode === "create") {
      const newDeck = { id: makeId("deck"), name, cards: [] };
      data.decks.push(newDeck);
      data.selectedDeckId = newDeck.id;
      showToast(`已创建卡组“${name}”`);
    } else {
      getSelectedDeck().name = name;
      showToast("卡组名称已保存");
    }

    saveData();
    closeModal(elements.deckModal);
    render();
  }

  function openCardModal(cardId) {
    editingCardId = cardId || null;
    const card = editingCardId
      ? getSelectedDeck().cards.find((item) => item.id === editingCardId)
      : null;
    elements.cardModalTitle.textContent = card ? "编辑卡片" : "新增卡片";
    elements.cardSubmitButton.textContent = card ? "保存修改" : "保存卡片";
    elements.cardFront.value = card ? card.front : "";
    elements.cardBack.value = card ? card.back : "";
    elements.cardError.hidden = true;
    openModal(elements.cardModal, elements.cardFront);
  }

  function submitCard(event) {
    event.preventDefault();
    const front = elements.cardFront.value.trim();
    const back = elements.cardBack.value.trim();
    if (!front || !back) return showFieldError(elements.cardError, "正面和背面内容都需要填写");

    const deck = getSelectedDeck();
    if (editingCardId) {
      const card = deck.cards.find((item) => item.id === editingCardId);
      if (!card) return;
      card.front = front;
      card.back = back;
      showToast("卡片已更新");
    } else {
      deck.cards.unshift({ id: makeId("card"), front, back, createdAt: Date.now() });
      showToast("卡片已添加");
    }

    saveData();
    closeModal(elements.cardModal);
    render();
  }

  function handleCardGridClick(event) {
    const cardElement = event.target.closest(".memory-card");
    if (!cardElement) return;
    const card = getSelectedDeck().cards.find((item) => item.id === cardElement.dataset.cardId);
    if (!card) return;

    const actionButton = event.target.closest("[data-action]");
    if (actionButton) {
      if (actionButton.dataset.action === "edit") openCardModal(card.id);
      if (actionButton.dataset.action === "delete") {
        askForConfirmation(
          "删除卡片",
          `确定要删除正面为“${shorten(card.front, 38)}”的卡片吗？删除后无法恢复。`,
          () => deleteCard(card.id)
        );
      }
      return;
    }

    if (!event.target.closest(".card-flip-area")) return;
    const showingBack = cardElement.classList.toggle("showing-back");
    cardElement.querySelector(".flip-label").textContent = showingBack ? "点击回到正面" : "点击翻面";
    const flipArea = event.target.closest(".card-flip-area");
    flipArea.setAttribute(
      "aria-label",
      showingBack ? "翻转卡片查看正面" : "翻转卡片查看背面"
    );
    flipArea.setAttribute("aria-pressed", String(showingBack));
  }

  function deleteCard(cardId) {
    const deck = getSelectedDeck();
    deck.cards = deck.cards.filter((card) => card.id !== cardId);
    saveData();
    render();
    showToast("卡片已删除");
  }

  function deleteSelectedDeck() {
    const deck = getSelectedDeck();
    data.decks = data.decks.filter((item) => item.id !== deck.id);
    if (data.decks.length === 0) {
      data.decks.push({ id: makeId("deck"), name: "新卡组", cards: [] });
    }
    data.selectedDeckId = data.decks[0].id;
    saveData();
    render();
    showToast(`已删除卡组“${deck.name}”`);
  }

  function startStudy() {
    const deck = getSelectedDeck();
    if (deck.cards.length === 0) {
      showToast("请先添加卡片，再开始背诵");
      openCardModal();
      return;
    }

    studySession = {
      deckId: deck.id,
      cards: shuffle(deck.cards.map((card) => ({ ...card }))),
      index: 0,
      flipped: false
    };
    elements.libraryView.hidden = true;
    elements.studyComplete.hidden = true;
    elements.studyView.hidden = false;
    elements.topbarActions.hidden = true;
    renderStudyCard();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderStudyCard() {
    if (!studySession) return;
    const card = studySession.cards[studySession.index];
    const current = studySession.index + 1;
    const total = studySession.cards.length;
    const deck = data.decks.find((item) => item.id === studySession.deckId);

    elements.studyDeckName.textContent = deck ? deck.name : "背诵模式";
    elements.studyProgressText.textContent = `${current}/${total}`;
    elements.progressBar.style.width = `${(current / total) * 100}%`;
    elements.studyFront.textContent = card.front;
    elements.studyBack.textContent = card.back;
    elements.flashcard.classList.toggle("flipped", studySession.flipped);
    elements.flashcard.setAttribute("aria-label", studySession.flipped ? "当前显示背面，点击查看正面" : "当前显示正面，点击查看答案");
    elements.studySideLabel.textContent = studySession.flipped ? "背面" : "正面";
    elements.flipHint.textContent = studySession.flipped ? "点击卡片回到正面" : "点击卡片查看答案";
    elements.previousCardButton.disabled = studySession.index === 0;
    elements.nextCardButton.textContent = current === total ? "完成本轮" : "下一张";
  }

  function flipStudyCard() {
    if (!studySession) return;
    studySession.flipped = !studySession.flipped;
    renderStudyCard();
  }

  function nextStudyCard() {
    if (!studySession) return;
    if (studySession.index >= studySession.cards.length - 1) {
      showStudyComplete();
      return;
    }
    studySession.index += 1;
    studySession.flipped = false;
    renderStudyCard();
  }

  function previousStudyCard() {
    if (!studySession || studySession.index === 0) return;
    studySession.index -= 1;
    studySession.flipped = false;
    renderStudyCard();
  }

  function showStudyComplete() {
    const total = studySession ? studySession.cards.length : 0;
    elements.studyView.hidden = true;
    elements.studyComplete.hidden = false;
    elements.completeSummary.textContent = `本轮共复习 ${total} 张卡片。`;
  }

  function restartStudy() {
    if (!studySession) return startStudy();
    studySession.cards = shuffle(studySession.cards);
    studySession.index = 0;
    studySession.flipped = false;
    elements.studyComplete.hidden = true;
    elements.studyView.hidden = false;
    renderStudyCard();
  }

  function showLibrary() {
    studySession = null;
    elements.studyView.hidden = true;
    elements.studyComplete.hidden = true;
    elements.libraryView.hidden = false;
    elements.topbarActions.hidden = false;
  }

  function shuffle(items) {
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
    }
    return copy;
  }

  function askForConfirmation(title, message, action) {
    elements.confirmTitle.textContent = title;
    elements.confirmMessage.textContent = message;
    pendingConfirmAction = action;
    openModal(elements.confirmModal, elements.confirmButton);
  }

  function openModal(modal, focusTarget) {
    lastFocusedElement = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => focusTarget.focus(), 0);
  }

  function closeModal(modal) {
    modal.hidden = true;
    document.body.style.overflow = "";
    if (lastFocusedElement && document.contains(lastFocusedElement)) lastFocusedElement.focus();
    lastFocusedElement = null;
  }

  function closeTopModal() {
    const openModalLayer = [elements.confirmModal, elements.cardModal, elements.deckModal]
      .find((modal) => !modal.hidden);
    if (openModalLayer) {
      closeModal(openModalLayer);
      return true;
    }
    return false;
  }

  function showFieldError(element, message) {
    element.textContent = message;
    element.hidden = false;
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      elements.toast.hidden = true;
    }, 2600);
  }

  function shorten(value, length) {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length > length ? `${normalized.slice(0, length)}…` : normalized;
  }

  function openSidebar() {
    elements.sidebar.classList.add("open");
    elements.sidebarScrim.hidden = false;
  }

  function closeSidebar() {
    elements.sidebar.classList.remove("open");
    elements.sidebarScrim.hidden = true;
  }

  document.querySelector("#home-link").addEventListener("click", (event) => {
    event.preventDefault();
    showLibrary();
  });
  document.querySelector("#add-deck-icon").addEventListener("click", () => openDeckModal("create"));
  document.querySelector("#add-deck-button").addEventListener("click", () => openDeckModal("create"));
  document.querySelector("#rename-deck-button").addEventListener("click", () => openDeckModal("rename"));
  document.querySelector("#add-card-button").addEventListener("click", () => openCardModal());
  document.querySelector("#empty-add-button").addEventListener("click", () => openCardModal());
  document.querySelector("#study-button").addEventListener("click", startStudy);
  document.querySelector("#exit-study-button").addEventListener("click", showLibrary);
  document.querySelector("#complete-exit-button").addEventListener("click", showLibrary);
  document.querySelector("#restart-study-button").addEventListener("click", restartStudy);
  document.querySelector("#menu-button").addEventListener("click", openSidebar);
  document.querySelector("#sidebar-close").addEventListener("click", closeSidebar);
  elements.sidebarScrim.addEventListener("click", closeSidebar);
  elements.deckNav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-deck-id]");
    if (button) selectDeck(button.dataset.deckId);
  });
  elements.cardGrid.addEventListener("click", handleCardGridClick);
  elements.deckForm.addEventListener("submit", submitDeck);
  elements.cardForm.addEventListener("submit", submitCard);
  elements.flashcard.addEventListener("click", flipStudyCard);
  elements.nextCardButton.addEventListener("click", nextStudyCard);
  elements.previousCardButton.addEventListener("click", previousStudyCard);
  document.querySelector("#delete-deck-button").addEventListener("click", () => {
    const deck = getSelectedDeck();
    askForConfirmation(
      "删除卡组",
      `确定要删除“${deck.name}”及其中的 ${deck.cards.length} 张卡片吗？删除后无法恢复。`,
      deleteSelectedDeck
    );
  });
  elements.confirmButton.addEventListener("click", () => {
    if (pendingConfirmAction) pendingConfirmAction();
    pendingConfirmAction = null;
    closeModal(elements.confirmModal);
  });

  document.querySelectorAll(".modal-close").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.closest(".modal-layer")));
  });
  document.querySelectorAll(".modal-layer").forEach((layer) => {
    layer.addEventListener("click", (event) => {
      if (event.target === layer) closeModal(layer);
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (closeTopModal()) return;
      if (elements.sidebar.classList.contains("open")) return closeSidebar();
      if (studySession) showLibrary();
    }
    if (!studySession || elements.studyView.hidden) return;
    if (event.key === " " || event.key === "Enter") {
      if (event.target === document.body) {
        event.preventDefault();
        flipStudyCard();
      }
    }
    if (event.key === "ArrowRight") nextStudyCard();
    if (event.key === "ArrowLeft") previousStudyCard();
  });

  render();
})();
