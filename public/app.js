const API = '/api';

let state = null;
let selectedRestaurantId = null;
let selectedReviewRestaurantId = null;
let selectedExpertId = null;
let selectedExpertLoginId = null;
let selectedMerchantRestaurantId = null;
let selectedMerchantLoginKey = null;
let expertStatusFilter = 'all';
let expertTimeFilter = 'all';
let selectedAdminExpertId = null;
let adminReviewStatusFilter = 'pending_review';
let adminCredentialAddressDraft = '';
let adminActionNoticeHtml = '';
let gpsEvidence = null;
let expertSession = readExpertSession();
let adminSession = readAdminSession();
let merchantSession = readMerchantSession();
let loginChallenge = null;
let loginSignature = null;
let messageClearTimer = null;
let messageVersion = 0;
let merchantActionNoticeHtml = '';
let merchantBountyDraft = {
  expertCount: 3,
  rewardPerExpertXrp: 2,
  focusArea: 'consistency',
  note: 'Request expert visits during dinner service and focus on consistency, hygiene, and wait time.'
};
const SCORE_DIMENSIONS = [
  ['food', 'Food'],
  ['service', 'Service'],
  ['hygiene', 'Hygiene'],
  ['consistency', 'Consistency'],
  ['value', 'Value']
];
const OPERATIONAL_TAGS = [
  ['clean_dining_room', 'Clean dining room'],
  ['accurate_menu', 'Menu matched reality'],
  ['slow_service', 'Slow service'],
  ['price_mismatch', 'Price/value mismatch'],
  ['allergen_confidence', 'Allergen handling checked'],
  ['queue_issue', 'Queue or seating issue']
];
const DEFAULT_REVIEW_DRAFT = {
  dimensionScores: {
    food: 4,
    service: 4,
    hygiene: 4,
    consistency: 4,
    value: 4
  },
  visitType: 'dinner',
  partySize: 2,
  spendPerPersonGbp: 32,
  waitTimeMinutes: 8,
  orderedItems: 'Pasta, salad, and dessert',
  revisitIntent: 'likely',
  operationalTags: ['clean_dining_room', 'accurate_menu'],
  title: 'Balanced, evidence-backed visit',
  body: 'Service was consistent, food quality matched the price, and the dining room was clean during the visit.'
};
let reviewDraft = cloneDefaultReviewDraft();

const view = document.querySelector('#view');
const msg = document.querySelector('#message');
const globalSession = document.querySelector('#globalSession');
const refreshBtn = document.querySelector('#refreshBtn');

refreshBtn.addEventListener('click', refresh);

function showMessage(text, isError = false, autoClearMs = 0) {
  if (messageClearTimer) {
    clearTimeout(messageClearTimer);
    messageClearTimer = null;
  }
  messageVersion += 1;
  const version = messageVersion;
  msg.innerHTML = text ? `<div class="message ${isError ? 'error' : ''}">${escapeHtml(text)}</div>` : '';
  if (text && autoClearMs > 0) {
    messageClearTimer = setTimeout(() => {
      if (version === messageVersion) showMessage('');
    }, autoClearMs);
  }
}

function showRichMessage(html, isError = false, autoClearMs = 0) {
  if (messageClearTimer) {
    clearTimeout(messageClearTimer);
    messageClearTimer = null;
  }
  messageVersion += 1;
  const version = messageVersion;
  msg.innerHTML = html ? `<div class="message ${isError ? 'error' : ''}">${html}</div>` : '';
  if (html && autoClearMs > 0) {
    messageClearTimer = setTimeout(() => {
      if (version === messageVersion) showMessage('');
    }, autoClearMs);
  }
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

async function refresh() {
  try {
    state = await api('/state');
    if (!selectedRestaurantId) selectedRestaurantId = state.restaurants[0]?.id;
    if (!selectedReviewRestaurantId) selectedReviewRestaurantId = state.restaurants[0]?.id;
    if (!selectedExpertId) selectedExpertId = state.experts[0]?.id;
    if (!selectedMerchantRestaurantId) selectedMerchantRestaurantId = state.restaurants.find((r) => r.verifiedStatus === 'verified')?.id;
    showMessage('');
    render();
  } catch (err) {
    showMessage(err.message, true);
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[ch]));
}

function readExpertSession() {
  localStorage.removeItem('trustbiteExpertSessionId');
  try {
    const parsed = JSON.parse(localStorage.getItem('trustbiteExpertSession') || 'null');
    return parsed?.sessionToken ? parsed : null;
  } catch {
    localStorage.removeItem('trustbiteExpertSession');
    return null;
  }
}

function readAdminSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem('trustbiteAdminSession') || 'null');
    return parsed?.sessionToken ? parsed : null;
  } catch {
    localStorage.removeItem('trustbiteAdminSession');
    return null;
  }
}

function readMerchantSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem('trustbiteMerchantSession') || 'null');
    return parsed?.sessionToken ? parsed : null;
  } catch {
    localStorage.removeItem('trustbiteMerchantSession');
    return null;
  }
}

function saveExpertSession(session) {
  expertSession = session;
  if (session) {
    localStorage.setItem('trustbiteExpertSession', JSON.stringify(session));
  } else {
    localStorage.removeItem('trustbiteExpertSession');
  }
}

function saveAdminSession(session) {
  adminSession = session;
  if (session) {
    localStorage.setItem('trustbiteAdminSession', JSON.stringify(session));
  } else {
    localStorage.removeItem('trustbiteAdminSession');
  }
}

function saveMerchantSession(session) {
  merchantSession = session;
  if (session) {
    localStorage.setItem('trustbiteMerchantSession', JSON.stringify(session));
  } else {
    localStorage.removeItem('trustbiteMerchantSession');
  }
}

function cloneDefaultReviewDraft() {
  return {
    ...DEFAULT_REVIEW_DRAFT,
    dimensionScores: { ...DEFAULT_REVIEW_DRAFT.dimensionScores },
    operationalTags: [...DEFAULT_REVIEW_DRAFT.operationalTags]
  };
}

function overallFromDimensions(dimensionScores = {}) {
  const values = SCORE_DIMENSIONS
    .map(([key]) => Number(dimensionScores[key]))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

function dimensionScoresForReview(review) {
  if (review.dimensionScores) return review.dimensionScores;
  if (!review.rating) return null;
  return Object.fromEntries(SCORE_DIMENSIONS.map(([key]) => [key, Number(review.rating)]));
}

function captureReviewDraft() {
  const title = document.querySelector('#reviewTitle');
  const body = document.querySelector('#reviewBody');
  for (const [key] of SCORE_DIMENSIONS) {
    const input = document.querySelector(`#score-${key}`);
    if (input) reviewDraft.dimensionScores[key] = Number(input.value);
  }
  const visitType = document.querySelector('#visitType');
  const partySize = document.querySelector('#partySize');
  const spend = document.querySelector('#spendPerPerson');
  const wait = document.querySelector('#waitTime');
  const orderedItems = document.querySelector('#orderedItems');
  const revisitIntent = document.querySelector('#revisitIntent');
  if (visitType) reviewDraft.visitType = visitType.value;
  if (partySize) reviewDraft.partySize = Number(partySize.value);
  if (spend) reviewDraft.spendPerPersonGbp = Number(spend.value);
  if (wait) reviewDraft.waitTimeMinutes = Number(wait.value);
  if (orderedItems) reviewDraft.orderedItems = orderedItems.value;
  if (revisitIntent) reviewDraft.revisitIntent = revisitIntent.value;
  const checkedTags = [...document.querySelectorAll('[data-operational-tag]:checked')].map((item) => item.value);
  if (document.querySelector('[data-operational-tag]')) reviewDraft.operationalTags = checkedTags;
  if (title) reviewDraft.title = title.value;
  if (body) reviewDraft.body = body.value;
}

function resetReviewDraft() {
  reviewDraft = cloneDefaultReviewDraft();
}

function currentPage() {
  const page = location.pathname.replace('/', '') || 'visitor';
  return ['visitor', 'expert', 'merchant', 'admin'].includes(page) ? page : 'visitor';
}

function stars(value) {
  const rounded = Math.round(Number(value || 0));
  return `<span class="stars">${[0, 1, 2, 3, 4].map((i) => `<span class="${i < rounded ? 'on' : ''}">&#9733;</span>`).join('')}</span>`;
}

function pill(text, tone = 'neutral') {
  return `<span class="pill ${tone}">${escapeHtml(text)}</span>`;
}

function tx(hash) {
  if (!hash) return '<span class="muted">not yet</span>';
  return `<a target="_blank" rel="noreferrer" href="${state.explorerBase}/${hash}">${hash.slice(0, 10)}...${hash.slice(-6)}</a>`;
}

function txUrl(hash) {
  return `${state.explorerBase}/${hash}`;
}

function restaurantById(id) {
  return state.restaurants.find((item) => item.id === id);
}

function expertById(id) {
  return state.experts.find((item) => item.id === id);
}

function expertByAddress(address) {
  return state.experts.find((item) => item.xrplAddress === address);
}

function activeExpertByAddress(address) {
  return state.experts.find((item) => item.xrplAddress === address && item.status === 'active' && item.credentialStatus === 'active');
}

function candidateWallets() {
  return state.candidateWallets || [];
}

function expertLoginOptions() {
  const expertOptions = state.experts
    .filter((expert) => expert.xrplAddress && expert.walletKey && expert.status === 'active' && expert.credentialStatus === 'active')
    .map((expert) => ({
      type: 'expert',
      value: `expert:${expert.id}`,
      expertId: expert.id,
      address: expert.xrplAddress,
      label: `${anonymousExpertLabel(expert)} ${shortAddress(expert.xrplAddress)} - ${balanceForAddress(expert.xrplAddress)}`,
      disabled: false
    }));
  const candidateOptions = candidateWallets()
    .filter((wallet) => wallet.address && !activeExpertByAddress(wallet.address))
    .map((wallet, index) => ({
      type: 'candidate',
      value: `candidate:${wallet.key}`,
      walletKey: wallet.key,
      address: wallet.address,
      label: `Not expert yet ${String(index + 1).padStart(2, '0')} ${shortAddress(wallet.address)} - ${balanceForAddress(wallet.address)}`,
      disabled: false
    }));
  return [...expertOptions, ...candidateOptions];
}

function selectedExpertLoginOption() {
  const options = expertLoginOptions();
  return options.find((option) => option.value === selectedExpertLoginId) || options[0] || null;
}

function anonymousExpertLabel(expert) {
  const index = state.experts.findIndex((item) => item.id === expert?.id);
  return `Expert #${String(index + 1 || 1).padStart(2, '0')}`;
}

function auditEntityLabel(log) {
  if (log.entityType === 'expert') {
    const expert = expertById(log.entityId);
    return expert ? `expert:${anonymousExpertLabel(expert)}` : 'expert:anonymous';
  }
  return `${log.entityType}:${log.entityId}`;
}

function statusTone(status) {
  if (status === 'published') return 'good';
  if (status === 'excluded') return 'bad';
  if (status === 'challenged') return 'warn';
  if (status === 'pending_review' || status === 'challenge_window') return 'warn';
  return 'neutral';
}

function reviewStatusLabel(status) {
  const labels = {
    pending_review: 'Pending review',
    challenge_window: 'Pending review',
    challenged: 'Challenged',
    published: 'Published',
    excluded: 'Excluded'
  };
  return labels[status] || status || 'Unknown';
}

function reviewFilterKey(status) {
  if (status === 'challenge_window') return 'pending_review';
  return status || 'unknown';
}

function auditStatusLabel(status) {
  if (!status || status === '-') return '-';
  return reviewStatusLabel(status);
}

function matchesExpertTimeFilter(review) {
  if (expertTimeFilter === 'all') return true;
  const submitted = new Date(review.submittedAt || review.createdAt || 0).getTime();
  if (!submitted) return false;
  const ageMs = Date.now() - submitted;
  if (expertTimeFilter === 'today') return new Date(submitted).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
  if (expertTimeFilter === '7d') return ageMs <= 7 * 24 * 60 * 60 * 1000;
  if (expertTimeFilter === '30d') return ageMs <= 30 * 24 * 60 * 60 * 1000;
  return true;
}

function isChallengeWindowOpen(review) {
  if (!['pending_review', 'challenge_window', 'challenged'].includes(review.status)) return false;
  if (review.status === 'challenged') return true;
  if (!review.challengeWindowEndsAt) return true;
  return new Date(review.challengeWindowEndsAt).getTime() > Date.now();
}

function hasRecentActiveReview(expertId, restaurantId) {
  return state.reviews.some((review) => (
    review.expertId === expertId &&
    review.restaurantId === restaurantId &&
    review.status !== 'excluded' &&
    Date.now() - new Date(review.submittedAt).getTime() < 30 * 24 * 60 * 60 * 1000
  ));
}

function reviewedRestaurantIdsForExpert(expertId) {
  return new Set(
    state.restaurants
      .filter((restaurant) => hasRecentActiveReview(expertId, restaurant.id))
      .map((restaurant) => restaurant.id)
  );
}

function firstReviewableRestaurantId(expertId) {
  return state.restaurants.find((restaurant) => !hasRecentActiveReview(expertId, restaurant.id))?.id || null;
}

function shortAddress(address) {
  if (!address) return 'no wallet';
  return `${address.slice(0, 6)}...${address.slice(-5)}`;
}

function walletByAddress(address) {
  if (!address) return null;
  return [...(state.wallets || []), ...(state.candidateWallets || []), ...(state.merchantWallets || [])]
    .find((wallet) => wallet.address === address);
}

function balanceForAddress(address) {
  const wallet = walletByAddress(address);
  return wallet?.balanceXrp ? `${wallet.balanceXrp} XRP` : 'balance N/A';
}

function accountLine(address, prefix = '') {
  if (!address) return '<small>no wallet</small>';
  const label = `${prefix}${shortAddress(address)}`;
  return `
    <span class="account-line">
      <span>${escapeHtml(label)}</span>
      <button type="button" class="copy-address-btn" data-copy-address="${escapeHtml(address)}" title="Copy address" aria-label="Copy address">Copy</button>
    </span>
  `;
}

function balanceLine(address) {
  return `<span class="balance-line">${escapeHtml(balanceForAddress(address))}</span>`;
}

async function copyAddress(address) {
  try {
    await navigator.clipboard.writeText(address);
    showMessage('Address copied.', false, 1800);
  } catch {
    showMessage(address, false, 3000);
  }
}

function bindCopyButtons(root = document) {
  root.querySelectorAll('[data-copy-address]').forEach((button) => {
    button.addEventListener('click', () => copyAddress(button.dataset.copyAddress));
  });
}

function render() {
  if (!state) return;
  const page = currentPage();
  renderGlobalSession(page);
  bindCopyButtons(globalSession);
  if (page === 'visitor') renderVisitor();
  if (page === 'expert') renderExpert();
  if (page === 'merchant') renderMerchant();
  if (page === 'admin') renderAdmin();
  bindCopyButtons(view);
}

function renderGlobalSession(page) {
  if (!globalSession) return;
  if (!['expert', 'admin', 'merchant'].includes(page)) {
    globalSession.innerHTML = '';
    refreshBtn.hidden = false;
    return;
  }
  refreshBtn.hidden = true;
  if (page === 'expert') {
    if (expertSession && new Date(expertSession.expiresAt).getTime() <= Date.now()) {
      saveExpertSession(null);
    }
    const expert = expertSession?.expertId ? expertById(expertSession.expertId) : null;
    globalSession.innerHTML = expertSession?.role === 'candidate'
      ? renderCandidateSession(expertSession)
      : expert ? renderExpertSession(expert, expertSession) : renderTopExpertLogin();
    globalSession.querySelector('#expertTopSelect')?.addEventListener('change', (e) => {
      selectedExpertLoginId = e.target.value;
      if (selectedExpertLoginId.startsWith('expert:')) selectedExpertId = selectedExpertLoginId.replace('expert:', '');
      renderGlobalSession('expert');
    });
    globalSession.querySelector('#expertWalletLoginBtn')?.addEventListener('click', signInWithExpertWallet);
    globalSession.querySelector('#expertLogoutBtn')?.addEventListener('click', () => {
      saveExpertSession(null);
      loginChallenge = null;
      loginSignature = null;
      gpsEvidence = null;
      resetReviewDraft();
      showMessage('');
      render();
    });
  }
  if (page === 'admin') {
    if (adminSession && new Date(adminSession.expiresAt).getTime() <= Date.now()) {
      saveAdminSession(null);
      selectedAdminExpertId = null;
      adminReviewStatusFilter = 'pending_review';
    }
    globalSession.innerHTML = adminSession ? renderAdminSession(adminSession) : renderTopAdminLogin();
    globalSession.querySelector('#adminWalletLoginBtn')?.addEventListener('click', signInWithAdminWallet);
    globalSession.querySelector('#adminLogoutBtn')?.addEventListener('click', () => {
      saveAdminSession(null);
      selectedAdminExpertId = null;
      adminReviewStatusFilter = 'pending_review';
      showMessage('');
      render();
    });
  }
  if (page === 'merchant') {
    if (merchantSession && new Date(merchantSession.expiresAt).getTime() <= Date.now()) {
      saveMerchantSession(null);
      selectedMerchantRestaurantId = null;
    }
    globalSession.innerHTML = merchantSession ? renderMerchantSession(merchantSession) : renderTopMerchantLogin();
    globalSession.querySelector('#merchantTopSelect')?.addEventListener('change', (e) => {
      selectedMerchantLoginKey = e.target.value;
      renderGlobalSession('merchant');
    });
    globalSession.querySelector('#merchantWalletLoginBtn')?.addEventListener('click', signInWithMerchantWallet);
    globalSession.querySelector('#merchantLogoutBtn')?.addEventListener('click', () => {
      saveMerchantSession(null);
      selectedMerchantRestaurantId = null;
      merchantActionNoticeHtml = '';
      showMessage('');
      render();
    });
  }
}

function renderTopExpertLogin() {
  const options = expertLoginOptions();
  const selected = selectedExpertLoginOption();
  if (selected) {
    selectedExpertLoginId = selected.value;
    if (selected.type === 'expert') selectedExpertId = selected.expertId;
  }
  return `
    <div class="top-auth-card">
      <select id="expertTopSelect" class="top-wallet-select" aria-label="Expert wallet">
        ${options.length ? options.map((option) => `<option value="${option.value}" ${option.value === selected?.value ? 'selected' : ''} ${option.disabled ? 'disabled' : ''}>${escapeHtml(option.label)}</option>`).join('') : '<option value="">No wallets ready</option>'}
      </select>
      <button id="expertWalletLoginBtn" ${selected ? '' : 'disabled'}>Sign in with Selected Wallet</button>
    </div>
  `;
}

function adminWallet() {
  return state.wallets.find((wallet) => wallet.key === 'adminOperational') || null;
}

function renderTopAdminLogin() {
  const wallet = adminWallet();
  const canLogin = Boolean(wallet?.address);
  return `
    <div class="top-auth-card">
      <div class="top-wallet-label">Admin wallet ${wallet?.address ? shortAddress(wallet.address) : 'pending'}</div>
      <button id="adminWalletLoginBtn" ${canLogin ? '' : 'disabled'}>Sign in with Admin Wallet</button>
    </div>
  `;
}

function merchantWallets() {
  return state.merchantWallets || [];
}

function merchantWalletByKey(key) {
  return merchantWallets().find((wallet) => wallet.key === key);
}

function renderTopMerchantLogin() {
  const wallets = merchantWallets().filter((wallet) => wallet.address);
  const selected = merchantWalletByKey(selectedMerchantLoginKey) || wallets[0] || null;
  if (selected) selectedMerchantLoginKey = selected.key;
  return `
    <div class="top-auth-card">
      <select id="merchantTopSelect" class="top-wallet-select" aria-label="Merchant wallet">
        ${wallets.length ? wallets.map((wallet) => `<option value="${wallet.key}" ${wallet.key === selected?.key ? 'selected' : ''}>${escapeHtml(wallet.label)} ${shortAddress(wallet.address)} - ${escapeHtml(balanceForAddress(wallet.address))}</option>`).join('') : '<option value="">No merchant wallets ready</option>'}
      </select>
      <button id="merchantWalletLoginBtn" ${selected ? '' : 'disabled'}>Sign in with Merchant Wallet</button>
    </div>
  `;
}

function renderVisitor() {
  const query = document.querySelector('#visitorSearch')?.value || '';
  const q = query.toLowerCase().trim();
  const restaurants = state.restaurants
    .filter((r) => !q || `${r.name} ${r.city} ${r.category}`.toLowerCase().includes(q))
    .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
  if (!restaurants.find((r) => r.id === selectedRestaurantId)) selectedRestaurantId = restaurants[0]?.id || state.restaurants[0]?.id;
  const current = restaurantById(selectedRestaurantId) || restaurants[0] || state.restaurants[0];
  const publishedReviews = state.reviews.filter((r) => r.restaurantId === current?.id && r.status === 'published');
  const areaRestaurantIds = new Set(restaurants.map((restaurant) => restaurant.id));
  const areaReviewCount = state.reviews.filter((review) => areaRestaurantIds.has(review.restaurantId) && review.status === 'published').length;
  const topScore = Math.max(0, ...restaurants.map((r) => r.averageRating || 0));

  view.innerHTML = `
    <section class="grid two">
      <div class="panel">
        <div class="customer-hero">
          <div>
            <h2>Find restaurants with trust reviews</h2>
          </div>
          <div class="customer-stats">
            <span class="area-metric"><small>Current map area</small><strong>${restaurants.length}</strong><em>restaurants</em></span>
            <span class="area-metric"><small>Current map area</small><strong>${areaReviewCount}</strong><em>expert reviews</em></span>
            <span class="area-metric"><small>Current map area</small><strong>${topScore ? topScore.toFixed(1) : 'N/A'}</strong><em>top score</em></span>
          </div>
        </div>
        <input id="visitorSearch" class="search" placeholder="Search by restaurant, cuisine, or area" value="${escapeHtml(query)}" />
        <div class="sort-note">Sorted by expert rating, highest first</div>
        ${renderMap(restaurants, current?.id)}
        <div class="list">
          ${restaurants.map((restaurant) => `
            <button class="restaurant-row ${restaurant.id === current?.id ? 'selected' : ''}" data-restaurant-id="${restaurant.id}">
              <span>
                <strong>${escapeHtml(restaurant.name)}</strong>
                <small>${escapeHtml(restaurant.category)} - ${escapeHtml(restaurant.city)} - ${restaurant.verifiedStatus === 'verified' ? 'Verified venue' : 'Expert-discovered'}</small>
              </span>
              <span class="rating-box">${restaurant.validReviewCount >= 3 ? restaurant.averageRating.toFixed(1) : 'N/A'}<small>${restaurant.validReviewCount} reviews</small></span>
            </button>
          `).join('')}
        </div>
      </div>
      <div class="panel">
        ${current ? `
          <div class="detail-head">
            <div><h2>${escapeHtml(current.name)}</h2><p>${escapeHtml(current.address)}</p></div>
            ${pill(current.verifiedStatus === 'verified' ? 'Verified venue' : 'Expert-discovered', current.verifiedStatus === 'verified' ? 'good' : 'neutral')}
          </div>
          <div class="score-card">
            <div class="score">${current.validReviewCount >= 3 ? current.averageRating.toFixed(1) : 'N/A'}</div>
            <div>
              <span class="score-label">Expert score</span>
              ${stars(current.averageRating)}
              <p>${current.validReviewCount >= 3 ? `Based on ${current.validReviewCount} published expert visits` : `Collecting expert visits (${current.validReviewCount}/3)`}</p>
            </div>
          </div>
          <h3>Expert reviews</h3>
          <div class="reviews">${publishedReviews.length ? publishedReviews.map((review) => renderReviewCard(review, 'customer')).join('') : '<p class="muted">No published expert reviews yet.</p>'}</div>
        ` : '<p>No restaurants found.</p>'}
      </div>
    </section>
  `;

  document.querySelector('#visitorSearch').addEventListener('input', renderVisitor);
  document.querySelectorAll('[data-restaurant-id]').forEach((el) => el.addEventListener('click', () => {
    selectedRestaurantId = el.dataset.restaurantId;
    renderVisitor();
  }));
  document.querySelectorAll('[data-map-id]').forEach((el) => el.addEventListener('click', () => {
    selectedRestaurantId = el.dataset.mapId;
    renderVisitor();
  }));
}

function renderMap(restaurants, selectedId, reviewedIds = new Set()) {
  if (!restaurants.length) return '<div class="map"><span class="map-label">No restaurants in this search</span></div>';
  const minLat = Math.min(...restaurants.map((r) => r.lat));
  const maxLat = Math.max(...restaurants.map((r) => r.lat));
  const minLng = Math.min(...restaurants.map((r) => r.lng));
  const maxLng = Math.max(...restaurants.map((r) => r.lng));
  const latRange = Math.max(maxLat - minLat, 0.004);
  const lngRange = Math.max(maxLng - minLng, 0.004);
  return `
    <div class="map">
      ${restaurants.map((r) => {
        const x = ((r.lng - minLng) / lngRange) * 78 + 10;
        const y = (1 - (r.lat - minLat) / latRange) * 70 + 12;
        const reviewed = reviewedIds.has(r.id);
        return `<button class="pin ${r.id === selectedId ? 'selected' : ''} ${reviewed ? 'reviewed' : ''}" data-map-id="${r.id}" style="left:${x}%;top:${y}%">${reviewed ? 'done' : (r.validReviewCount >= 3 ? r.averageRating.toFixed(1) : '-')}</button>`;
      }).join('')}
      <span class="map-label">London dining map</span>
    </div>
  `;
}

function renderReviewCard(review, mode = 'operator') {
  const customerMode = mode === 'customer';
  const dimensions = dimensionScoresForReview(review);
  const visit = review.visitContext || {};
  return `
    <article class="review-card">
      <div class="review-top">
        <div>${stars(review.rating)}<strong>${escapeHtml(review.title)}</strong></div>
        ${customerMode ? '' : pill(reviewStatusLabel(review.status), statusTone(review.status))}
      </div>
      ${dimensions ? renderDimensionBreakdown(dimensions) : ''}
      <p>${escapeHtml(review.body)}</p>
      ${visit.visitType || review.operationalTags?.length ? `
        <div class="review-signals">
          ${visit.visitType ? `<span>${escapeHtml(visit.visitType)}</span>` : ''}
          ${visit.spendPerPersonGbp ? `<span>GBP ${escapeHtml(visit.spendPerPersonGbp)}/person</span>` : ''}
          ${Number.isFinite(Number(visit.waitTimeMinutes)) ? `<span>${escapeHtml(visit.waitTimeMinutes)} min wait</span>` : ''}
          ${visit.revisitIntent ? `<span>Revisit ${escapeHtml(visit.revisitIntent)}</span>` : ''}
          ${(review.operationalTags || []).slice(0, 3).map((tag) => `<span>${escapeHtml(labelForTag(tag))}</span>`).join('')}
        </div>
      ` : ''}
      <div class="meta">
        <span>${customerMode ? 'Visit evidence' : 'GPS hash'} ${review.gpsEvidenceHash ? review.gpsEvidenceHash.slice(0, 12) : 'missing'}...</span>
        <span>${customerMode ? 'Verified record' : 'Review tx'} ${tx(review.xrplReviewTxHash)}</span>
        ${customerMode ? '' : `<span>Reward tx ${tx(review.xrplRewardTxHash)}</span>`}
      </div>
    </article>
  `;
}

function labelForTag(value) {
  return OPERATIONAL_TAGS.find(([key]) => key === value)?.[1] || value;
}

function renderDimensionBreakdown(dimensionScores) {
  return `
    <div class="dimension-breakdown">
      ${SCORE_DIMENSIONS.map(([key, label]) => `
        <span><small>${label}</small><strong>${Number(dimensionScores[key] || 0).toFixed(0)}</strong></span>
      `).join('')}
    </div>
  `;
}

function renderDimensionInputs() {
  return `
    <div class="dimension-inputs">
      ${SCORE_DIMENSIONS.map(([key, label]) => `
        <label class="dimension-input" for="score-${key}">
          <span>${label}</span>
          <select id="score-${key}">
            ${[1, 2, 3, 4, 5].map((score) => `<option value="${score}" ${score === Number(reviewDraft.dimensionScores[key]) ? 'selected' : ''}>${score}</option>`).join('')}
          </select>
        </label>
      `).join('')}
    </div>
    <div class="overall-preview"><span>Overall</span><strong>${overallFromDimensions(reviewDraft.dimensionScores).toFixed(1)}</strong></div>
  `;
}

function renderStructuredInputs() {
  return `
    <div class="structured-inputs">
      <label>Visit type
        <select id="visitType">
          ${['lunch', 'dinner', 'brunch', 'takeaway', 'coffee', 'other'].map((value) => `<option value="${value}" ${reviewDraft.visitType === value ? 'selected' : ''}>${value}</option>`).join('')}
        </select>
      </label>
      <label>Party size
        <input id="partySize" type="number" min="1" max="20" value="${escapeHtml(reviewDraft.partySize)}" />
      </label>
      <label>GBP per person
        <input id="spendPerPerson" type="number" min="0" max="500" step="1" value="${escapeHtml(reviewDraft.spendPerPersonGbp)}" />
      </label>
      <label>Wait time
        <input id="waitTime" type="number" min="0" max="240" step="1" value="${escapeHtml(reviewDraft.waitTimeMinutes)}" />
      </label>
      <label class="wide">Dishes sampled
        <input id="orderedItems" value="${escapeHtml(reviewDraft.orderedItems)}" />
      </label>
      <label>Revisit intent
        <select id="revisitIntent">
          ${['likely', 'neutral', 'unlikely'].map((value) => `<option value="${value}" ${reviewDraft.revisitIntent === value ? 'selected' : ''}>${value}</option>`).join('')}
        </select>
      </label>
    </div>
    <div class="tag-grid">
      ${OPERATIONAL_TAGS.map(([value, label]) => `
        <label><input type="checkbox" data-operational-tag value="${value}" ${reviewDraft.operationalTags.includes(value) ? 'checked' : ''} /> ${label}</label>
      `).join('')}
    </div>
  `;
}

function renderExpert() {
  if (expertSession && new Date(expertSession.expiresAt).getTime() <= Date.now()) {
    saveExpertSession(null);
  }
  if (expertSession?.role === 'candidate') {
    renderCandidateWalletStatus();
    return;
  }
  const expert = expertSession?.expertId ? expertById(expertSession.expertId) : null;
  if (!expert) {
    renderExpertGate();
    return;
  }
  if (!restaurantById(selectedReviewRestaurantId)) selectedReviewRestaurantId = state.restaurants[0]?.id;
  const selectedVenue = restaurantById(selectedReviewRestaurantId);
  const reviewedIds = reviewedRestaurantIdsForExpert(expert.id);
  const selectedAlreadyReviewed = hasRecentActiveReview(expert.id, selectedReviewRestaurantId);
  const restaurantOptions = state.restaurants.map((r) => `<option value="${r.id}" ${r.id === selectedReviewRestaurantId ? 'selected' : ''}>${escapeHtml(r.name)} (${r.verifiedStatus})</option>`).join('');
  const myReviews = state.reviews.filter((review) => review.expertId === expert?.id);
  const filteredReviews = myReviews
    .filter((review) => expertStatusFilter === 'all' || reviewFilterKey(review.status) === expertStatusFilter)
    .filter(matchesExpertTimeFilter)
    .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

  view.innerHTML = `
    <section class="grid two">
      <div class="panel">
        <div class="account-strip">
          <span>Wallet ${shortAddress(expert.xrplAddress)}</span>
          <span>Level ${expert.level}</span>
          <span>${expert.todayReviewCount || 0}/${expert.dailyReviewLimit} today</span>
          <span>${expert.defaultRewardXrp} XRP reward</span>
        </div>
        <div class="expert-map-panel">
          ${renderMap(state.restaurants, selectedReviewRestaurantId, reviewedIds)}
          ${selectedVenue ? `
            <div class="selected-venue">
              <div>
                <strong>${escapeHtml(selectedVenue.name)}</strong>
                <small>${escapeHtml(selectedVenue.address)}</small>
              </div>
              ${selectedAlreadyReviewed ? pill('Already reviewed', 'warn') : pill(selectedVenue.verifiedStatus === 'verified' ? 'Ready to review' : 'Expert-discovered', selectedVenue.verifiedStatus === 'verified' ? 'good' : 'neutral')}
            </div>
            ${selectedAlreadyReviewed ? '<p class="inline-warning">This wallet already submitted a recent active review for this restaurant. Choose another pin.</p>' : ''}
          ` : ''}
        </div>
        <form id="reviewForm">
          <label>Selected restaurant</label>
          <select id="restaurantSelect">${restaurantOptions}</select>
          <label>Dimension scores</label>
          ${renderDimensionInputs()}
          <label>Visit data</label>
          ${renderStructuredInputs()}
          <label>Title</label>
          <input id="reviewTitle" value="${escapeHtml(reviewDraft.title)}" />
          <label>Review text</label>
          <textarea id="reviewBody" rows="5">${escapeHtml(reviewDraft.body)}</textarea>
          <div class="gps-box">
            <strong>GPS Evidence</strong>
            <p id="gpsText">${gpsEvidence ? `${gpsEvidence.lat.toFixed(5)}, ${gpsEvidence.lng.toFixed(5)} - accuracy ${Math.round(gpsEvidence.accuracyMeters)}m - ${gpsEvidence.source}` : 'No GPS captured yet.'}</p>
            <div class="actions">
              <button type="button" class="secondary" id="browserGpsBtn">Use Browser GPS</button>
              <button type="button" class="secondary" id="demoGpsBtn">Demo GPS Near Selected Restaurant</button>
            </div>
          </div>
          <button type="submit" ${selectedAlreadyReviewed ? 'disabled' : ''}>Submit Expert Review to XRPL</button>
        </form>
      </div>
      <div class="panel">
        <div class="history-head">
          <h2>Review history</h2>
          <div class="history-filters">
            <select id="expertStatusFilter" aria-label="Review status filter">
              <option value="all" ${expertStatusFilter === 'all' ? 'selected' : ''}>All status</option>
              <option value="pending_review" ${expertStatusFilter === 'pending_review' ? 'selected' : ''}>Pending review</option>
              <option value="challenged" ${expertStatusFilter === 'challenged' ? 'selected' : ''}>Challenged</option>
              <option value="published" ${expertStatusFilter === 'published' ? 'selected' : ''}>Published</option>
              <option value="excluded" ${expertStatusFilter === 'excluded' ? 'selected' : ''}>Excluded</option>
            </select>
            <select id="expertTimeFilter" aria-label="Review time filter">
              <option value="all" ${expertTimeFilter === 'all' ? 'selected' : ''}>All time</option>
              <option value="today" ${expertTimeFilter === 'today' ? 'selected' : ''}>Today</option>
              <option value="7d" ${expertTimeFilter === '7d' ? 'selected' : ''}>Last 7 days</option>
              <option value="30d" ${expertTimeFilter === '30d' ? 'selected' : ''}>Last 30 days</option>
            </select>
          </div>
        </div>
        <div class="reviews">${filteredReviews.length ? filteredReviews.map((review) => renderReviewCard(review, 'expert')).join('') : `<p class="muted">${myReviews.length ? 'No reviews match these filters.' : 'No reviews from this wallet yet.'}</p>`}</div>
      </div>
    </section>
  `;

  document.querySelector('#browserGpsBtn')?.addEventListener('click', captureBrowserGps);
  document.querySelector('#demoGpsBtn')?.addEventListener('click', () => {
    captureReviewDraft();
    const restaurant = restaurantById(selectedReviewRestaurantId);
    gpsEvidence = { lat: restaurant.lat + 0.00018, lng: restaurant.lng + 0.00018, accuracyMeters: 35, source: 'demo_near_restaurant' };
    renderExpert();
  });
  document.querySelector('#restaurantSelect')?.addEventListener('change', (e) => {
    captureReviewDraft();
    selectedReviewRestaurantId = e.target.value;
    gpsEvidence = null;
    renderExpert();
  });
  document.querySelectorAll('[data-map-id]').forEach((el) => el.addEventListener('click', () => {
    captureReviewDraft();
    selectedReviewRestaurantId = el.dataset.mapId;
    gpsEvidence = null;
    renderExpert();
  }));
  SCORE_DIMENSIONS.forEach(([key]) => document.querySelector(`#score-${key}`)?.addEventListener('change', () => {
    captureReviewDraft();
    renderExpert();
  }));
  ['visitType', 'partySize', 'spendPerPerson', 'waitTime', 'orderedItems', 'revisitIntent'].forEach((id) => {
    const node = document.querySelector(`#${id}`);
    node?.addEventListener(node.tagName === 'INPUT' ? 'input' : 'change', captureReviewDraft);
  });
  document.querySelectorAll('[data-operational-tag]').forEach((node) => node.addEventListener('change', captureReviewDraft));
  document.querySelector('#reviewTitle')?.addEventListener('input', captureReviewDraft);
  document.querySelector('#reviewBody')?.addEventListener('input', captureReviewDraft);
  document.querySelector('#expertStatusFilter')?.addEventListener('change', (e) => {
    expertStatusFilter = e.target.value;
    renderExpert();
  });
  document.querySelector('#expertTimeFilter')?.addEventListener('change', (e) => {
    expertTimeFilter = e.target.value;
    renderExpert();
  });
  document.querySelector('#reviewForm')?.addEventListener('submit', submitReview);
}

function renderCandidateWalletStatus() {
  const credentialedExpert = activeExpertByAddress(expertSession.xrplAddress);
  view.innerHTML = `
    <section class="panel expert-gate candidate-status-panel">
      <div class="gate-mark">TrustBite</div>
      <h2>Your address</h2>
      <div class="large-address-row">${accountLine(expertSession.xrplAddress)} ${balanceLine(expertSession.xrplAddress)}</div>
      ${credentialedExpert ? `
        <p>This wallet now has an active expert credential.</p>
        <div class="account-strip">
          <span>${escapeHtml(anonymousExpertLabel(credentialedExpert))}</span>
          <span>${escapeHtml(credentialedExpert.credentialStatus)}</span>
          <span>${shortAddress(credentialedExpert.xrplAddress)}</span>
        </div>
        <p class="muted">Logout and sign in again as ${escapeHtml(anonymousExpertLabel(credentialedExpert))} to unlock review submission.</p>
      ` : `
        <p>You are not expert yet.</p>
        <div class="account-strip">
          <span>Not expert yet</span>
          <span>${shortAddress(expertSession.xrplAddress)}</span>
          <span>No scoring access</span>
        </div>
        <p class="muted">Ask Admin to issue a credential to this address. Refresh this page after Admin confirms the on-chain transaction.</p>
      `}
    </section>
  `;
}

function renderExpertGate() {
  view.innerHTML = `
    <section class="panel expert-gate">
      <div class="gate-mark">TrustBite</div>
      <h2>Restaurant scoring console</h2>
      <p>Use your assigned wallet to continue.</p>
    </section>
  `;
}

function renderExpertSession(expert, session) {
  if (!expert) {
    return '';
  }
  return `
    <div class="session-card">
      <span class="session-dot active"></span>
      <div>
        <strong>Wallet verified</strong>
        ${accountLine(expert.xrplAddress)}
        ${balanceLine(expert.xrplAddress)}
      </div>
      <button id="expertLogoutBtn" class="secondary">Logout</button>
    </div>
  `;
}

function renderCandidateSession(session) {
  return `
    <div class="session-card">
      <span class="session-dot active"></span>
      <div>
        <strong>Wallet verified</strong>
        ${accountLine(session.xrplAddress || session.signerAddress, 'Not expert yet - ')}
        ${balanceLine(session.xrplAddress || session.signerAddress)}
      </div>
      <button id="expertLogoutBtn" class="secondary">Logout</button>
    </div>
  `;
}

function renderAdminSession(session) {
  return `
    <div class="session-card">
      <span class="session-dot active"></span>
      <div>
        <strong>Admin wallet verified</strong>
        <small>${shortAddress(session.xrplAddress || session.signerAddress)}</small>
      </div>
      <button id="adminLogoutBtn" class="secondary">Logout</button>
    </div>
  `;
}

function renderMerchantSession(session) {
  return `
    <div class="session-card">
      <span class="session-dot active"></span>
      <div>
        <strong>Merchant wallet verified</strong>
        ${accountLine(session.xrplAddress || session.signerAddress)}
        ${balanceLine(session.xrplAddress || session.signerAddress)}
      </div>
      <button id="merchantLogoutBtn" class="secondary">Logout</button>
    </div>
  `;
}

function renderExpertCard(expert) {
  if (!expert) return '';
  const tone = expert.status === 'active' && expert.credentialStatus === 'active' ? 'good' : expert.status === 'suspended' ? 'bad' : 'warn';
  return `
    <div class="identity-card">
      ${pill(`${expert.status} - ${expert.credentialStatus}`, tone)}
      <dl>
        <dt>XRPL address</dt><dd>${escapeHtml(expert.xrplAddress || 'Run bootstrap first')}</dd>
        <dt>Credential</dt><dd>${escapeHtml(expert.credentialType || 'none')} ${expert.credentialMode ? `(${expert.credentialMode})` : ''}</dd>
        <dt>Daily limit</dt><dd>${expert.todayReviewCount || 0}/${expert.dailyReviewLimit} reviews</dd>
        <dt>Reward</dt><dd>${expert.defaultRewardXrp} XRP per published review</dd>
        <dt>Credential tx</dt><dd>${tx(expert.credentialTxHash)}</dd>
        <dt>Accept tx</dt><dd>${tx(expert.credentialAcceptTxHash)}</dd>
        <dt>Governance tx</dt><dd>${tx(expert.credentialSuspensionTxHash)}</dd>
        <dt>Removal tx</dt><dd>${tx(expert.credentialRemovalTxHash)}</dd>
      </dl>
    </div>
  `;
}

async function signInWithExpertWallet() {
  try {
    const loginValue = document.querySelector('#expertTopSelect')?.value || selectedExpertLoginId;
    if (!loginValue) throw new Error('No wallet is ready for login yet.');
    selectedExpertLoginId = loginValue;
    if (loginValue.startsWith('candidate:')) {
      const walletKey = loginValue.replace('candidate:', '');
      showMessage('Signing in with the selected wallet...');
      loginChallenge = await api('/auth/wallet/challenge', {
        method: 'POST',
        body: JSON.stringify({ walletKey })
      });
      loginSignature = await api('/auth/wallet/demo-sign', {
        method: 'POST',
        body: JSON.stringify({
          walletKey,
          challengeId: loginChallenge.challengeId
        })
      });
      showMessage('Verifying wallet signature...');
      const result = await api('/auth/wallet/login', {
        method: 'POST',
        body: JSON.stringify({
          walletKey,
          challengeId: loginChallenge.challengeId,
          signature: loginSignature.signature,
          signingPublicKey: loginSignature.signingPublicKey
        })
      });
      saveExpertSession({ ...result.session, verification: result.verification });
      loginChallenge = null;
      loginSignature = null;
      gpsEvidence = null;
      await refresh();
      showMessage(`${result.message}\nSigner: ${result.verification.signerAddress}`, false, 3000);
      renderExpert();
      return;
    }
    const expertId = loginValue.replace('expert:', '');
    selectedExpertId = expertId;
    showMessage('Signing in with the selected expert wallet...');
    loginChallenge = await api('/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ expertId })
    });
    loginSignature = await api('/auth/demo-sign', {
      method: 'POST',
      body: JSON.stringify({
        expertId,
        challengeId: loginChallenge.challengeId
      })
    });
    showMessage('Verifying signature and XRPL address...');
    const result = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        expertId,
        challengeId: loginChallenge.challengeId,
        signature: loginSignature.signature,
        signingPublicKey: loginSignature.signingPublicKey
      })
    });
    saveExpertSession({ ...result.session, verification: result.verification });
    selectedExpertId = result.session.expertId;
    selectedReviewRestaurantId = firstReviewableRestaurantId(result.session.expertId) || state.restaurants[0]?.id;
    loginChallenge = null;
    loginSignature = null;
    gpsEvidence = null;
    await refresh();
    showMessage(`${result.message}\nSigner: ${result.verification.signerAddress}\nChallenge payload hash: ${result.verification.challengePayloadHash}`, false, 3000);
    renderExpert();
  } catch (err) {
    showMessage(err.message, true);
  }
}

async function signInWithAdminWallet() {
  try {
    showMessage('Signing in with the admin wallet...');
    const challenge = await api('/auth/admin/challenge', {
      method: 'POST',
      body: JSON.stringify({})
    });
    const signature = await api('/auth/admin/demo-sign', {
      method: 'POST',
      body: JSON.stringify({ challengeId: challenge.challengeId })
    });
    showMessage('Verifying admin signature...');
    const result = await api('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        challengeId: challenge.challengeId,
        signature: signature.signature,
        signingPublicKey: signature.signingPublicKey
      })
    });
    saveAdminSession({ ...result.session, verification: result.verification });
    selectedAdminExpertId = null;
    adminReviewStatusFilter = 'pending_review';
    await refresh();
    showMessage(`${result.message}\nSigner: ${result.verification.signerAddress}`, false, 3000);
    renderAdmin();
  } catch (err) {
    showMessage(err.message, true);
  }
}

async function signInWithMerchantWallet() {
  try {
    const walletKey = document.querySelector('#merchantTopSelect')?.value || selectedMerchantLoginKey;
    if (!walletKey) throw new Error('No merchant wallet is ready for login yet.');
    selectedMerchantLoginKey = walletKey;
    showMessage('Signing in with the selected merchant wallet...');
    const challenge = await api('/auth/merchant/challenge', {
      method: 'POST',
      body: JSON.stringify({ walletKey })
    });
    const signature = await api('/auth/merchant/demo-sign', {
      method: 'POST',
      body: JSON.stringify({ walletKey, challengeId: challenge.challengeId })
    });
    showMessage('Verifying merchant signature...');
    const result = await api('/auth/merchant/login', {
      method: 'POST',
      body: JSON.stringify({
        walletKey,
        challengeId: challenge.challengeId,
        signature: signature.signature,
        signingPublicKey: signature.signingPublicKey
      })
    });
    saveMerchantSession({ ...result.session, verification: result.verification });
    selectedMerchantRestaurantId = result.session.restaurantIds?.[0] || null;
    await refresh();
    showMessage(`${result.message}\nSigner: ${result.verification.signerAddress}`, false, 3000);
    renderMerchant();
  } catch (err) {
    showMessage(err.message, true);
  }
}

function captureBrowserGps() {
  captureReviewDraft();
  if (!navigator.geolocation) {
    showMessage('Browser geolocation is not available. Use Demo GPS for the live demo.', true);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      gpsEvidence = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyMeters: pos.coords.accuracy,
        source: 'browser'
      };
      renderExpert();
    },
    (err) => showMessage(`GPS permission failed: ${err.message}. Use Demo GPS for the live demo.`, true),
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
}

async function submitReview(event) {
  event.preventDefault();
  try {
    if (!expertSession?.sessionToken) throw new Error('Please log in with an expert wallet first.');
    captureReviewDraft();
    if (hasRecentActiveReview(expertSession.expertId, selectedReviewRestaurantId)) {
      throw new Error('This wallet already submitted a recent active review for this restaurant. Choose another pin.');
    }
    showMessage('Submitting review hash and GPS evidence hash to XRPL...');
    const payload = {
      expertId: expertSession.expertId,
      sessionToken: expertSession.sessionToken,
      restaurantId: selectedReviewRestaurantId,
      dimensionScores: reviewDraft.dimensionScores,
      visitContext: {
        visitType: reviewDraft.visitType,
        partySize: reviewDraft.partySize,
        spendPerPersonGbp: reviewDraft.spendPerPersonGbp,
        waitTimeMinutes: reviewDraft.waitTimeMinutes,
        orderedItems: reviewDraft.orderedItems,
        revisitIntent: reviewDraft.revisitIntent
      },
      operationalTags: reviewDraft.operationalTags,
      title: reviewDraft.title,
      body: reviewDraft.body,
      gps: gpsEvidence
    };
    const result = await api('/reviews', { method: 'POST', body: JSON.stringify(payload) });
    gpsEvidence = null;
    resetReviewDraft();
    await refresh();
    showMessage(`${result.message}\nReview tx: ${result.review.xrplReviewTxHash}\nGPS evidence hash: ${result.review.gpsEvidenceHash}`);
    renderExpert();
  } catch (err) {
    showMessage(err.message, true);
  }
}

function merchantRestaurantsForSession() {
  if (!merchantSession?.restaurantIds?.length) return [];
  return state.restaurants.filter((restaurant) => merchantSession.restaurantIds.includes(restaurant.id));
}

function average(values) {
  const nums = values.map(Number).filter((value) => Number.isFinite(value));
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : 0;
}

function merchantAnalytics(restaurant) {
  const published = state.reviews
    .filter((review) => review.restaurantId === restaurant?.id && review.status === 'published')
    .sort((a, b) => new Date(a.publishedAt || a.submittedAt || 0) - new Date(b.publishedAt || b.submittedAt || 0));
  const all = state.reviews.filter((review) => review.restaurantId === restaurant?.id);
  const dimensionAverages = Object.fromEntries(SCORE_DIMENSIONS.map(([key]) => [
    key,
    average(published.map((review) => dimensionScoresForReview(review)?.[key] ?? review.rating))
  ]));
  const weakest = SCORE_DIMENSIONS
    .map(([key, label]) => ({ key, label, value: dimensionAverages[key] || 0 }))
    .sort((a, b) => a.value - b.value)[0];
  const tagCounts = {};
  for (const review of published) {
    for (const tag of review.operationalTags || []) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }
  const avgWait = average(published.map((review) => review.visitContext?.waitTimeMinutes));
  const avgSpend = average(published.map((review) => review.visitContext?.spendPerPersonGbp));
  return { published, all, dimensionAverages, weakest, tagCounts, avgWait, avgSpend };
}

function renderMetricTiles(restaurant, analytics) {
  const publishedCount = analytics.published.length;
  const score = publishedCount ? average(analytics.published.map((review) => review.rating)) : 0;
  return `
    <div class="merchant-metrics">
      <span><small>Trust score</small><strong>${publishedCount >= 1 ? score.toFixed(1) : 'N/A'}</strong><em>${publishedCount} published reviews</em></span>
      <span><small>Weakest dimension</small><strong>${analytics.weakest?.label || 'N/A'}</strong><em>${analytics.weakest?.value ? analytics.weakest.value.toFixed(1) : 'no data'}</em></span>
      <span><small>Avg wait</small><strong>${analytics.avgWait ? `${analytics.avgWait.toFixed(0)}m` : 'N/A'}</strong><em>expert observed</em></span>
      <span><small>Avg spend</small><strong>${analytics.avgSpend ? `GBP ${analytics.avgSpend.toFixed(0)}` : 'N/A'}</strong><em>per person</em></span>
    </div>
  `;
}

function renderDimensionBars(analytics) {
  return `
    <div class="dimension-bars">
      ${SCORE_DIMENSIONS.map(([key, label]) => {
        const value = analytics.dimensionAverages[key] || 0;
        return `<div><span>${label}</span><strong>${value ? value.toFixed(1) : 'N/A'}</strong><i style="--w:${Math.max(4, value * 20)}%"></i></div>`;
      }).join('')}
    </div>
  `;
}

function renderRatingTrend(analytics) {
  const rows = analytics.published.slice(-8);
  return `
    <div class="trend-bars">
      ${rows.length ? rows.map((review) => `<span title="${escapeHtml(review.title)}"><i style="height:${Math.max(8, Number(review.rating || 0) * 20)}%"></i><small>${Number(review.rating || 0).toFixed(1)}</small></span>`).join('') : '<p class="muted">No trend data yet.</p>'}
    </div>
  `;
}

function renderOperationalSignals(analytics) {
  const tags = Object.entries(analytics.tagCounts).sort((a, b) => b[1] - a[1]);
  return `
    <div class="signal-list">
      ${tags.length ? tags.map(([tag, count]) => `<span>${escapeHtml(labelForTag(tag))}<strong>${count}</strong></span>`).join('') : '<p class="muted">No recurring signals yet.</p>'}
    </div>
  `;
}

function renderBountyCards(restaurant) {
  const bounties = (state.bounties || []).filter((bounty) => bounty.restaurantId === restaurant?.id).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return `
    <div class="bounty-list">
      ${bounties.length ? bounties.map((bounty) => `
        <div class="bounty-card">
          ${pill(bounty.status, bounty.status === 'assigned' ? 'good' : 'warn')}
          <strong>${escapeHtml(bounty.focusArea)} - ${bounty.expertCount} experts</strong>
          <small>${bounty.totalXrp} XRP funded - ${bounty.rewardPerExpertXrp} XRP per expert</small>
          <div class="message-links">
            ${bounty.fundingTxHash ? `<a target="_blank" rel="noreferrer" href="${txUrl(bounty.fundingTxHash)}">Funding tx</a>` : ''}
            ${bounty.assignmentTxHash ? `<a target="_blank" rel="noreferrer" href="${txUrl(bounty.assignmentTxHash)}">Assignment tx</a>` : ''}
          </div>
        </div>
      `).join('') : '<p class="muted">No funded bounties yet.</p>'}
    </div>
  `;
}

function renderMerchant() {
  if (merchantSession && new Date(merchantSession.expiresAt).getTime() <= Date.now()) {
    saveMerchantSession(null);
  }
  if (!merchantSession) {
    view.innerHTML = `
      <section class="panel expert-gate">
        <div class="gate-mark">TrustBite</div>
        <h2>Merchant dashboard</h2>
        <p>Sign in with the restaurant wallet to continue.</p>
      </section>
    `;
    return;
  }
  const ownedRestaurants = merchantRestaurantsForSession();
  const restaurant = ownedRestaurants.find((item) => item.id === selectedMerchantRestaurantId) || ownedRestaurants[0] || null;
  if (restaurant?.id) selectedMerchantRestaurantId = restaurant.id;
  const analytics = merchantAnalytics(restaurant);
  const reviews = state.reviews.filter((r) => r.restaurantId === restaurant?.id && isChallengeWindowOpen(r));
  const minBounty = state.bountyRules?.minRewardPerExpertXrp || 2;
  const totalBounty = Number(merchantBountyDraft.expertCount || 0) * Number(merchantBountyDraft.rewardPerExpertXrp || 0);
  view.innerHTML = `
    <section class="grid two">
      <div class="panel">
        <h2>Merchant Dashboard</h2>
        <label>Restaurant account</label>
        <select id="merchantRestaurantSelect">${ownedRestaurants.map((r) => `<option value="${r.id}" ${r.id === restaurant?.id ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}</select>
        ${restaurant ? `
          <div class="score-card"><div class="score">${analytics.published.length ? average(analytics.published.map((review) => review.rating)).toFixed(1) : 'N/A'}</div><p>${escapeHtml(restaurant.name)} - ${analytics.published.length} published expert reviews</p></div>
          ${renderMetricTiles(restaurant, analytics)}
          <div class="insight-grid">
            <div>
              <h3>Dimension breakdown</h3>
              ${renderDimensionBars(analytics)}
            </div>
            <div>
              <h3>Rating trend</h3>
              ${renderRatingTrend(analytics)}
            </div>
          </div>
          <h3>Operational signals</h3>
          ${renderOperationalSignals(analytics)}
        ` : '<p class="muted">No restaurant assigned to this wallet.</p>'}
      </div>
      <div class="panel">
        <h2>Review Bounty</h2>
        ${merchantActionNoticeHtml ? `<div class="admin-action-notice">${merchantActionNoticeHtml}</div>` : ''}
        <div class="bounty-form">
          <label>Experts requested</label>
          <input id="bountyExpertCount" type="number" min="1" max="12" value="${escapeHtml(merchantBountyDraft.expertCount)}" />
          <label>Reward per expert (XRP)</label>
          <input id="bountyReward" type="number" min="${minBounty}" step="0.5" value="${escapeHtml(merchantBountyDraft.rewardPerExpertXrp)}" />
          <label>Focus area</label>
          <select id="bountyFocus">
            ${['consistency', 'hygiene', 'service_speed', 'value_for_money', 'menu_accuracy', 'overall_quality'].map((value) => `<option value="${value}" ${merchantBountyDraft.focusArea === value ? 'selected' : ''}>${value.replaceAll('_', ' ')}</option>`).join('')}
          </select>
          <label>Instruction note</label>
          <textarea id="bountyNote" rows="3">${escapeHtml(merchantBountyDraft.note)}</textarea>
          <div class="bounty-total"><span>Total funding</span><strong>${Number.isFinite(totalBounty) ? totalBounty.toFixed(2) : '0.00'} XRP</strong><small>minimum ${minBounty} XRP per expert</small></div>
          <button id="publishBountyBtn" ${restaurant ? '' : 'disabled'}>Fund Bounty On XRPL</button>
        </div>
        <h3>Bounty history</h3>
        ${renderBountyCards(restaurant)}
      </div>
      <div class="panel span-two">
        <h2>Open Challenge Windows</h2>
        <div class="reviews">${reviews.length ? reviews.map((review) => `
          <article class="review-card">
            ${renderReviewCard(review)}
            <div class="actions"><button data-challenge="${review.id}" ${review.status === 'challenged' ? 'disabled' : ''}>${review.status === 'challenged' ? 'Already Challenged' : 'Challenge Review'}</button></div>
          </article>
        `).join('') : '<p class="muted">No challengeable reviews for this restaurant.</p>'}</div>
      </div>
    </section>
  `;
  document.querySelector('#merchantRestaurantSelect')?.addEventListener('change', (e) => {
    selectedMerchantRestaurantId = e.target.value;
    renderMerchant();
  });
  ['bountyExpertCount', 'bountyReward', 'bountyFocus', 'bountyNote'].forEach((id) => {
    const node = document.querySelector(`#${id}`);
    node?.addEventListener(node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' ? 'input' : 'change', captureMerchantBountyDraft);
  });
  document.querySelector('#publishBountyBtn')?.addEventListener('click', publishMerchantBounty);
  document.querySelectorAll('[data-challenge]').forEach((button) => button.addEventListener('click', () => challengeReview(button.dataset.challenge)));
}

function captureMerchantBountyDraft() {
  merchantBountyDraft = {
    expertCount: Number(document.querySelector('#bountyExpertCount')?.value || merchantBountyDraft.expertCount),
    rewardPerExpertXrp: Number(document.querySelector('#bountyReward')?.value || merchantBountyDraft.rewardPerExpertXrp),
    focusArea: document.querySelector('#bountyFocus')?.value || merchantBountyDraft.focusArea,
    note: document.querySelector('#bountyNote')?.value || merchantBountyDraft.note
  };
}

async function publishMerchantBounty() {
  try {
    if (!merchantSession?.sessionToken) throw new Error('Please sign in with a merchant wallet first.');
    captureMerchantBountyDraft();
    const restaurantId = selectedMerchantRestaurantId;
    const restaurant = restaurantById(restaurantId);
    if (!restaurant) throw new Error('Select a restaurant first.');
    const ok = await confirmAdminAction({
      title: 'Fund review bounty?',
      body: `This submits an XRPL payment from your merchant wallet to the TrustBite bounty pool for ${restaurant.name}.`,
      confirmText: 'Yes, fund bounty'
    });
    if (!ok) return;
    merchantActionNoticeHtml = '<strong>Submitting XRPL bounty payment...</strong>';
    renderMerchant();
    const result = await api('/merchant/bounties', {
      method: 'POST',
      body: JSON.stringify({
        merchantSessionToken: merchantSession.sessionToken,
        restaurantId,
        ...merchantBountyDraft
      })
    });
    await refresh();
    merchantActionNoticeHtml = buildMerchantResultHtml(result);
    showMessage('');
    renderMerchant();
  } catch (err) {
    merchantActionNoticeHtml = `<strong>Bounty failed.</strong><span>${escapeHtml(err.message)}</span>`;
    renderMerchant();
    showMessage(err.message, true);
  }
}

function buildMerchantResultHtml(result) {
  return [
    `<strong>${escapeHtml(result.message || 'Done.')}</strong>`,
    result.fundingTxHash ? `<div class="message-links"><a target="_blank" rel="noreferrer" href="${txUrl(result.fundingTxHash)}">Bounty funding tx</a></div>` : ''
  ].filter(Boolean).join('');
}

async function challengeReview(reviewId) {
  try {
    if (!merchantSession?.sessionToken) throw new Error('Please sign in with a merchant wallet first.');
    const result = await api(`/merchant/reviews/${reviewId}/challenge`, {
      method: 'POST',
      body: JSON.stringify({
        merchantSessionToken: merchantSession.sessionToken,
        reason: 'gps_mismatch',
        description: 'Merchant requests admin review during the challenge window.'
      })
    });
    showMessage(result.message);
    await refresh();
    renderMerchant();
  } catch (err) {
    showMessage(err.message, true);
  }
}

function confirmAdminAction({ title, body, confirmText = 'Yes', danger = false }) {
  return new Promise((resolve) => {
    document.querySelector('.confirm-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-card" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
        <h3 id="confirmTitle">${escapeHtml(title)}</h3>
        <p>${escapeHtml(body)}</p>
        <div class="actions">
          <button id="confirmYes" class="${danger ? 'danger' : ''}">${escapeHtml(confirmText)}</button>
          <button id="confirmNo" class="secondary">No</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = (value) => {
      overlay.remove();
      resolve(value);
    };
    overlay.querySelector('#confirmYes').addEventListener('click', () => close(true));
    overlay.querySelector('#confirmNo').addEventListener('click', () => close(false));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close(false);
    });
  });
}

function renderAdmin() {
  if (!adminSession) {
    renderAdminGate();
    return;
  }
  const selectedExpert = selectedAdminExpertId ? expertById(selectedAdminExpertId) : null;
  const expertReviews = selectedExpert ? state.reviews
    .filter((review) => review.expertId === selectedExpert.id)
    .filter((review) => adminReviewStatusFilter === 'all' || reviewFilterKey(review.status) === adminReviewStatusFilter)
    .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0)) : [];
  const suspensionLabel = selectedExpert?.status === 'active' ? 'Suspend Credential' : 'Reactivate Credential';
  const activeExperts = state.experts.filter((expert) => expert.status === 'active' && expert.credentialStatus === 'active' && expert.xrplAddress);
  const bounties = (state.bounties || []).slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  view.innerHTML = `
    <section class="grid two">
      <div class="panel">
        <h2>Admin Panel</h2>
        <p>Demo tools for wallet setup, expert credentials, review moderation, and reward settlement.</p>
        <div class="credential-issuer top-credential-issuer">
          <h3>Issue Credential</h3>
          <div class="credential-input-row">
            <input id="credentialAddressInput" value="${escapeHtml(adminCredentialAddressDraft)}" placeholder="Enter verified expert XRPL address" aria-label="Expert XRPL address" />
            <button id="adminIssueCredentialBtn">Issue Credential On XRPL</button>
          </div>
          <small>Admin signs CredentialCreate for this address. Demo wallets auto-accept; external wallets accept from their own wallet.</small>
        </div>
        ${adminActionNoticeHtml ? `<div class="admin-action-notice">${adminActionNoticeHtml}</div>` : ''}
        <div class="actions">
          <button data-action="bootstrap">Create/Fund Devnet Wallets</button>
          <button data-action="refreshBalances" class="secondary">Refresh Balances</button>
          <button data-action="resetDemo" class="secondary">Reset Reviews Only</button>
        </div>
        <details class="admin-details">
          <summary>Demo infrastructure</summary>
          <div class="network-summary">
            <span>XRPL ${state.xrplInstalled ? 'ready' : 'missing'}</span>
            <span>Signing ${state.keypairsInstalled ? 'ready' : 'missing'}</span>
            <span>${escapeHtml(state.xrplServer)}</span>
          </div>
          <div class="wallet-grid">
            ${state.wallets.map((w) => `<div class="wallet-card"><strong>${escapeHtml(w.label)}</strong><small>${escapeHtml(w.address || 'not created')}</small><span>${escapeHtml(w.balanceXrp || 'N/A')} XRP</span></div>`).join('')}
          </div>
        </details>
        <h3>Expert list</h3>
        <div class="expert-list">
          ${state.experts.map((expert) => `
            <button class="expert-list-row ${expert.id === selectedExpert?.id ? 'selected' : ''}" data-admin-expert="${expert.id}">
              <span>
                <strong>${escapeHtml(anonymousExpertLabel(expert))}</strong>
                <small>${shortAddress(expert.xrplAddress || '')} - ${escapeHtml(expert.credentialStatus || 'not_issued')}</small>
              </span>
              ${pill(expert.status, expert.status === 'active' ? 'good' : 'bad')}
            </button>
          `).join('')}
        </div>
        ${selectedExpert ? `
          <div class="selected-admin-expert">
            <h3>${escapeHtml(anonymousExpertLabel(selectedExpert))} credential state</h3>
            ${renderExpertCard(selectedExpert)}
            <div class="actions">
              <button data-suspend="${selectedExpert.id}" class="secondary" ${selectedExpert.credentialStatus === 'removed' ? 'disabled' : ''}>${suspensionLabel}</button>
              <button data-remove="${selectedExpert.id}" class="danger" ${selectedExpert.credentialStatus === 'removed' ? 'disabled' : ''}>Remove Credential</button>
            </div>
          </div>
        ` : '<p class="muted">Select an anonymous expert wallet to inspect credential state and governance actions.</p>'}
      </div>
      <div class="panel">
        <div class="history-head">
          <h2>${selectedExpert ? 'Selected expert reviews' : 'Review Operations'}</h2>
          <div class="history-filters">
            <select id="adminReviewStatusFilter" aria-label="Admin review status filter" ${selectedExpert ? '' : 'disabled'}>
              <option value="all" ${adminReviewStatusFilter === 'all' ? 'selected' : ''}>All status</option>
              <option value="pending_review" ${adminReviewStatusFilter === 'pending_review' ? 'selected' : ''}>Pending review</option>
              <option value="challenged" ${adminReviewStatusFilter === 'challenged' ? 'selected' : ''}>Challenged</option>
              <option value="published" ${adminReviewStatusFilter === 'published' ? 'selected' : ''}>Published</option>
              <option value="excluded" ${adminReviewStatusFilter === 'excluded' ? 'selected' : ''}>Excluded</option>
            </select>
          </div>
        </div>
        <div class="reviews">${expertReviews.length ? expertReviews.map((review) => `
          <article class="review-card">
            ${renderReviewCard(review)}
            <div class="actions">
              <button data-publish="${review.id}" ${review.status === 'published' ? 'disabled' : ''}>Publish + Pay 2 XRP</button>
              <button data-exclude="${review.id}" class="secondary" ${review.status === 'excluded' ? 'disabled' : ''}>Exclude</button>
            </div>
          </article>
        `).join('') : `<p class="muted">${selectedExpert ? 'No reviews match this filter.' : 'Select an expert first.'}</p>`}</div>
        <h2>Bounty Operations</h2>
        <div class="bounty-admin-list">
          ${bounties.length ? bounties.map((bounty) => {
            const restaurant = restaurantById(bounty.restaurantId);
            return `
              <div class="bounty-card">
                ${pill(bounty.status, bounty.status === 'assigned' ? 'good' : 'warn')}
                <strong>${escapeHtml(restaurant?.name || 'Unknown restaurant')}</strong>
                <small>${bounty.totalXrp} XRP funded - ${bounty.expertCount} experts - ${escapeHtml(bounty.focusArea)}</small>
                <div class="message-links">
                  ${bounty.fundingTxHash ? `<a target="_blank" rel="noreferrer" href="${txUrl(bounty.fundingTxHash)}">Funding tx</a>` : ''}
                  ${bounty.assignmentTxHash ? `<a target="_blank" rel="noreferrer" href="${txUrl(bounty.assignmentTxHash)}">Assignment tx</a>` : ''}
                </div>
                <div class="assignment-picker">
                  ${activeExperts.map((expert) => `<label><input type="checkbox" data-bounty-expert="${bounty.id}" value="${expert.id}" ${bounty.assignedExpertIds?.includes(expert.id) ? 'checked' : ''} /> ${escapeHtml(anonymousExpertLabel(expert))} ${shortAddress(expert.xrplAddress)}</label>`).join('')}
                </div>
                <div class="actions">
                  <button data-bounty-random="${bounty.id}" class="secondary">Random Assign</button>
                  <button data-bounty-assign="${bounty.id}">Assign Selected</button>
                </div>
              </div>
            `;
          }).join('') : '<p class="muted">No merchant bounties funded yet.</p>'}
        </div>
        <details class="admin-details audit-details">
          <summary>Audit Log</summary>
          <div class="audit-log">
            ${state.auditLogs.slice().reverse().map((log) => `<div><strong>${escapeHtml(log.action)}</strong><span>${escapeHtml(auditEntityLabel(log))}</span><span>${escapeHtml(auditStatusLabel(log.fromStatus))} -> ${escapeHtml(auditStatusLabel(log.toStatus))}</span><small>${new Date(log.createdAt).toLocaleString()}</small></div>`).join('')}
          </div>
        </details>
      </div>
    </section>
  `;
  document.querySelector('[data-action="bootstrap"]').addEventListener('click', () => runAdmin('/bootstrap', 'Creating/funding XRPL wallets. This may take a moment...'));
  document.querySelector('[data-action="refreshBalances"]').addEventListener('click', () => runAdmin('/refresh-balances', 'Refreshing balances...'));
  document.querySelector('[data-action="resetDemo"]').addEventListener('click', () => runAdmin('/reset-demo', 'Resetting review demo data...'));
  document.querySelectorAll('[data-admin-expert]').forEach((button) => button.addEventListener('click', () => {
    selectedAdminExpertId = button.dataset.adminExpert;
    adminReviewStatusFilter = 'pending_review';
    renderAdmin();
  }));
  document.querySelector('#credentialAddressInput')?.addEventListener('input', (event) => {
    adminCredentialAddressDraft = event.target.value;
  });
  document.querySelector('#adminIssueCredentialBtn')?.addEventListener('click', async () => {
    const subjectAddress = document.querySelector('#credentialAddressInput')?.value.trim() || '';
    if (!subjectAddress) return showMessage('Enter an XRPL address first.', true);
    const ok = await confirmAdminAction({
      title: 'Issue credential?',
      body: `Submit an XRPL credential transaction for ${subjectAddress}.`,
      confirmText: 'Yes, issue'
    });
    if (!ok) return;
    adminCredentialAddressDraft = subjectAddress;
    return runAdmin('/admin/credentials/issue', 'Issuing expert credential on XRPL...', { subjectAddress });
  });
  document.querySelectorAll('[data-suspend]').forEach((button) => button.addEventListener('click', async () => {
    const expert = expertById(button.dataset.suspend);
    const label = expert?.status === 'active' ? 'suspend' : 'reactivate';
    const ok = await confirmAdminAction({
      title: `${label === 'suspend' ? 'Suspend' : 'Reactivate'} credential?`,
      body: `This records a TrustBite governance action on XRPL for ${shortAddress(expert?.xrplAddress || '')}.`,
      confirmText: `Yes, ${label}`
    });
    if (!ok) return;
    return runAdmin(`/admin/experts/${button.dataset.suspend}/toggle-suspension`, 'Submitting credential governance transaction...');
  }));
  document.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', async () => {
    const expert = expertById(button.dataset.remove);
    const ok = await confirmAdminAction({
      title: 'Remove credential?',
      body: `This attempts XRPL CredentialDelete for ${shortAddress(expert?.xrplAddress || '')}. The expert will lose scoring access.`,
      confirmText: 'Yes, remove',
      danger: true
    });
    if (!ok) return;
    return runAdmin(`/admin/experts/${button.dataset.remove}/remove-credential`, 'Submitting credential removal transaction...');
  }));
  document.querySelectorAll('[data-publish]').forEach((button) => button.addEventListener('click', () => runAdmin(`/admin/reviews/${button.dataset.publish}/publish`, 'Publishing review and paying 2 XRP...')));
  document.querySelectorAll('[data-exclude]').forEach((button) => button.addEventListener('click', () => runAdmin(`/admin/reviews/${button.dataset.exclude}/exclude`, 'Excluding review...')));
  document.querySelectorAll('[data-bounty-random]').forEach((button) => button.addEventListener('click', async () => {
    const ok = await confirmAdminAction({
      title: 'Randomly assign bounty?',
      body: 'This records an XRPL assignment anchor for the selected bounty.',
      confirmText: 'Yes, assign'
    });
    if (!ok) return;
    return runAdmin(`/admin/bounties/${button.dataset.bountyRandom}/assign-random`, 'Submitting bounty assignment transaction...');
  }));
  document.querySelectorAll('[data-bounty-assign]').forEach((button) => button.addEventListener('click', async () => {
    const bountyId = button.dataset.bountyAssign;
    const expertIds = [...document.querySelectorAll(`[data-bounty-expert="${bountyId}"]:checked`)].map((input) => input.value);
    const ok = await confirmAdminAction({
      title: 'Assign selected experts?',
      body: `This records an XRPL assignment anchor for ${expertIds.length} selected experts.`,
      confirmText: 'Yes, assign'
    });
    if (!ok) return;
    return runAdmin(`/admin/bounties/${bountyId}/assign`, 'Submitting bounty assignment transaction...', { expertIds });
  }));
  document.querySelector('#adminReviewStatusFilter')?.addEventListener('change', (event) => {
    adminReviewStatusFilter = event.target.value;
    renderAdmin();
  });
}

function renderAdminGate() {
  view.innerHTML = `
    <section class="panel expert-gate">
      <div class="gate-mark">TrustBite</div>
      <h2>Admin operations console</h2>
      <p>Sign in with the issuer wallet to continue.</p>
    </section>
  `;
}

async function runAdmin(path, workingText, extraBody = {}) {
  try {
    if (!adminSession?.sessionToken) throw new Error('Please sign in with the admin wallet first.');
    showMessage(workingText);
    adminActionNoticeHtml = `<strong>${escapeHtml(workingText)}</strong>`;
    renderAdmin();
    const result = await api(path, {
      method: 'POST',
      body: JSON.stringify({ adminSessionToken: adminSession.sessionToken, ...extraBody })
    });
    if (result.expertId) selectedAdminExpertId = result.expertId;
    await refresh();
    adminActionNoticeHtml = buildAdminResultHtml(result);
    showMessage('');
    renderAdmin();
  } catch (err) {
    adminActionNoticeHtml = `<strong>Action failed.</strong><span>${escapeHtml(err.message)}</span>`;
    if (currentPage() === 'admin') renderAdmin();
    showMessage(err.message, true);
  }
}

function buildAdminResultHtml(result) {
  const links = [];
  if (result.createHash) links.push(`<a target="_blank" rel="noreferrer" href="${txUrl(result.createHash)}">${result.mode === 'memo_anchor_fallback' ? 'Credential anchor tx' : 'CredentialCreate tx'}</a>`);
  if (result.acceptHash) links.push(`<a target="_blank" rel="noreferrer" href="${txUrl(result.acceptHash)}">CredentialAccept tx</a>`);
  if (result.deleteHash) links.push(`<a target="_blank" rel="noreferrer" href="${txUrl(result.deleteHash)}">CredentialDelete tx</a>`);
  if (result.governanceTxHash) links.push(`<a target="_blank" rel="noreferrer" href="${txUrl(result.governanceTxHash)}">Governance tx</a>`);
  if (result.fundingTxHash) links.push(`<a target="_blank" rel="noreferrer" href="${txUrl(result.fundingTxHash)}">Funding tx</a>`);
  if (result.assignmentTxHash) links.push(`<a target="_blank" rel="noreferrer" href="${txUrl(result.assignmentTxHash)}">Assignment tx</a>`);
  if (result.rewardTxHash) links.push(`<a target="_blank" rel="noreferrer" href="${txUrl(result.rewardTxHash)}">Reward tx</a>`);
  return [
    `<strong>${escapeHtml(result.message || 'Done.')}</strong>`,
    result.warning ? `<span>${escapeHtml(result.warning)}</span>` : '',
    links.length ? `<div class="message-links">${links.join('')}</div>` : ''
  ].filter(Boolean).join('');
}

refresh();
